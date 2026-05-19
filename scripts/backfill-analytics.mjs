// Backfill Navigator Analytics — walks every conversation that lacks a
// conversation_summary row (or whose computed_version is stale) and writes
// summary + evals.
//
//   node --env-file=.env.local scripts/backfill-analytics.mjs
//
// Idempotent. Safe to re-run; only writes for conversations that need it.
// Pass --all to force a recompute regardless of computed_version.

import { sql, dbConfigured } from '../lib/db.mjs';
import { recomputeConversation, COMPUTED_VERSION } from '../lib/analytics/store.mjs';

if (!dbConfigured()) {
  console.error('DATABASE_URL is not set — cannot backfill.');
  process.exit(1);
}

const force = process.argv.includes('--all');

console.log(`[backfill-analytics] mode=${force ? 'force-all' : 'stale-only'}, target_version=${COMPUTED_VERSION}`);

// Pick conversations to process. Without --all: those missing summary, or whose
// summary version is older than COMPUTED_VERSION. With --all: every conversation.
const rows = force
  ? await sql`select id from conversations order by created_at asc`
  : await sql`
      select c.id
      from conversations c
      left join conversation_summary s on s.conversation_id = c.id
      where s.conversation_id is null or s.computed_version <> ${COMPUTED_VERSION}
      order by c.created_at asc
    `;

console.log(`[backfill-analytics] ${rows.length} conversation(s) to process`);

let ok = 0;
let failed = 0;
let skipped = 0;
for (const [i, row] of rows.entries()) {
  try {
    const messages = await sql`
      select 1 from messages where conversation_id = ${row.id} limit 1
    `;
    if (messages.length === 0) {
      skipped++;
      continue;
    }
    await recomputeConversation(row.id);
    ok++;
    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${rows.length} processed (ok=${ok}, skipped=${skipped}, failed=${failed})`);
    }
  } catch (err) {
    failed++;
    console.warn(`  fail conversation ${row.id}: ${err.message}`);
  }
}

console.log(`[backfill-analytics] done. ok=${ok}, skipped=${skipped}, failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
