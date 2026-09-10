-- Wake & Move — database schema
--
-- HOW TO USE THIS FILE:
-- 1. Create a Supabase project at supabase.com (free tier).
-- 2. Open the "SQL Editor" tab in your Supabase project dashboard.
-- 3. Paste this entire file in and click "Run".
-- That's it — this creates the tables and locks them down so each user
-- can only ever see and edit their own data.
--
-- You do not need to understand every line to use it, but here's the gist:
-- Supabase gives you user accounts (auth.users) for free out of the box.
-- The tables below reference that built-in users table, and "Row Level
-- Security" (RLS) policies enforce — at the database level, not just in
-- app code — that a logged-in user can only touch rows where user_id
-- matches their own account. This is why it's safe to ship the public
-- "anon" API key in client-side JavaScript: the database itself refuses
-- any request that tries to read or write someone else's data.

-- ── Alarms ──────────────────────────────────────────────────────────────
create table if not exists public.alarms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  time        text not null,              -- "HH:MM", 24-hour
  label       text not null default '',
  sound       text not null default 'chimes',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.alarms enable row level security;

create policy "Users can manage their own alarms"
  on public.alarms
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Sessions (one row per completed "move challenge") ────────────────────
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  alarm_id          uuid references public.alarms(id) on delete set null,
  completed_at      timestamptz not null default now(),
  duration_seconds  numeric,              -- how long the challenge took
  video_saved       boolean not null default false
);

alter table public.sessions enable row level security;

create policy "Users can manage their own sessions"
  on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Helpful index for the most common query (today's streak lookups) ────
create index if not exists sessions_user_completed_idx
  on public.sessions (user_id, completed_at desc);
