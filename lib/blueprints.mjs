// Typed helpers around the Navigator persistence layer.
//
// Two tables backing every server-side Navigator action:
//   - workspace_blueprints   — cached discovery results, one per branch.
//   - navigator_assistants   — every Assistant the customer has applied or
//                              created. DB is canonical; client localStorage
//                              is a read-through cache.
//
// v7 schema: assistants reference a single `connector_ids text[]` column
// (no more split between mcp_connector_ids / external_agent_ids /
// knowledge_base_ids).

import { sql } from './db.mjs';

// ── workspace_blueprints ────────────────────────────────────────────────────

export async function getBlueprint(branchId) {
  if (!branchId) return null;
  const rows = await sql`
    select id, staffbase_branch_id, staffbase_branch_name,
           blueprint, page_embeddings, discovered_at
    from workspace_blueprints
    where staffbase_branch_id = ${branchId}
    limit 1
  `;
  return rows[0] || null;
}

// Targeted partial update — sets a single nested path in the `blueprint`
// JSONB column without rewriting the whole document. Used by the Home tab's
// system-prompt editor so a one-field edit doesn't have to round-trip the
// entire discovery payload.
export async function patchBlueprintField(branchId, pathArr, value) {
  if (!branchId) throw new Error('branchId is required');
  if (!Array.isArray(pathArr) || pathArr.length === 0) {
    throw new Error('pathArr must be a non-empty string array');
  }
  // jsonb_set wants a Postgres text[] like '{workspace,mainInstructions}'.
  const pgPath = '{' + pathArr.map((seg) => String(seg).replace(/[{},\\]/g, '\\$&')).join(',') + '}';
  const rows = await sql`
    update workspace_blueprints
    set blueprint = jsonb_set(blueprint, ${pgPath}::text[], to_jsonb(${value}::text), true),
        discovered_at = discovered_at
    where staffbase_branch_id = ${branchId}
    returning id
  `;
  if (rows.length === 0) throw new Error('blueprint_not_found');
  return rows[0];
}

export async function saveBlueprint({ branchId, branchName, blueprint, pageEmbeddings, userId }) {
  if (!branchId) throw new Error('branchId is required');
  const rows = await sql`
    insert into workspace_blueprints (
      staffbase_branch_id, staffbase_branch_name, blueprint,
      page_embeddings, last_refreshed_by_user_id, discovered_at
    )
    values (
      ${branchId}, ${branchName || null}, ${JSON.stringify(blueprint)}::jsonb,
      ${JSON.stringify(pageEmbeddings || [])}::jsonb, ${userId || null}, now()
    )
    on conflict (staffbase_branch_id) do update set
      staffbase_branch_name     = excluded.staffbase_branch_name,
      blueprint                 = excluded.blueprint,
      page_embeddings           = excluded.page_embeddings,
      last_refreshed_by_user_id = excluded.last_refreshed_by_user_id,
      discovered_at             = now()
    returning id, discovered_at
  `;
  return rows[0];
}

// ── navigator_assistants ────────────────────────────────────────────────────

function rowToAssistant(r) {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon || '✨',
    description: r.description || '',
    instructions: r.instructions || '',
    audience: r.audience || { everyone: true, groups: [], roles: [], locations: [] },
    connectorIds: r.connector_ids || [],
    status: r.status || 'active',
    source: r.source || 'manual',
    templateId: r.template_id || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listAssistants(branchId) {
  if (!branchId) return [];
  const rows = await sql`
    select id, name, icon, description, instructions, audience,
           connector_ids, status, source, template_id, created_at, updated_at
    from navigator_assistants
    where staffbase_branch_id = ${branchId}
    order by created_at asc
  `;
  return rows.map(rowToAssistant);
}

export async function createAssistant({ branchId, assistant, source, templateId, userId }) {
  if (!branchId) throw new Error('branchId required');
  if (!assistant?.name) throw new Error('assistant.name required');
  const audience = assistant.audience || { everyone: true, groups: [], roles: [], locations: [] };
  const rows = await sql`
    insert into navigator_assistants (
      staffbase_branch_id, name, icon, description, instructions, audience,
      connector_ids, status, source, template_id, created_by_user_id
    ) values (
      ${branchId},
      ${assistant.name},
      ${assistant.icon || '✨'},
      ${assistant.description || ''},
      ${assistant.instructions || ''},
      ${JSON.stringify(audience)}::jsonb,
      ${assistant.connectorIds || []},
      ${assistant.status || 'active'},
      ${source || 'manual'},
      ${templateId || null},
      ${userId || null}
    )
    returning id, name, icon, description, instructions, audience,
              connector_ids, status, source, template_id, created_at, updated_at
  `;
  return rowToAssistant(rows[0]);
}

export async function updateAssistant({ branchId, id, patch }) {
  if (!branchId || !id) throw new Error('branchId + id required');
  const rows = await sql`
    update navigator_assistants set
      name              = coalesce(${patch.name ?? null}, name),
      icon              = coalesce(${patch.icon ?? null}, icon),
      description       = coalesce(${patch.description ?? null}, description),
      instructions      = coalesce(${patch.instructions ?? null}, instructions),
      audience          = coalesce(${patch.audience ? JSON.stringify(patch.audience) : null}::jsonb, audience),
      connector_ids     = coalesce(${patch.connectorIds ?? null}, connector_ids),
      status            = coalesce(${patch.status ?? null}, status),
      updated_at        = now()
    where id = ${id} and staffbase_branch_id = ${branchId}
    returning id, name, icon, description, instructions, audience,
              connector_ids, status, source, template_id, created_at, updated_at
  `;
  return rows[0] ? rowToAssistant(rows[0]) : null;
}

export async function deleteAssistant({ branchId, id }) {
  if (!branchId || !id) throw new Error('branchId + id required');
  const rows = await sql`
    delete from navigator_assistants
    where id = ${id} and staffbase_branch_id = ${branchId}
    returning id
  `;
  return rows.length > 0;
}
