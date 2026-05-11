-- Staffbase Companion — initial schema
-- Run once against your Neon (or Vercel Postgres) database.
--
-- Tables:
--   users             — one row per Atlassian account that has signed in
--   oauth_tokens      — encrypted refresh token + cloudid for each user
--   conversations     — chat history grouping
--   messages          — individual user/assistant/tool messages
--   tool_cache        — cached MCP tools/list output

create extension if not exists pgcrypto;

create table if not exists users (
  id                    uuid primary key default gen_random_uuid(),
  atlassian_account_id  text unique not null,
  email                 text not null,
  display_name          text,
  avatar_url            text,
  created_at            timestamptz not null default now(),
  last_login_at         timestamptz not null default now()
);

create table if not exists oauth_tokens (
  user_id               uuid primary key references users(id) on delete cascade,
  refresh_token_ct      bytea not null,
  refresh_token_iv      bytea not null,
  refresh_token_tag     bytea not null,
  scopes                text not null,
  cloudid               text,
  site_url              text,
  site_name             text,
  updated_at            timestamptz not null default now()
);

create table if not exists conversations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  title                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references conversations(id) on delete cascade,
  role                  text not null check (role in ('user','assistant','tool','system')),
  content               jsonb not null,
  created_at            timestamptz not null default now()
);

create table if not exists tool_cache (
  key                   text primary key,
  tools_json            jsonb not null,
  updated_at            timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx on conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on messages (conversation_id, created_at);
