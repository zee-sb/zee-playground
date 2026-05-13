// Run a single migration file via the Neon HTTP driver.
// Usage: node scripts/run-migration.mjs db/migrations/004_navigator_blueprints.sql
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/run-migration.mjs <file>'); process.exit(1); }

const sql = neon(url);
const migration = readFileSync(file, 'utf8');

// Split on semicolons that end a statement (followed by newline). Strip
// SQL line comments so they don't confuse the splitter.
const cleaned = migration
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');
const stmts = cleaned.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);

// Need a transaction-friendly client for raw DDL — the HTTP `sql` tagged
// template is for parameterized queries; ad-hoc CREATE/INSERT statements
// without bindings have to use the raw protocol.
import { Client } from '@neondatabase/serverless';
const client = new Client(url);
await client.connect();
try {
  for (const stmt of stmts) {
    console.log('→', stmt.split('\n')[0].slice(0, 80) + (stmt.length > 80 ? '…' : ''));
    await client.query(stmt + ';');
  }
} finally {
  await client.end();
}

const rows = await sql`select table_name from information_schema.tables where table_schema='public' order by table_name`;
console.log('\nTables in DB:', rows.map((r) => r.table_name).join(', '));
