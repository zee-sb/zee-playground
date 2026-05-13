// Quick DB inspection: node scripts/db-query.mjs "select 1"
import { Client } from '@neondatabase/serverless';
const url = process.env.DATABASE_URL;
const query = process.argv[2];
if (!url || !query) { console.error('Usage: DATABASE_URL=... node scripts/db-query.mjs "<sql>"'); process.exit(1); }
const c = new Client(url); await c.connect();
const r = await c.query(query);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
