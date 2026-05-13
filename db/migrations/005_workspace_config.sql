-- Companion v4: server-side Navigator config (the non-assistant entities).
--
-- Why this exists:
--   workspace_blueprints (004)  — caches discovery output (one row per
--                                 Staffbase branch). What the workspace IS.
--   navigator_assistants (004)  — Assistants as row-per-entity. Already the
--                                 source of truth; localStorage is a cache.
--   navigator_config (this)     — everything else the Studio configures:
--                                 MCP connectors, external agents, knowledge
--                                 bases, flows, tenant overrides. JSONB blob
--                                 because the consumer contract (useConfigStore)
--                                 round-trips the whole shape unchanged, writes
--                                 are coarse admin edits, and the schema is
--                                 still shifting.
--   `revision`                  — bumped on every write. PUTs include the
--                                 baseRevision they read; server returns 409
--                                 if it has moved. Lets two admins edit at
--                                 once without silent loss.
--
-- State machines surfaced here (canonical values, enforced by lib/workspace-config.mjs):
--   - assistant.status  : draft | active | archived
--   - flow.status       : draft | active | archived
--   - mcp_connector.status / external_agent.status : disconnected | connected | degraded
--
-- One row per Staffbase branch (singleton for the prototype).

create table if not exists navigator_config (
  staffbase_branch_id   text primary key
                          references workspace_blueprints(staffbase_branch_id)
                          on delete cascade,
  mcp_connectors        jsonb not null default '[]'::jsonb,
  external_agents       jsonb not null default '[]'::jsonb,
  knowledge_bases       jsonb not null default '[]'::jsonb,
  flows                 jsonb not null default '[]'::jsonb,
  -- Admin-controlled overrides on top of blueprint.workspace.* (companyName,
  -- brandColor, workspaceUrl). Sparse — only the fields the admin set.
  tenant_overrides      jsonb not null default '{}'::jsonb,
  revision              bigint not null default 1,
  updated_at            timestamptz not null default now(),
  updated_by_user_id    uuid references users(id) on delete set null
);
