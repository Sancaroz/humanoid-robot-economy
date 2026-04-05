-- Member Blog security schema and policies

create table if not exists public.member_posts (
  id bigint generated always as identity primary key,
  name text not null,
  title text not null,
  content text not null,
  approved boolean not null default true,
  moderation_reason text,
  created_ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.member_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.member_posts(id) on delete cascade,
  name text not null,
  message text not null,
  approved boolean not null default true,
  moderation_reason text,
  created_ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.member_rate_limits (
  action text not null,
  ip_hash text not null,
  last_at timestamptz not null default now(),
  primary key (action, ip_hash)
);

create index if not exists idx_member_posts_approved_created_at
  on public.member_posts (approved, created_at desc);

create index if not exists idx_member_comments_post_approved_created_at
  on public.member_comments (post_id, approved, created_at asc);

alter table public.member_posts enable row level security;
alter table public.member_comments enable row level security;
alter table public.member_rate_limits enable row level security;

-- Public can only read approved content
drop policy if exists "member_posts_public_select_approved" on public.member_posts;
create policy "member_posts_public_select_approved"
on public.member_posts
for select
using (approved = true);

drop policy if exists "member_comments_public_select_approved" on public.member_comments;
create policy "member_comments_public_select_approved"
on public.member_comments
for select
using (approved = true);

-- Block direct anon insert/update/delete on posts/comments;
-- writes are expected via Edge Function with service role.

-- Optional: allow authenticated admins to review/moderate
drop policy if exists "member_posts_admin_all" on public.member_posts;
create policy "member_posts_admin_all"
on public.member_posts
for all
to authenticated
using (true)
with check (true);

drop policy if exists "member_comments_admin_all" on public.member_comments;
create policy "member_comments_admin_all"
on public.member_comments
for all
to authenticated
using (true)
with check (true);

-- Rate-limit table: only service role should write/read.
