// One-shot backfill: turn the legacy env-var STAFFBASE_API_TOKEN /
// STAFFBASE_API_BASE into a row in staffbase_tenants.
//
// Run once after applying migration 009 to make the existing workspace
// reachable via the new multi-tenant picker. Subsequent tenants are added
// from the gallery UI.
//
//   node --env-file=.env.local scripts/seed-default-tenant.mjs
//
// Idempotent: re-running upserts on branch_id, so it's safe to run multiple
// times if needed.

import { makeClient } from '../lib/staffbase.mjs';
import { createTenant, getTenantContext } from '../lib/tenants.mjs';
import { dbConfigured } from '../lib/db.mjs';

const BASE = process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api';
const TOKEN = process.env.STAFFBASE_API_TOKEN || '';
const NAME = process.env.STAFFBASE_TENANT_NAME || 'Campsite';

if (!dbConfigured()) {
  console.error('DATABASE_URL is not set — cannot seed tenant.');
  process.exit(1);
}
if (!TOKEN) {
  console.error('STAFFBASE_API_TOKEN is not set — nothing to seed.');
  process.exit(1);
}
if (!process.env.TOKEN_ENC_KEY) {
  console.error('TOKEN_ENC_KEY is not set — required to encrypt the API token at rest.');
  process.exit(1);
}

console.log(`[seed-default-tenant] Verifying token against ${BASE} …`);
let branch;
try {
  const probe = makeClient({ baseUrl: BASE, apiToken: TOKEN });
  branch = await probe.getBranch();
} catch (err) {
  console.error('[seed-default-tenant] /branch lookup failed:', err.message);
  process.exit(1);
}
console.log(`[seed-default-tenant] Branch resolved: ${branch.id} (${branch.name || 'no name'})`);

// Skip if already seeded — createTenant upserts, so we could just call it
// unconditionally, but logging "already present" is friendlier.
const existing = await getTenantContext(branch.id);
if (existing) {
  console.log(`[seed-default-tenant] Tenant ${branch.id} already exists — re-running upsert to refresh credentials.`);
}

const tenant = await createTenant({
  displayName: NAME,
  baseUrl: BASE,
  apiToken: TOKEN,
  brandColor: '#00C7B2',
  userId: null,
});
console.log(`[seed-default-tenant] OK — tenant row: branch=${tenant.branchId} name="${tenant.displayName}" url=${tenant.workspaceUrl}`);
