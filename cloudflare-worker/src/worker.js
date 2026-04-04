const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(origin, extra = {}) {
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': origin,
    ...extra,
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: withCors(origin, { 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

function safeOrigin(requestOrigin, allowedOrigin) {
  if (!requestOrigin) return allowedOrigin || '*';
  if (!allowedOrigin) return requestOrigin;
  return requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const origin = safeOrigin(requestOrigin, allowedOrigin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCors(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    const question = String(payload?.question || '').trim();
    const lang = String(payload?.lang || 'tr').toLowerCase() === 'en' ? 'en' : 'tr';

    if (!question) {
      return json({ error: 'Question is required' }, 400, origin);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'Missing OPENAI_API_KEY secret' }, 500, origin);
    }

    const model = env.OPENAI_MODEL || 'gpt-4o-mini';

    const systemPrompt =
      lang === 'tr'
        ? 'Sen RoboLogAI sitesi icin kaynak odakli bir yardimcisin. Kisa, net ve bilgilendirici cevap ver. Yatirim tavsiyesi verme. Gerekli oldugunda kullaniciyi site ici haber ve sirket bolumlerine yonlendir.'
        : 'You are a source-focused helper for RoboLogAI. Keep answers concise, clear, and informative. Do not provide investment advice. When relevant, direct users to on-site news and company sections.';

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return json({ error: 'Upstream AI error', detail: errorText.slice(0, 400) }, 502, origin);
    }

    const result = await upstream.json();
    const answer =
      result?.choices?.[0]?.message?.content?.trim() ||
      (lang === 'tr'
        ? 'Bu soru icin su an cevap uretemedim, lutfen tekrar deneyin.'
        : 'I could not generate an answer right now, please try again.');

    return json({ answer }, 200, origin);
  },
};
