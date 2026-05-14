-- Multi-tenant Studio + Companion: registry of Staffbase workspaces.
--
-- Before this migration, exactly one Staffbase workspace was reachable per
-- deployment via the STAFFBASE_API_TOKEN env var. This table makes the
-- credential a first-class DB row so the gallery picker can switch between
-- any number of registered workspaces. `branch_id` is the workspace's
-- staffbase branch.id (returned by POST /branch on the live API) — the same
-- value that workspace_blueprints / navigator_config / navigator_assistants
-- already key on, so no existing FKs change.
--
-- API token is encrypted at rest with AES-256-GCM (lib/crypto.mjs), reusing
-- the same TOKEN_ENC_KEY + column shape as connections.refresh_token_*.

create table if not exists staffbase_tenants (
  branch_id            text primary key,
  display_name         text not null,
  base_url             text not null,
  workspace_url        text,
  api_token_ct         bytea not null,
  api_token_iv         bytea not null,
  api_token_tag        bytea not null,
  brand_color          text,
  created_by_user_id   uuid references users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists staffbase_tenants_created_idx
  on staffbase_tenants(created_at);
