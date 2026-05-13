-- Companion v6: unify MCP connectors, External Agents, and Knowledge Bases
-- into one Connector concept with a `kind` discriminator.
--
-- Why:
--   The three types are conceptually the same — JSON-RPC servers exposing
--   tools. The split was a UX artifact. Unifying simplifies the orchestrator
--   (one tool-catalog path), the Studio (one Connectors tab), the seed
--   (one list), and the health-check rules (cross-entity rules become
--   intra-entity).
--
-- Hard cutover: no backwards compatibility.
--
-- Connector shape (JSONB element):
--   { id, kind: 'mcp'|'agent'|'kb', catalogId, name, description, endpoint,
--     authMethod, status: 'connected'|'disconnected'|'degraded',
--     domains[], capabilities[], protocol, provider, writeTools[],
--     tools: [{id,name,description}], needsUserContext, source,
--     articleCount, addedAt }

-- ── navigator_config ────────────────────────────────────────────────────────
alter table navigator_config
  add column if not exists connectors jsonb not null default '[]'::jsonb;

-- Drop the three legacy columns. Server-side state is the source of truth;
-- localStorage will be re-seeded on next mount.
alter table navigator_config drop column if exists mcp_connectors;
alter table navigator_config drop column if exists external_agents;
alter table navigator_config drop column if exists knowledge_bases;

-- ── navigator_assistants ────────────────────────────────────────────────────
alter table navigator_assistants
  add column if not exists connector_ids text[] not null default '{}';

alter table navigator_assistants drop column if exists knowledge_base_ids;
alter table navigator_assistants drop column if exists mcp_connector_ids;
alter table navigator_assistants drop column if exists external_agent_ids;
