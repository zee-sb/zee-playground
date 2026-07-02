// READ-ONLY inspection of navigator_experts + navigator_config on production.
// Usage: node db/inspect-experts.mjs
import { readFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

function loadEnv(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
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

const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = new Pool({ connectionString: url });

// 1) Branches
const branches = await pool.query(
  `select staffbase_branch_id, staffbase_branch_name from workspace_blueprints order by staffbase_branch_name`
);
console.log('=== BRANCHES (workspace_blueprints) ===');
for (const b of branches.rows) console.log(`  ${b.staffbase_branch_id}  ${b.staffbase_branch_name}`);

// 2) Experts grouped by branch
const experts = await pool.query(
  `select staffbase_branch_id, id, name, status, source, connection_ids, created_at
   from navigator_experts order by staffbase_branch_id, created_at asc`
);
console.log(`\n=== EXPERTS (navigator_experts) — total ${experts.rows.length} ===`);
let cur = null;
for (const e of experts.rows) {
  if (e.staffbase_branch_id !== cur) {
    cur = e.staffbase_branch_id;
    console.log(`\n-- branch ${cur} --`);
  }
  const conns = Array.isArray(e.connection_ids) ? e.connection_ids.join(',') : e.connection_ids;
  console.log(`  [${e.status}] ${e.name.padEnd(28)} src=${(e.source||'').padEnd(8)} conns=[${conns}] ${e.created_at.toISOString?.() || e.created_at}  id=${e.id}`);
}

// 3) Duplicate expert names per branch
const dups = await pool.query(
  `select staffbase_branch_id, name, count(*) n
   from navigator_experts group by staffbase_branch_id, name having count(*) > 1
   order by n desc`
);
console.log(`\n=== DUPLICATE EXPERT NAMES (same branch) ===`);
if (!dups.rows.length) console.log('  (none)');
for (const d of dups.rows) console.log(`  ${d.n}x  "${d.name}"  branch=${d.staffbase_branch_id}`);

// 4) navigator_config connections per branch (id/name/provider/status)
const cfg = await pool.query(`select staffbase_branch_id, connections, tenant_overrides, revision from navigator_config`);
console.log(`\n=== NAVIGATOR_CONFIG connections per branch ===`);
for (const row of cfg.rows) {
  const conns = Array.isArray(row.connections) ? row.connections : [];
  const seedV = row.tenant_overrides?.seedVersion;
  console.log(`\n-- branch ${row.staffbase_branch_id}  rev=${row.revision}  seedVersion=${seedV} --`);
  for (const cn of conns) console.log(`  ${(cn.id||'').padEnd(22)} kind=${(cn.kind||'').padEnd(8)} provider=${cn.provider||'-'} status=${cn.status}`);
}

await pool.end();
