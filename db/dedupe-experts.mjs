// One-time cleanup: navigator_experts accumulated duplicate seed rows on prod
// because reseed's delete-then-insert raced across concurrent client boots
// (fixed in api/navigator-config.mjs#handleReseed). This restores each branch
// to the canonical seed expert set.
//
// Per branch, inside a transaction:
//   1. delete every source='seed' expert (admin-authored experts are preserved)
//   2. re-insert the canonical seed list from lib/seed.mjs (buildSeedExperts)
//
// Dry-run by default. Pass --apply to commit.
//   node db/dedupe-experts.mjs           # preview
//   node db/dedupe-experts.mjs --apply   # commit

import { readFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv('.env.local');
loadEnv('.env');

const APPLY = process.argv.includes('--apply');
const { buildSeedExperts } = await import('../lib/seed.mjs');
const seedExperts = buildSeedExperts();

const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = new Pool({ connectionString: url });

console.log(APPLY ? '⚙️  APPLY mode — changes will be committed\n' : '🔍 DRY-RUN — no changes (pass --apply to commit)\n');
console.log(`Canonical seed set (${seedExperts.length} experts): ${seedExperts.map((e) => e.name).join(', ')}\n`);

const branches = await pool.query(
  `select staffbase_branch_id b, staffbase_branch_name n from workspace_blueprints order by n`
);

for (const { b: branchId, n: branchName } of branches.rows) {
  const before = await pool.query(
    `select source, count(*)::int n from navigator_experts where staffbase_branch_id=$1 group by source`, [branchId]
  );
  const total = before.rows.reduce((s, r) => s + r.n, 0);
  const seedCount = before.rows.find((r) => r.source === 'seed')?.n || 0;
  const nonSeed = total - seedCount;
  console.log(`── ${branchName} (${branchId})`);
  console.log(`   before: ${total} experts (${seedCount} seed, ${nonSeed} non-seed/manual)`);
  console.log(`   plan:   delete ${seedCount} seed rows → insert ${seedExperts.length} canonical → ${nonSeed + seedExperts.length} total`);

  if (!APPLY) { console.log(''); continue; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`delete from navigator_experts where staffbase_branch_id=$1 and source='seed'`, [branchId]);
    for (const e of seedExperts) {
      await client.query(
        `insert into navigator_experts
           (staffbase_branch_id, name, icon, description, instructions, audience, connection_ids, status, source, template_id)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
        [branchId, e.name, e.icon || '✨', e.description || '', e.instructions || '',
         JSON.stringify(e.audience || { everyone: true, groups: [], roles: [], locations: [] }),
         e.connectionIds || [], e.status || 'active', e.source || 'seed', null]
      );
    }
    await client.query('COMMIT');
    const after = await client.query(`select count(*)::int n from navigator_experts where staffbase_branch_id=$1`, [branchId]);
    console.log(`   ✅ committed — now ${after.rows[0].n} experts\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`   ❌ rolled back: ${err.message}\n`);
  } finally {
    client.release();
  }
}

await pool.end();
