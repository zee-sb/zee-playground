// Staffbase tenant registry (migration 009).
//
// One row per Staffbase workspace the playground knows about. Holds the
// encrypted API token + base URL so the Studio + Companion can switch
// workspaces from the gallery picker.
//
// Encryption uses the same AES-256-GCM helpers (lib/crypto.mjs) as the
// Atlassian connections table — TOKEN_ENC_KEY is the single key source.

import { sql, dbConfigured } from './db.mjs';
import { encrypt, decrypt } from './crypto.mjs';
import { makeClient } from './staffbase.mjs';

function rowToPublic(row) {
  return {
    branchId: row.branch_id,
    displayName: row.display_name,
    baseUrl: row.base_url,
    workspaceUrl: row.workspace_url,
    brandColor: row.brand_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// List tenants for the picker. Never returns the API token or its ciphertext.
export async function listTenants() {
  if (!dbConfigured()) return [];
  const rows = await sql`
    select branch_id, display_name, base_url, workspace_url, brand_color,
           created_at, updated_at
    from staffbase_tenants
    order by created_at asc
  `;
  return rows.map(rowToPublic);
}

// Resolve a tenant by branch id, decrypting the API token. Returns the shape
// the staffbase AsyncLocalStorage frame expects: { branchId, baseUrl, apiToken,
// displayName, brandColor }.
export async function getTenantContext(branchId) {
  if (!branchId) return null;
  if (!dbConfigured()) return null;
  const rows = await sql`
    select branch_id, display_name, base_url, workspace_url,
           api_token_ct, api_token_iv, api_token_tag, brand_color
    from staffbase_tenants
    where branch_id = ${branchId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const apiToken = decrypt({ ct: row.api_token_ct, iv: row.api_token_iv, tag: row.api_token_tag });
  return {
    branchId: row.branch_id,
    displayName: row.display_name,
    baseUrl: row.base_url,
    workspaceUrl: row.workspace_url,
    brandColor: row.brand_color,
    apiToken,
  };
}

// Used by API routes that accept ?branch= but should fall back to the only
// registered tenant when the caller doesn't supply one. Returns null when
// nothing is registered yet — caller surfaces a clear empty-state error.
export async function resolveBranchId(reqOrUrl) {
  // Accept either a Vercel req (we extract URL ourselves) or an explicit URL.
  let url;
  if (reqOrUrl instanceof URL) url = reqOrUrl;
  else if (typeof reqOrUrl === 'string') url = new URL(reqOrUrl, 'http://x');
  else if (reqOrUrl?.url) url = new URL(reqOrUrl.url, `http://${reqOrUrl.headers?.host || 'x'}`);
  const fromQuery = url?.searchParams.get('branch');
  if (fromQuery) return fromQuery;
  // Fallback: the only tenant, if there's exactly one. Used during the
  // single-tenant transition cycle and by tools that haven't been updated
  // to pass branch explicitly.
  if (!dbConfigured()) return null;
  const rows = await sql`select branch_id from staffbase_tenants order by created_at asc limit 1`;
  return rows[0]?.branch_id || null;
}

// Ensure the legacy env-var workspace (Campsite by default) is always
// present in the tenant pool so the gallery picker shows it even on a
// fresh DB. Runs at most once per server-process lifetime — on success
// AND on failure, we memoise the attempt so a flaky Staffbase doesn't
// turn listTenants into a hot retry loop. Restart the process to retry.
let defaultTenantSeedAttempted = false;
export async function ensureDefaultTenant() {
  if (defaultTenantSeedAttempted) return;
  defaultTenantSeedAttempted = true;
  const baseUrl = process.env.STAFFBASE_API_BASE;
  const apiToken = process.env.STAFFBASE_API_TOKEN;
  if (!baseUrl || !apiToken) return;
  if (!process.env.TOKEN_ENC_KEY) {
    console.warn('[ensureDefaultTenant] TOKEN_ENC_KEY not set — skipping default-tenant seed');
    return;
  }
  if (!dbConfigured()) return;
  try {
    const probe = makeClient({ baseUrl, apiToken });
    const branch = await probe.getBranch();
    if (!branch?.id) return;
    const existing = await sql`select 1 from staffbase_tenants where branch_id = ${branch.id} limit 1`;
    if (existing.length > 0) return;
    await createTenant({
      displayName: process.env.STAFFBASE_TENANT_NAME || branch.name || 'Campsite',
      baseUrl,
      apiToken,
      brandColor: process.env.STAFFBASE_TENANT_BRAND_COLOR || '#00C7B2',
      userId: null,
    });
    console.log(`[ensureDefaultTenant] Seeded default tenant: branch=${branch.id}`);
  } catch (err) {
    console.warn('[ensureDefaultTenant] seed failed (will not retry until restart):', err.message);
  }
}

// Verify + persist a new tenant. Hits POST /branch with the supplied token
// to confirm it's valid and to capture the canonical branch id + name.
export async function createTenant({ displayName, baseUrl, apiToken, brandColor, userId }) {
  if (!displayName || !baseUrl || !apiToken) {
    throw new Error('displayName, baseUrl, and apiToken are required');
  }
  // Verify the token by calling the live API.
  const probe = makeClient({ baseUrl, apiToken });
  let branch;
  try {
    branch = await probe.getBranch();
  } catch (err) {
    const e = new Error(`tenant_verify_failed: ${err.message}`);
    e.code = 'tenant_verify_failed';
    throw e;
  }
  if (!branch?.id) {
    const e = new Error('tenant_verify_failed: /branch returned no id');
    e.code = 'tenant_verify_failed';
    throw e;
  }

  // Derive the user-visible workspace URL from the base URL (strip trailing
  // /api so the link in the picker points at the intranet root).
  const workspaceUrl = baseUrl.replace(/\/api\/?$/, '').replace(/^https?:\/\//, '');

  const enc = encrypt(apiToken);
  const rows = await sql`
    insert into staffbase_tenants
      (branch_id, display_name, base_url, workspace_url,
       api_token_ct, api_token_iv, api_token_tag,
       brand_color, created_by_user_id)
    values
      (${branch.id}, ${displayName}, ${baseUrl}, ${workspaceUrl},
       ${enc.ct}, ${enc.iv}, ${enc.tag},
       ${brandColor || null}, ${userId || null})
    on conflict (branch_id) do update set
      display_name       = excluded.display_name,
      base_url           = excluded.base_url,
      workspace_url      = excluded.workspace_url,
      api_token_ct       = excluded.api_token_ct,
      api_token_iv       = excluded.api_token_iv,
      api_token_tag      = excluded.api_token_tag,
      brand_color        = coalesce(excluded.brand_color, staffbase_tenants.brand_color),
      updated_at         = now()
    returning branch_id, display_name, base_url, workspace_url, brand_color,
              created_at, updated_at
  `;
  return { ...rowToPublic(rows[0]), branchName: branch.name || null };
}

// PATCH — update displayName and/or rotate the api token. Either field is
// optional; non-supplied fields stay the same.
export async function updateTenant({ branchId, displayName, apiToken, brandColor }) {
  if (!branchId) throw new Error('branchId required');
  if (apiToken) {
    const enc = encrypt(apiToken);
    await sql`
      update staffbase_tenants
      set api_token_ct = ${enc.ct},
          api_token_iv = ${enc.iv},
          api_token_tag = ${enc.tag},
          updated_at = now()
      where branch_id = ${branchId}
    `;
  }
  if (displayName) {
    await sql`
      update staffbase_tenants
      set display_name = ${displayName}, updated_at = now()
      where branch_id = ${branchId}
    `;
  }
  if (brandColor !== undefined) {
    await sql`
      update staffbase_tenants
      set brand_color = ${brandColor}, updated_at = now()
      where branch_id = ${branchId}
    `;
  }
  const rows = await sql`
    select branch_id, display_name, base_url, workspace_url, brand_color,
           created_at, updated_at
    from staffbase_tenants where branch_id = ${branchId}
  `;
  return rows[0] ? rowToPublic(rows[0]) : null;
}

// Cascade delete — removes the tenant credentials plus all per-branch state
// (blueprints, config row, assistants). The workspace_blueprints FK on
// navigator_assistants already cascades, so we just need to delete the
// blueprint + config rows explicitly here.
export async function deleteTenant(branchId) {
  if (!branchId) throw new Error('branchId required');
  await sql`delete from navigator_config where staffbase_branch_id = ${branchId}`;
  await sql`delete from workspace_blueprints where staffbase_branch_id = ${branchId}`;
  const rows = await sql`
    delete from staffbase_tenants where branch_id = ${branchId} returning branch_id
  `;
  return rows.length > 0;
}
