// Seed believable demo memory + a primed briefing for the demo user, so the
// "knows me" and "welcome back" moments always land in a live demo.
//
//   node --env-file=.env.local scripts/seed-user-memory.mjs
//   node --env-file=.env.local scripts/seed-user-memory.mjs --email someone@x.com
//   node --env-file=.env.local scripts/seed-user-memory.mjs --clear
//
// Idempotent. Seed rows use source='seed' and are overwritten by real
// extraction or removed with --clear.

import { readFileSync } from 'node:fs';
import { seedUserMemory, clearSeedMemory } from '../lib/memory/seed.mjs';
import { dbConfigured } from '../lib/db.mjs';

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

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  if (!dbConfigured()) { console.error('DATABASE_URL not set'); process.exit(1); }
  const email = argVal('--email') || 'zyad.abuzeid@staffbase.com';
  if (process.argv.includes('--clear')) {
    console.log('[seed-user-memory] clearing:', await clearSeedMemory({ email }));
  } else {
    console.log('[seed-user-memory] seeded:', await seedUserMemory({ email }));
  }
}

main().catch((e) => { console.error('[seed-user-memory] failed:', e.message); process.exit(1); });
