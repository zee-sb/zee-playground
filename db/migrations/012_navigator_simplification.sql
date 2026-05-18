-- Navigator Simplification: collapse 5 concepts → 3 (Expert / Workflow / Connection).
--
-- Vocabulary changes:
--   Assistant  → Expert
--   Flow       → Workflow
--   Connector  → Connection  (the umbrella)
--   kind: mcp  → toolkit
--   kind: agent → handoff
--   kind: kb   → search
--
-- This migration touches:
--   1. navigator_assistants table  → navigator_experts
--      - connector_ids column      → connection_ids
--      - FK index renamed
--   2. navigator_config columns:
--      - connectors JSONB          → connections
--      - flows JSONB               → workflows
--      - Inside connections[].kind: mcp/agent/kb → toolkit/handoff/search
--      - Inside workflows[].tools[].connectorId is just an id; no value change
--        needed there (the IDs like 'hr_portal' carry no kind information).
--   3. workspace_blueprints.blueprint JSONB:
--      - proposedAssistants → proposedExperts (if present)
--
-- Hard cutover. No backwards compatibility. The prototype's seed will
-- re-populate canonical demo data on next mount.

-- ── 1. navigator_assistants → navigator_experts ─────────────────────────────

alter table if exists navigator_assistants
  rename column connector_ids to connection_ids;

alter table if exists navigator_assistants
  rename to navigator_experts;

-- Recreate the index under the new name. Old name lingers on the renamed
-- table; rename it explicitly for clarity.
alter index if exists navigator_assistants_branch_idx
  rename to navigator_experts_branch_idx;

-- ── 2. navigator_config: rename JSONB columns + remap kind values ───────────

alter table if exists navigator_config
  rename column connectors to connections;

alter table if exists navigator_config
  rename column flows to workflows;

-- Remap kind values inside each connection element.
-- mcp → toolkit, agent → handoff, kb → search.
update navigator_config
set connections = (
  select coalesce(jsonb_agg(
    case
      when elem->>'kind' = 'mcp'   then jsonb_set(elem, '{kind}', '"toolkit"'::jsonb)
      when elem->>'kind' = 'agent' then jsonb_set(elem, '{kind}', '"handoff"'::jsonb)
      when elem->>'kind' = 'kb'    then jsonb_set(elem, '{kind}', '"search"'::jsonb)
      else elem
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(connections) elem
)
where jsonb_typeof(connections) = 'array';

-- ── 3. workspace_blueprints: rename proposedAssistants → proposedExperts ────

update workspace_blueprints
set blueprint = blueprint
  - 'proposedAssistants'
  || jsonb_build_object('proposedExperts', blueprint->'proposedAssistants')
where blueprint ? 'proposedAssistants';
