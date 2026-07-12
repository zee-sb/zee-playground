// Build the knowledge_chunks retrieval index. Wired into `vercel-build` so the
// corpus is warm the instant a deploy goes live (no lazy-on-first-query tax on
// the demo's opening question), and runnable locally / on-demand.
//
//   node --env-file=.env.local scripts/index-knowledge.mjs            # all
//   node --env-file=.env.local scripts/index-knowledge.mjs --kb-only  # skip Staffbase
//
// Build-safety contract: this script ALWAYS exits 0. A missing DATABASE_URL /
// OPENAI_API_KEY (e.g. a preview deploy) or a flaky Staffbase API must never
// fail the Vercel build — KB-only indexing already ships a working demo, and
// api/reindex.mjs can refresh later.

import { readFileSync } from 'node:fs';
import { indexAll } from '../lib/knowledge-index.mjs';
import { dbConfigured } from '../lib/db.mjs';

// Convenience .env loader so a bare `node scripts/index-knowledge.mjs` works in
// local dev (Vercel build already has env in process.env). Mirrors db/migrate.mjs.
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* file may not exist */ }
}
loadEnv('.env.local');
loadEnv('.env');

async function main() {
  if (!dbConfigured()) {
    console.log('[index-knowledge] No DATABASE_URL — skipping (build continues).');
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log('[index-knowledge] No OPENAI_API_KEY — skipping embeddings (build continues).');
    return;
  }
  const kbOnly = process.argv.includes('--kb-only');
  const t0 = Date.now();
  const res = await indexAll({ includeStaffbase: !kbOnly });
  const kb = res.kb || {};
  console.log(`[index-knowledge] KB: ${kb.docs} docs → ${kb.chunks} chunks`);
  for (const e of res.ensured || []) {
    console.log(`[index-knowledge] knowledge connection ${e.branchId}: ${e.ensured ? 'ADDED' : (e.skipped || 'already present')}`);
  }
  for (const s of res.staffbase || []) {
    console.log(`[index-knowledge] Staffbase ${s.branchId}: ${s.chunks ?? 0} chunks${s.error ? ` (error: ${s.error})` : s.skipped ? ` (skipped: ${s.skipped})` : ''}`);
  }
  console.log(`[index-knowledge] done in ${Date.now() - t0}ms`);
}

main()
  .catch((err) => { console.error('[index-knowledge] failed (build continues):', err.message); })
  .finally(() => process.exit(0));
