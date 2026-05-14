// Automated migration runner. Discovers all .sql files under db/migrations/,
// applies any that aren't yet recorded in the `schema_migrations` tracking
// table, in lexicographic filename order. Each migration runs in its own
// transaction. Designed to be safe to run on every deploy.
//
//   node db/migrate.mjs                              ← apply pending migrations
//   node db/migrate.mjs --status                     ← show applied / pending without changing anything
//   node db/migrate.mjs --baseline-existing          ← mark ALL current files as applied without running (use on a pre-existing DB once)
//   node db/migrate.mjs --baseline-up-to=009_…sql    ← mark files up to and including this one as applied without running
//
// Safety:
// - `pg_advisory_lock` prevents two concurrent runners (parallel CI builds)
//   from racing on the same DB.
// - Each migration is wrapped in BEGIN / COMMIT; a failure rolls back and
//   stops the run, so a partial migration never lands.
// - The SQL splitter respects `$$ … $$` dollar-quoted blocks so DO blocks
//   and pl/pgsql functions with internal semicolons don't get torn apart.
// - When DATABASE_URL is absent, the runner exits 0 (not 1). Lets Vercel
//   preview deploys without a configured DB still succeed.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* file may not exist */ }
}
loadEnv('.env.local');
loadEnv('.env');

const dbUrl = process.env.DATABASE_URL_UNPOOLED
  || process.env.POSTGRES_URL_NON_POOLING
  || process.env.DATABASE_URL
  || process.env.POSTGRES_URL;

if (!dbUrl) {
  // Intentional exit 0: this lets `vercel-build` invoke the migration step
  // unconditionally — preview deploys without a configured DB still build.
  console.log('[migrate] No DATABASE_URL configured — skipping.');
  process.exit(0);
}

const args = process.argv.slice(2);
const statusOnly = args.includes('--status');
const baselineAll = args.includes('--baseline-existing');
const baselineUpToArg = args.find((a) => a.startsWith('--baseline-up-to='));
const baselineUpTo = baselineUpToArg ? baselineUpToArg.split('=')[1] : null;

const migrationsDir = resolve('db/migrations');
const allFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (allFiles.length === 0) {
  console.log('[migrate] No migrations found.');
  process.exit(0);
}

// Splitter that respects $$ dollar-quoted blocks (pl/pgsql DO, functions, etc).
// Statements end on a top-level `;`. Anything between matching `$$…$$` pairs is
// preserved verbatim. Single-line `--` comments are stripped; block comments
// are not handled (none of our migrations use them).
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let inDollar = false;
  let i = 0;
  // Pre-strip line comments so they don't accidentally hide a `$$` or `;`.
  const cleaned = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
  while (i < cleaned.length) {
    if (cleaned[i] === '$' && cleaned[i + 1] === '$') {
      inDollar = !inDollar;
      buf += '$$';
      i += 2;
      continue;
    }
    if (cleaned[i] === ';' && !inDollar) {
      const trimmed = buf.trim();
      if (trimmed) out.push(trimmed);
      buf = '';
      i += 1;
      continue;
    }
    buf += cleaned[i];
    i += 1;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

const pool = new Pool({ connectionString: dbUrl });

async function main() {
  // Bootstrap tracking table — idempotent.
  await pool.query(`
    create table if not exists schema_migrations (
      filename     text primary key,
      applied_at   timestamptz not null default now()
    )
  `);

  // Advisory lock so two concurrent runners don't race. The key is an
  // arbitrary stable hash — use the deterministic value 7212301 (sha-ish).
  await pool.query(`select pg_advisory_lock(7212301)`);
  try {
    const appliedRows = (await pool.query('select filename from schema_migrations')).rows;
    const applied = new Set(appliedRows.map((r) => r.filename));

    // Detect "pre-existing DB without tracking" — first run after introducing
    // this runner. The user must explicitly opt in to baselining so we don't
    // accidentally mark unapplied migrations as applied.
    if (applied.size === 0) {
      const { rows: usersCheck } = await pool.query(
        `select 1 from information_schema.tables where table_schema='public' and table_name='users' limit 1`
      );
      if (usersCheck.length > 0 && !baselineAll && !baselineUpTo && !statusOnly) {
        console.error('[migrate] Existing schema detected (public.users exists) but the schema_migrations tracking table is empty.');
        console.error('         Run one of these once to seed the tracker, then re-run npm run db:migrate:');
        console.error('           npm run db:migrate -- --baseline-existing');
        console.error(`           npm run db:migrate -- --baseline-up-to=<filename>`);
        process.exit(1);
      }
    }

    // Apply baseline marks (no SQL executed) if requested.
    if (baselineAll || baselineUpTo) {
      const toBaseline = baselineUpTo
        ? allFiles.filter((f) => f <= baselineUpTo)
        : allFiles;
      for (const f of toBaseline) {
        if (applied.has(f)) continue;
        await pool.query(
          `insert into schema_migrations (filename) values ($1) on conflict do nothing`,
          [f]
        );
        applied.add(f);
        console.log(`[baseline] ${f}  (marked applied, not executed)`);
      }
    }

    const pending = allFiles.filter((f) => !applied.has(f));

    if (statusOnly) {
      console.log('[migrate] Applied:');
      for (const f of allFiles.filter((f) => applied.has(f))) console.log(`  ✓ ${f}`);
      console.log('[migrate] Pending:');
      if (pending.length === 0) console.log('  (none)');
      else for (const f of pending) console.log(`  • ${f}`);
      return;
    }

    if (pending.length === 0) {
      console.log('[migrate] Up to date.');
      return;
    }

    console.log(`[migrate] Applying ${pending.length} migration(s):`);
    for (const filename of pending) {
      const path = resolve(migrationsDir, filename);
      const sql = readFileSync(path, 'utf8');
      const stmts = splitStatements(sql);
      console.log(`  → ${filename}  (${stmts.length} statement${stmts.length === 1 ? '' : 's'})`);
      await pool.query('begin');
      try {
        for (const stmt of stmts) {
          await pool.query(stmt);
        }
        await pool.query(
          `insert into schema_migrations (filename) values ($1) on conflict do nothing`,
          [filename]
        );
        await pool.query('commit');
        console.log('    ✓ applied');
      } catch (err) {
        await pool.query('rollback').catch(() => {});
        console.error(`    ✗ ${err.message}`);
        throw err;
      }
    }

    console.log('[migrate] Done.');
  } finally {
    await pool.query(`select pg_advisory_unlock(7212301)`).catch(() => {});
  }
}

try {
  await main();
  await pool.end();
} catch (err) {
  console.error('[migrate] FAILED:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
}
