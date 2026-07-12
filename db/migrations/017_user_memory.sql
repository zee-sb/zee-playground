-- Persistent per-user memory ("Navigator knows you") + a materialized proactive
-- briefing cache ("welcome back" surface).
--
-- Scoped by user_id (fk users.id) with staffbase_branch_id denormalized so a
-- tenant off-boarding can wipe all its memory with one branch-scoped delete and
-- reads never need to join conversations. Do NOT store learned memory in
-- users.custom_fields — that column is overwritten wholesale on every login.

create table if not exists user_memory (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  staffbase_branch_id text not null,

  -- profile   — from Staffbase org data (role, team, location, manager)
  -- preference — learned (preferred_language, 'prefers short answers', ...)
  -- fact       — salient extracted facts ('onboarding buddy is Lena')
  -- open_item  — unresolved tickets / PTO / requests (uses status + expires_at)
  kind                text not null check (kind in ('profile','preference','fact','open_item')),
  -- Stable slug within (user_id, kind) so re-extraction UPSERTs, e.g.
  -- 'role', 'preferred_language', 'open_ticket:NAV-812'.
  mem_key             text not null,
  -- Human-readable value injected into the prompt.
  mem_value           text not null,

  source              text not null default 'conversation'
                      check (source in ('staffbase','connector','conversation','seed')),
  source_ref          text,                        -- conversation id, jira key, ...
  confidence          double precision not null default 0.6,

  status              text check (status in ('open','resolved','expired')),  -- open_item lifecycle

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),  -- recency for read-time ranking
  expires_at          timestamptz,                          -- soft TTL; null = never

  unique (user_id, kind, mem_key)
);

create index if not exists user_memory_user_idx   on user_memory (user_id, kind);
create index if not exists user_memory_branch_idx on user_memory (staffbase_branch_id);
create index if not exists user_memory_open_idx   on user_memory (user_id) where kind = 'open_item' and status = 'open';

-- Materialized briefing cache: one row per user, refreshed by the briefing
-- endpoint. Lets the "welcome back" surface render instantly and survive a
-- flaky live signal during a demo.
create table if not exists user_briefing (
  user_id             uuid primary key references users(id) on delete cascade,
  staffbase_branch_id text not null,
  cards               jsonb not null default '[]'::jsonb,
  computed_at         timestamptz not null default now(),
  source              text not null default 'live'   -- 'live' | 'seed'
);
