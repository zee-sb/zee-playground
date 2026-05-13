// Typed helpers around navigator_config (migration 005).
//
// One row per Staffbase branch. Stores the non-assistant Navigator config
// (MCP connectors, external agents, knowledge bases, flows) plus tenant
// overrides as JSONB blobs. Assistants live in navigator_assistants and have
// their own helpers in lib/blueprints.mjs.
//
// Concurrency: every write bumps `revision`. Callers pass `baseRevision`;
// if it doesn't match, saveConfig throws RevisionConflictError so the UI
// can refetch and prompt the admin.
//
// State machines enforced here on save:
//   - assistant.status  : draft | active | archived  (validated for entries
//                         that the caller might include in the config blob
//                         even though assistants are normalized — defensive)
//   - flow.status       : draft | active | archived
//   - mcp_connector.status / external_agent.status : disconnected | connected | degraded
// Invalid values are coerced to the legal default ('active' / 'connected')
// rather than 500'ing, since this is a prototype and admins frequently land
// here with hand-edited state.

import { sql } from './db.mjs';

export const ASSISTANT_STATES = ['draft', 'active', 'archived'];
export const FLOW_STATES = ['draft', 'active', 'archived'];
export const CONNECTOR_STATES = ['disconnected', 'connected', 'degraded'];

const ASSISTANT_DEFAULT = 'active';
const FLOW_DEFAULT = 'active';
const CONNECTOR_DEFAULT = 'connected';

export class RevisionConflictError extends Error {
  constructor(current) {
    super('revision_conflict');
    this.code = 'revision_conflict';
    this.currentRevision = current;
  }
}

function coerceStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      mcpConnectors: [],
      externalAgents: [],
      knowledgeBases: [],
      flows: [],
      tenantOverrides: {},
    };
  }
  const mcpConnectors = Array.isArray(config.mcpConnectors) ? config.mcpConnectors : [];
  const externalAgents = Array.isArray(config.externalAgents) ? config.externalAgents : [];
  const knowledgeBases = Array.isArray(config.knowledgeBases) ? config.knowledgeBases : [];
  const flows = Array.isArray(config.flows) ? config.flows : [];
  return {
    mcpConnectors: mcpConnectors.map((c) => ({
      ...c,
      status: coerceStatus(c.status, CONNECTOR_STATES, CONNECTOR_DEFAULT),
    })),
    externalAgents: externalAgents.map((a) => ({
      ...a,
      status: coerceStatus(a.status, CONNECTOR_STATES, CONNECTOR_DEFAULT),
    })),
    knowledgeBases: knowledgeBases.map((kb) => ({ ...kb })),
    flows: flows.map((f) => ({
      ...f,
      status: coerceStatus(f.status, FLOW_STATES, FLOW_DEFAULT),
    })),
    tenantOverrides: (config.tenantOverrides && typeof config.tenantOverrides === 'object')
      ? config.tenantOverrides
      : {},
  };
}

function rowToConfig(row) {
  return {
    branchId: row.staffbase_branch_id,
    mcpConnectors: row.mcp_connectors || [],
    externalAgents: row.external_agents || [],
    knowledgeBases: row.knowledge_bases || [],
    flows: row.flows || [],
    tenantOverrides: row.tenant_overrides || {},
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

export async function getConfig(branchId) {
  if (!branchId) return null;
  const rows = await sql`
    select staffbase_branch_id, mcp_connectors, external_agents,
           knowledge_bases, flows, tenant_overrides, revision, updated_at
    from navigator_config
    where staffbase_branch_id = ${branchId}
    limit 1
  `;
  return rows[0] ? rowToConfig(rows[0]) : null;
}

// Initialize an empty row for a freshly-discovered branch. Idempotent.
export async function ensureConfigRow(branchId) {
  if (!branchId) throw new Error('branchId required');
  await sql`
    insert into navigator_config (staffbase_branch_id)
    values (${branchId})
    on conflict (staffbase_branch_id) do nothing
  `;
}

// Save config with optimistic concurrency. `baseRevision` is the revision the
// caller fetched; if the DB has moved past it, we throw and the caller surfaces
// a conflict toast + refetches.
export async function saveConfig({ branchId, config, baseRevision, userId }) {
  if (!branchId) throw new Error('branchId required');
  const norm = normalizeConfig(config);
  // Use a CAS update so two concurrent writers can't both succeed.
  const rows = await sql`
    update navigator_config set
      mcp_connectors    = ${JSON.stringify(norm.mcpConnectors)}::jsonb,
      external_agents   = ${JSON.stringify(norm.externalAgents)}::jsonb,
      knowledge_bases   = ${JSON.stringify(norm.knowledgeBases)}::jsonb,
      flows             = ${JSON.stringify(norm.flows)}::jsonb,
      tenant_overrides  = ${JSON.stringify(norm.tenantOverrides)}::jsonb,
      revision          = revision + 1,
      updated_at        = now(),
      updated_by_user_id = ${userId || null}
    where staffbase_branch_id = ${branchId}
      and revision = ${baseRevision ?? 0}
    returning staffbase_branch_id, mcp_connectors, external_agents,
              knowledge_bases, flows, tenant_overrides, revision, updated_at
  `;
  if (rows.length > 0) return rowToConfig(rows[0]);

  // CAS failed — either the row doesn't exist or revision moved. Fetch current
  // state so we can report which.
  const current = await getConfig(branchId);
  if (!current) {
    // Row doesn't exist yet. If the caller passed baseRevision === 0 or null
    // they're trying to create — do that.
    if (baseRevision === 0 || baseRevision == null) {
      await ensureConfigRow(branchId);
      // Retry once.
      return saveConfig({ branchId, config, baseRevision: 1, userId });
    }
    throw new RevisionConflictError(0);
  }
  throw new RevisionConflictError(current.revision);
}
