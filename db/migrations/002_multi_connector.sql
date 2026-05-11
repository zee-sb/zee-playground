-- Companion v2: pivot from "Atlassian = login" to "Staffbase = login, Atlassian = one of many connections".
--
-- This is destructive — we drop oauth_tokens and reshape users. Safe at this
-- stage because no production data exists yet.

drop table if exists messages;
drop table if exists conversations;
drop table if exists oauth_tokens;
drop table if exists users;

-- Primary identity = mock Staffbase user.
create table users (
  id                    uuid primary key default gen_random_uuid(),
  staffbase_user_id     text unique not null,
  email                 text not null,
  display_name          text,
  department            text,
  title                 text,
  avatar_initials       text,
  created_at            timestamptz not null default now(),
  last_login_at         timestamptz not null default now()
);

-- One row per (user, provider) — easy to add Slack, GDrive, etc. later.
create table connections (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  provider              text not null,                  -- e.g. 'atlassian'
  status                text not null default 'connected',
  refresh_token_ct      bytea,
  refresh_token_iv      bytea,
  refresh_token_tag     bytea,
  scopes                text,
  external_account_id   text,                           -- atlassian account_id, slack user_id, etc.
  external_email        text,
  metadata              jsonb not null default '{}'::jsonb, -- cloudid, siteUrl, etc.
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, provider)
);

create table conversations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  title                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references conversations(id) on delete cascade,
  role                  text not null check (role in ('user','assistant','tool','system')),
  content               jsonb not null,
  created_at            timestamptz not null default now()
);

create index conversations_user_updated_idx on conversations (user_id, updated_at desc);
create index messages_conversation_created_idx on messages (conversation_id, created_at);
create index connections_user_idx on connections (user_id);
