-- Navigator v1: persist workspace discovery results + Assistants by branch.
--
-- The Setup wizard runs an expensive multi-pass LLM discovery against the
-- Staffbase instance. Before this migration we ran it on every page visit
-- and stored the result only in the user's localStorage. Now the discovery
-- output is persisted server-side, keyed by the Staffbase branch ID, so:
--   - Reopening Navigator Setup loads instantly from cache.
--   - Customers re-run the analysis on demand ("Re-discover" button).
--   - Templates + custom-Assistant flows can read the cached blueprint
--     without re-running discovery to match Pages.
--
-- Branch ID lookup: lib/staffbase.mjs#getBranch() POSTs /branch and reads
-- the returned `id`. Single-branch-per-deployment for the prototype.

create table if not exists workspace_blueprints (
  id                        uuid primary key default gen_random_uuid(),
  staffbase_branch_id       text unique not null,
  staffbase_branch_name     text,
  -- The full discovery payload (channels, posts, pages, groups, workspace,
  -- proposedAssistants, etc.). JSONB so we can index sub-fields later
  -- without a schema migration.
  blueprint                 jsonb not null,
  -- Parallel array to blueprint->'pages': [{pageId, vector: number[1536]}].
  -- Kept separate so we can rebuild embeddings without re-running the LLM
  -- discovery, or rebuild the discovery without re-embedding.
  page_embeddings           jsonb not null default '[]'::jsonb,
  discovered_at             timestamptz not null default now(),
  last_refreshed_by_user_id uuid references users(id) on delete set null
);

-- Persisted Navigator Assistants. Source of truth from now on; localStorage
-- in the existing useConfigStore becomes a read-through cache.
--
-- `source` is provenance — useful for future "who created what" auditing
-- and for distinguishing setup-wizard output from custom AI creations.
create table if not exists navigator_assistants (
  id                        uuid primary key default gen_random_uuid(),
  staffbase_branch_id       text not null references workspace_blueprints(staffbase_branch_id) on delete cascade,
  name                      text not null,
  icon                      text,
  description               text,
  instructions              text not null,
  audience                  jsonb not null default '{"everyone":true,"roles":[],"locations":[]}'::jsonb,
  knowledge_base_ids        text[] not null default '{}',
  mcp_connector_ids         text[] not null default '{}',
  external_agent_ids        text[] not null default '{}',
  status                    text not null default 'active',
  source                    text not null,
  template_id               text,
  created_by_user_id        uuid references users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists navigator_assistants_branch_idx
  on navigator_assistants(staffbase_branch_id);
