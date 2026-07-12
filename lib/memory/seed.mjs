// Demo seed for the "knows you + proactive" pillars. Seeds believable memory
// and a primed briefing cache for a known demo user so the "it remembers me"
// and "welcome back" moments always land — even if live signals are sparse.
//
// Idempotent: UPSERTs on (user_id, kind, mem_key). Seed rows use source='seed'
// so a later real extraction (source='conversation') cleanly overwrites them,
// and `delete from user_memory where source='seed'` cleans up post-demo.

import { sql, dbConfigured } from '../db.mjs';
import { upsertMemories, saveBriefingCache } from './store.mjs';

// Believable memory for the demo. Values stay generic enough to be plausible
// for a Staffbase PM but concrete enough to feel personal.
const DEMO_MEMORY = [
  { kind: 'fact', mem_key: 'onboarding_buddy', mem_value: 'Onboarding buddy is Lena Vogt (People team)', confidence: 0.8 },
  { kind: 'fact', mem_key: 'workspace', mem_value: 'Works primarily in the Campsite intranet workspace', confidence: 0.75 },
  { kind: 'preference', mem_key: 'answer_style', mem_value: 'Prefers concise answers with a source link', confidence: 0.7 },
  { kind: 'open_item', mem_key: 'open_ticket:NAV-812', mem_value: 'Laptop replacement ticket NAV-812 pending IT approval', status: 'open', confidence: 0.9, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() },
  { kind: 'open_item', mem_key: 'pto:2026-08', mem_value: 'PTO request Aug 12–16 awaiting manager approval', status: 'open', confidence: 0.85, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() },
];

// Cards mirror the /api/companion/briefing shape so the cache is a drop-in
// fallback when live assembly is sparse.
function demoBriefingCards() {
  return [
    { id: 'mem:open_ticket:NAV-812', type: 'open_item', icon: '🎫', tone: 'attention',
      title: 'Still open', body: 'Laptop replacement ticket NAV-812 pending IT approval',
      action: { label: 'Check status', prompt: "What's the latest on my laptop ticket NAV-812?" } },
    { id: 'mem:pto:2026-08', type: 'open_item', icon: '🌴', tone: 'attention',
      title: 'Awaiting approval', body: 'Your PTO request Aug 12–16 is awaiting manager approval',
      action: { label: 'Check status', prompt: "What's the status of my PTO request for August?" } },
  ];
}

// Resolve the demo user(s) by email (there may be duplicates across branches).
async function resolveUsers(email) {
  const rows = await sql`select id, staffbase_branch_id, display_name from users where email ilike ${email}`;
  return rows;
}

export async function seedUserMemory({ email = 'zyad.abuzeid@staffbase.com' } = {}) {
  if (!dbConfigured()) throw new Error('DATABASE_URL not configured');
  const users = await resolveUsers(email);
  if (!users.length) return { email, seeded: 0, note: 'no matching user' };
  for (const u of users) {
    const items = DEMO_MEMORY.map((m) => ({ ...m, source: 'seed' }));
    await upsertMemories(u.id, u.staffbase_branch_id, items);
    await saveBriefingCache(u.id, u.staffbase_branch_id, demoBriefingCards(), 'seed');
  }
  return { email, users: users.length, memories: DEMO_MEMORY.length };
}

// Remove seed rows (post-demo cleanup).
export async function clearSeedMemory({ email = 'zyad.abuzeid@staffbase.com' } = {}) {
  if (!dbConfigured()) return { cleared: 0 };
  const users = await resolveUsers(email);
  for (const u of users) {
    await sql`delete from user_memory where user_id = ${u.id} and source = 'seed'`;
    await sql`delete from user_briefing where user_id = ${u.id} and source = 'seed'`;
  }
  return { email, users: users.length };
}
