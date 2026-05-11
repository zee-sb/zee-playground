// One-shot migration runner. Reads .env.local for DATABASE_URL and executes
// each statement in the migration file. Idempotent (uses `if not exists`).
//
// Usage: node db/run-migration.mjs db/migrations/001_init.sql

import { readFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

// Tiny .env loader — keep dep-free
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

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error('No DATABASE_URL / POSTGRES_URL in env');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node db/run-migration.mjs <path-to-sql>');
  process.exit(1);
}

// Use unpooled URL for migrations — DDL doesn't play well with pgbouncer.
const unpooled = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || dbUrl;
const pool = new Pool({ connectionString: unpooled });
const text = readFileSync(file, 'utf8');

const statements = text
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Running ${statements.length} statements from ${file}`);
for (const [i, stmt] of statements.entries()) {
  const preview = stmt.split('\n')[0].slice(0, 70);
  try {
    await pool.query(stmt);
    console.log(`  ${i + 1}. OK  ${preview}…`);
  } catch (err) {
    console.error(`  ${i + 1}. FAIL ${preview}…`);
    console.error(`     ${err.message}`);
    await pool.end();
    process.exit(1);
  }
}
await pool.end();
console.log('Migration complete.');
