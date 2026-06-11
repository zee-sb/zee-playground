// Smoke test for the V2 → V1 compiler + tier plumbing.
//
//   node scripts/smoke-v2.mjs
//
// Builds the V2 demo seed, runs lib/v2-compiler.mjs, and asserts the emitted
// connections / workflows / experts match the shapes the live orchestrator
// and lib/workspace-config.mjs validation expect — including a simulation of
// the orchestrator's tool-catalog tier gate. Optionally (read-only, only
// when DATABASE_URL is available) smokes a real `getConfig` load. Never
// writes to the DB.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Load .env/.env.local if present (cheap parser — read-only usage below).
for (const f of ['.env', '.env.local']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { compileV2, mergeCompiledConfig, mergeCompiledExperts, V2_TIERS } = await import('../lib/v2-compiler.mjs');
const {
  normalizeConfig, CONNECTION_KINDS, CONNECTION_STATES, WORKFLOW_STATES, V2_TIER_STATES,
} = await import('../lib/workspace-config.mjs');
const { buildV2Seed } = await import('../src/prototypes/NavigatorV2/useV2Store.js');

let passed = 0;
function ok(label, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log('smoke-v2: compiling the V2 demo seed…');
const state = buildV2Seed();
// Exercise the assist-tier gate: demote ServiceNow's create_ticket to assist.
const sn = state.sources.find((s) => s.id === 'servicenow');
sn.capabilities.find((c) => c.id === 'sn-create').tier = 'assist';

const compiled = compileV2(state);

// ── 1. Connections match the orchestrator's connection contract ────────────
ok('connections emitted for every mapped source', () => {
  assert.equal(compiled.connections.length, state.sources.length);
});
ok('connection kinds/status are valid state-machine values', () => {
  for (const c of compiled.connections) {
    assert.ok(CONNECTION_KINDS.includes(c.kind), `kind ${c.kind}`);
    assert.ok(CONNECTION_STATES.includes(c.status), `status ${c.status}`);
    assert.ok(c.endpoint && c.endpoint.startsWith('/api/'), `endpoint ${c.endpoint}`);
    assert.equal(c.origin, 'v2');
    assert.ok(c.id.startsWith('v2-'));
  }
});
ok('toolkit connections carry the enabledToolNames filter + writeTools subset', () => {
  for (const c of compiled.connections.filter((x) => x.kind === 'toolkit')) {
    assert.ok(Array.isArray(c.enabledToolNames) && c.enabledToolNames.length > 0, c.id);
    for (const w of c.writeTools) assert.ok(c.enabledToolNames.includes(w), `${c.id} write ${w}`);
  }
});
ok('degraded V2 health lands as degraded connection status (SharePoint)', () => {
  const sp = compiled.connections.find((c) => c.id === 'v2-sharepoint');
  assert.equal(sp.status, 'degraded');
  assert.equal(sp.kind, 'search');
});

// ── 2. toolTiers — the orchestrator's dispatch gate input ───────────────────
ok('toolTiers keys are <connectionId>__<toolName> over write tools only', () => {
  const connById = Object.fromEntries(compiled.connections.map((c) => [c.id, c]));
  assert.ok(Object.keys(compiled.toolTiers).length > 0);
  for (const [key, tier] of Object.entries(compiled.toolTiers)) {
    const [connId, tool] = key.split('__');
    assert.ok(V2_TIERS.includes(tier) && V2_TIER_STATES.includes(tier), `tier ${tier}`);
    const conn = connById[connId];
    assert.ok(conn, `unknown connection ${connId}`);
    assert.ok(conn.writeTools.includes(tool), `${key} not a write tool`);
  }
});
ok('seed tiers compile correctly (leave=trigger, reset=execute, create=assist)', () => {
  assert.equal(compiled.toolTiers['v2-workday__submit_time_off_request'], 'trigger');
  assert.equal(compiled.toolTiers['v2-servicenow__request_software_access'], 'execute');
  assert.equal(compiled.toolTiers['v2-servicenow__create_ticket'], 'assist');
});
ok('orchestrator catalog simulation: assist-tier write tool is excluded, reads survive', () => {
  // Mirrors lib/orchestrator/index.mjs (studio path tool catalog):
  // enabledToolNames filter, then `toolTiers[ns] === 'assist'` skip.
  const conn = compiled.connections.find((c) => c.id === 'v2-servicenow');
  const serverToolList = ['list_my_tickets', 'get_ticket', 'create_ticket', 'lookup_equipment', 'request_software_access']
    .map((name) => ({ name }));
  let toolList = serverToolList.filter((t) => conn.enabledToolNames.includes(t.name));
  const offered = toolList
    .map((t) => `${conn.id}__${t.name}`)
    .filter((ns) => compiled.toolTiers[ns] !== 'assist');
  assert.ok(!offered.includes('v2-servicenow__create_ticket'), 'assist write must be excluded');
  assert.ok(offered.includes('v2-servicenow__list_my_tickets'), 'reads must survive');
  assert.ok(offered.includes('v2-servicenow__request_software_access'), 'execute write must be offered');
  assert.ok(!offered.includes('v2-servicenow__lookup_equipment'), 'unmapped tools filtered by enabledToolNames');
});

// ── 3. Experts (capability bundles) ─────────────────────────────────────────
ok('bundles compile to active experts referencing compiled connection ids', () => {
  assert.equal(compiled.experts.length, state.behaviors.bundles.length);
  const connIds = new Set(compiled.connections.map((c) => c.id));
  for (const e of compiled.experts) {
    assert.ok(e.name && e.instructions.length > 40, e.name);
    assert.equal(e.status, 'active');
    assert.equal(e.source, 'v2');
    for (const id of e.connectionIds) assert.ok(connIds.has(id), `${e.name} → ${id}`);
    assert.ok(e.connectionIds.length > 0, `${e.name} resolved no connections`);
  }
});

// ── 4. Processes → workflows the flow step machine can run ─────────────────
ok('processes compile to workflows with runtime-supported step types', () => {
  assert.ok(compiled.workflows.length >= 1);
  for (const w of compiled.workflows) {
    assert.ok(WORKFLOW_STATES.includes(w.status));
    assert.equal(w.origin, 'v2');
    // The live step machine executes form / confirm / tool (photo unused
    // here) — approval/notify validate but are skipped at runtime, so the
    // compiler must not emit them.
    for (const s of w.steps) assert.ok(['form', 'confirm', 'tool'].includes(s.type), `${w.id} step ${s.type}`);
  }
});
ok('works-council process resolves no live submit target → no tool step, stays runnable', () => {
  const wc = compiled.workflows.find((w) => w.id === 'v2-proc-wc-data');
  assert.ok(wc, 'expected the seeded works-council process');
  assert.ok(wc.steps.some((s) => s.type === 'form'));
  assert.ok(wc.steps.some((s) => s.type === 'confirm'));
});

// ── 5. Merge semantics: idempotent, never touches hand-made V1 entities ────
const fakeServerConfig = {
  connections: [
    { id: 'hr_portal', kind: 'toolkit', status: 'connected', name: 'Staffbase HR' }, // hand-made V1
    { id: 'v2-old', origin: 'v2', kind: 'toolkit', status: 'connected', name: 'Stale compile' },
  ],
  workflows: [
    { id: 'flow-pto', name: 'Request Time Off', status: 'active', tools: [], steps: [] },
    { id: 'v2-stale', origin: 'v2', name: 'Stale', status: 'draft', tools: [], steps: [] },
  ],
  tenantOverrides: { name: 'Staffbase', seedVersion: 11 },
};
const merged = mergeCompiledConfig(fakeServerConfig, state, compiled);
ok('merge keeps V1 entities, replaces only origin:v2, preserves tenantOverrides', () => {
  assert.ok(merged.connections.some((c) => c.id === 'hr_portal'));
  assert.ok(!merged.connections.some((c) => c.id === 'v2-old'));
  assert.ok(merged.workflows.some((w) => w.id === 'flow-pto'));
  assert.ok(!merged.workflows.some((w) => w.id === 'v2-stale'));
  assert.equal(merged.tenantOverrides.seedVersion, 11);
  assert.equal(merged.tenantOverrides.name, 'Staffbase');
  assert.deepEqual(merged.tenantOverrides.v2.toolTiers, compiled.toolTiers);
  assert.ok(merged.tenantOverrides.v2.policyPrompt.includes('cite-or-refuse'));
  assert.ok(merged.tenantOverrides.v2.state.version === state.version);
});
ok('merge is idempotent (second pass yields identical entity sets)', () => {
  const twice = mergeCompiledConfig(merged, state, compiled);
  assert.deepEqual(
    twice.connections.map((c) => c.id).sort(),
    merged.connections.map((c) => c.id).sort(),
  );
  assert.deepEqual(
    twice.workflows.map((w) => w.id).sort(),
    merged.workflows.map((w) => w.id).sort(),
  );
});

// ── 6. Server-side validation accepts the merged payload unchanged ─────────
ok('lib/workspace-config normalizeConfig round-trips the compiled entities', () => {
  const norm = normalizeConfig(merged);
  for (const c of norm.connections.filter((x) => x.origin === 'v2')) {
    const src = merged.connections.find((x) => x.id === c.id);
    assert.equal(c.kind, src.kind, `kind coerced for ${c.id}`);
    assert.equal(c.status, src.status, `status coerced for ${c.id}`);
    assert.deepEqual(c.enabledToolNames, src.enabledToolNames);
  }
  for (const w of norm.workflows.filter((x) => x.origin === 'v2')) {
    const src = merged.workflows.find((x) => x.id === w.id);
    assert.equal(w.steps.length, src.steps.length, `steps dropped for ${w.id}`);
    assert.equal(w.status, src.status);
  }
  assert.deepEqual(norm.tenantOverrides.v2.toolTiers, compiled.toolTiers);
  assert.ok(norm.tenantOverrides.v2.policyPrompt.length > 0);
});
ok('normalizeConfig leaves configs WITHOUT a v2 section untouched (V1 no-op)', () => {
  const norm = normalizeConfig({ connections: [], workflows: [], tenantOverrides: { name: 'X' } });
  assert.ok(!('v2' in norm.tenantOverrides));
});

// ── 7. Expert merge semantics ───────────────────────────────────────────────
ok('expert merge keeps hand-made experts and reuses v2 ids by name', () => {
  const serverExperts = [
    { id: 'uuid-1', name: 'HR Expert', source: 'seed' },
    { id: 'uuid-2', name: compiled.experts[0].name, source: 'v2' },
    { id: 'uuid-3', name: 'Stale bundle', source: 'v2' },
  ];
  const out = mergeCompiledExperts(serverExperts, compiled.experts);
  assert.ok(out.some((e) => e.id === 'uuid-1'), 'hand-made expert kept');
  assert.equal(out.find((e) => e.name === compiled.experts[0].name).id, 'uuid-2', 'id reused by name');
  assert.ok(!out.some((e) => e.name === 'Stale bundle'), 'stale v2 expert dropped');
});

// ── 8. Optional read-only DB smoke ──────────────────────────────────────────
if (process.env.DATABASE_URL) {
  try {
    const { sql } = await import('../lib/db.mjs');
    const { getConfig } = await import('../lib/workspace-config.mjs');
    const rows = await sql`select branch_id from staffbase_tenants order by created_at asc limit 1`;
    if (rows[0]?.branch_id) {
      const cfg = await getConfig(rows[0].branch_id);
      console.log(`  ✓ read-only load: branch ${rows[0].branch_id} revision ${cfg?.revision ?? '(no row)'}; v2 section ${cfg?.tenantOverrides?.v2 ? 'present' : 'absent'}`);
      passed += 1;
    } else {
      console.log('  - read-only load skipped: no tenants registered');
    }
  } catch (err) {
    console.log(`  - read-only load skipped: ${err.message}`);
  }
} else {
  console.log('  - read-only load skipped: DATABASE_URL not set');
}

console.log(`\nsmoke-v2: ${passed} checks passed.`);
