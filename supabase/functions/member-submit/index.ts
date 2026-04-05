// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOCKED_WORDS = [
  'casino',
  'bet',
  'free money',
  'win now',
  'telegram',
  'whatsapp group',
  'crypto signal',
  'adult',
  'porn',
];

const RATE_LIMITS_MS: Record<string, number> = {
  create_post: 60 * 1000,
  create_comment: 20 * 1000,
};

type Payload = {
  action: 'create_post' | 'create_comment';
  payload: Record<string, string>;
};

function normalize(text: string): string {
  return (text || '').trim().toLowerCase();
}

function shouldModerate(text: string): { flagged: boolean; reason: string } {
  const normalized = normalize(text);
  const hasBlocked = BLOCKED_WORDS.some((word) => normalized.includes(word));
  const links = normalized.match(/https?:\/\/|www\./g);
  const tooManyLinks = Array.isArray(links) && links.length > 2;

  if (hasBlocked) {
    return { flagged: true, reason: 'blocked_word' };
  }

  if (tooManyLinks) {
    return { flagged: true, reason: 'link_spam' };
  }

  return { flagged: false, reason: '' };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input || 'unknown');
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const direct = xff.split(',')[0]?.trim();
  if (direct) return direct;
  const cf = req.headers.get('cf-connecting-ip') || '';
  if (cf) return cf;
  return 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase env vars');
    }

    const body = (await req.json()) as Payload;
    if (!body || !body.action || !body.payload) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const action = body.action;
    const payload = body.payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const ipHash = await sha256Hex(getIp(req));
    const rateWindow = RATE_LIMITS_MS[action] || 30 * 1000;

    const rateResult = await supabase
      .from('member_rate_limits')
      .select('last_at')
      .eq('action', action)
      .eq('ip_hash', ipHash)
      .maybeSingle();

    if (rateResult.error) {
      throw rateResult.error;
    }

    const now = Date.now();
    const lastAt = rateResult.data?.last_at ? new Date(rateResult.data.last_at).getTime() : 0;

    if (lastAt && now - lastAt < rateWindow) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upsertRate = await supabase
      .from('member_rate_limits')
      .upsert({ action, ip_hash: ipHash, last_at: new Date().toISOString() }, { onConflict: 'action,ip_hash' });

    if (upsertRate.error) {
      throw upsertRate.error;
    }

    if (action === 'create_post') {
      const name = (payload.name || '').trim();
      const title = (payload.title || '').trim();
      const content = (payload.content || '').trim();

      if (!name || !title || !content) {
        return new Response(JSON.stringify({ error: 'missing_fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const moderation = shouldModerate(title + ' ' + content);
      const insertPost = await supabase.from('member_posts').insert({
        name,
        title,
        content,
        approved: !moderation.flagged,
        moderation_reason: moderation.flagged ? moderation.reason : null,
        created_ip_hash: ipHash,
      });

      if (insertPost.error) {
        throw insertPost.error;
      }

      return new Response(JSON.stringify({ ok: true, moderated: moderation.flagged }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_comment') {
      const postId = Number(payload.postId || 0);
      const name = (payload.name || '').trim();
      const message = (payload.message || '').trim();

      if (!postId || !name || !message) {
        return new Response(JSON.stringify({ error: 'missing_fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const moderation = shouldModerate(message);
      const insertComment = await supabase.from('member_comments').insert({
        post_id: postId,
        name,
        message,
        approved: !moderation.flagged,
        moderation_reason: moderation.flagged ? moderation.reason : null,
        created_ip_hash: ipHash,
      });

      if (insertComment.error) {
        throw insertComment.error;
      }

      return new Response(JSON.stringify({ ok: true, moderated: moderation.flagged }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown_action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
