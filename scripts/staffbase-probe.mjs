// Probes the live Staffbase REST API to figure out which endpoints exist on
// this tenant before we lock down MCP tool schemas. Reads the token from
// .env.local (auto-loaded by Vite/Vercel in dev), writes a report to
// scripts/staffbase-probe-report.json, and prints a sortable summary.
//
//   node --env-file=.env.local scripts/staffbase-probe.mjs
//
// Each probe is "soft" — non-2xx responses are recorded, not thrown. The
// report tells us which Phase-1 tools we can safely wire and which need a
// fallback (or to be dropped).

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api';
const TOKEN = process.env.STAFFBASE_API_TOKEN || '';

if (!TOKEN) {
  console.error('STAFFBASE_API_TOKEN is not set. Run with: node --env-file=.env.local scripts/staffbase-probe.mjs');
  process.exit(1);
}

const HEADERS = {
  Authorization: `Basic ${TOKEN}`,
  Accept: 'application/json',
};

async function probe(name, { method = 'GET', path: subpath, params, body, notes }) {
  const url = new URL(`${BASE}${subpath}`);
  if (params) for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const init = { method, headers: { ...HEADERS } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res, status = 0, text = '', parsed = null, sampleKeys = [], dataLength = null;
  try {
    res = await fetch(url.toString(), init);
    status = res.status;
    text = await res.text();
    try { parsed = JSON.parse(text); } catch {}
    if (parsed && typeof parsed === 'object') {
      sampleKeys = Object.keys(parsed).slice(0, 12);
      if (Array.isArray(parsed.data)) dataLength = parsed.data.length;
    }
  } catch (err) {
    return { name, method, path: subpath, params, status: 0, ok: false, error: err.message, notes };
  }
  return {
    name,
    method,
    path: subpath,
    params: params || null,
    status,
    ok: status >= 200 && status < 300,
    sampleKeys,
    total: parsed?.total ?? null,
    dataLength,
    snippet: text.slice(0, 240),
    notes: notes || null,
  };
}

// ── Probe definitions ─────────────────────────────────────────────────────────

const ALL = [
  // Existing/known-good (sanity check)
  { name: 'branch (existing)',              method: 'POST', path: '/branch', body: {} },
  { name: 'posts list',                     path: '/posts', params: { limit: 1 } },
  { name: 'posts query',                    path: '/posts', params: { limit: 1, query: 'a' }, notes: 'server-side search?' },
  { name: 'channels',                       path: '/channels', params: { limit: 1 } },
  { name: 'users list',                     path: '/users', params: { limit: 1 } },
  { name: 'installations (pages)',          path: '/installations', params: { limit: 1 } },
  { name: 'groups',                         path: '/groups', params: { limit: 1 } },
  { name: 'analytics posts timeseries',     path: '/branch/analytics/posts/timeseries', params: { groupBy: 'day', since: new Date(Date.now() - 7*86400000).toISOString(), until: new Date().toISOString(), timezone: 'Europe/Berlin', format: 'json' } },

  // People & Org — new
  { name: 'users/search SCIM filter',       path: '/users/search', params: { filter: 'firstName co "a"', limit: 1 } },
  { name: 'users with SCIM filter direct', path: '/users', params: { filter: 'firstName co "a"', limit: 1 } },
  { name: 'users with cursor',              path: '/users', params: { limit: 1, cursor: '' } },
  { name: 'groups detail (probe path)',     path: '/groups', params: { limit: 1 }, notes: 'will need a real id for /groups/{id}' },
  { name: 'spaces',                         path: '/spaces', params: { limit: 1 } },

  // Comments
  { name: 'comments list',                  path: '/comments', params: { limit: 1 } },
  { name: 'comments with filter',           path: '/comments', params: { limit: 1, filter: 'created gt "2024-01-01T00:00:00Z"' } },

  // Campaigns
  { name: 'campaigns',                      path: '/campaigns', params: { limit: 1 } },

  // Tags
  { name: 'tags',                           path: '/tags', params: { limit: 1 } },

  // Analytics extensions
  { name: 'analytics posts rankings',       path: '/branch/analytics/posts/rankings', params: { limit: 1, since: new Date(Date.now() - 7*86400000).toISOString(), until: new Date().toISOString(), timezone: 'Europe/Berlin', format: 'json', enrich: 'true' } },
  { name: 'analytics contents rankings',    path: '/branch/analytics/contents/rankings', params: { limit: 1, since: new Date(Date.now() - 7*86400000).toISOString(), until: new Date().toISOString(), timezone: 'Europe/Berlin', format: 'json' } },
  { name: 'analytics chats timeseries',     path: '/branch/analytics/chats/timeseries', params: { groupBy: 'day', since: new Date(Date.now() - 7*86400000).toISOString(), until: new Date().toISOString(), timezone: 'Europe/Berlin', format: 'json' } },
  { name: 'analytics comments timeseries',  path: '/branch/analytics/comments/timeseries', params: { groupBy: 'day', since: new Date(Date.now() - 7*86400000).toISOString(), until: new Date().toISOString(), timezone: 'Europe/Berlin', format: 'json' } },
  { name: 'analytics users timeseries v2',  path: '/branch/analytics/v2/users/timeseries', params: { groupBy: 'day', since: new Date(Date.now() - 7*86400000).toISOString(), until: new Date().toISOString(), timezone: 'Europe/Berlin', format: 'json' } },
  { name: 'analytics users summary',        path: '/branch/analytics/users', params: { format: 'json' } },
  { name: 'analytics overview',             path: '/branch/analytics', params: { format: 'json' } },
  { name: 'analytics email performance',    path: '/email-performance', params: { limit: 1 } },

  // Audit
  { name: 'audit log',                      path: '/audit-log', params: { limit: 1 } },
  { name: 'audit events',                   path: '/audit-events', params: { limit: 1 } },

  // Pages (proper endpoint?)
  { name: 'pages direct',                   path: '/pages', params: { limit: 1 } },
  { name: 'page-templates',                 path: '/page-templates', params: { limit: 1 } },

  // Media
  { name: 'media',                          path: '/media', params: { limit: 1 } },
  { name: 'files',                          path: '/files', params: { limit: 1 } },

  // Quick links
  { name: 'quick-links',                    path: '/quick-links', params: { limit: 1 } },
];

async function main() {
  console.log(`Probing ${ALL.length} endpoints against ${BASE} …\n`);
  const results = [];
  for (const def of ALL) {
    process.stdout.write(`  ${def.method || 'GET'} ${def.path} … `);
    const r = await probe(def.name, def);
    results.push(r);
    console.log(`${r.status}${r.ok ? '  ok' : '  ✗'}${r.dataLength != null ? `  data=${r.dataLength}` : ''}${r.total != null ? `  total=${r.total}` : ''}`);
  }

  // Phase-2 chained probes — use real ids surfaced above.
  const postsRes = results.find((r) => r.name === 'posts list');
  const channelsRes = results.find((r) => r.name === 'channels');
  const usersRes = results.find((r) => r.name === 'users list');
  const groupsRes = results.find((r) => r.name === 'groups');
  const campaignsRes = results.find((r) => r.name === 'campaigns');

  async function tryWithId(label, pathFn, srcResult) {
    try {
      if (!srcResult?.ok) return;
      const parsed = JSON.parse(srcResult.snippet.length === 240 ? `${srcResult.snippet}}` : srcResult.snippet);
      const id = parsed?.data?.[0]?.id || parsed?.id;
      if (!id) return;
      const r = await probe(label, { path: pathFn(id) });
      results.push(r);
      console.log(`  GET ${pathFn(id)} … ${r.status}${r.ok ? '  ok' : '  ✗'}`);
    } catch {}
  }

  // Re-fetch first ids cleanly (snippet may be truncated)
  async function firstId(subpath) {
    try {
      const url = new URL(`${BASE}${subpath}`);
      url.searchParams.set('limit', '1');
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data?.[0]?.id || null;
    } catch { return null; }
  }

  console.log('\nPhase 2 — chained id probes:');

  const postId = postsRes?.ok ? await firstId('/posts') : null;
  if (postId) {
    results.push(await probe('post detail',           { path: `/posts/${postId}` }));
    results.push(await probe('post analytics',        { path: `/branch/analytics/posts/${postId}` }));
    results.push(await probe('post analytics v2',     { path: `/analytics/posts/${postId}` }));
    results.push(await probe('post comments',         { path: `/posts/${postId}/comments` }));
  }

  const channelId = channelsRes?.ok ? await firstId('/channels') : null;
  if (channelId) {
    results.push(await probe('channel detail',        { path: `/channels/${channelId}` }));
    results.push(await probe('channel posts',         { path: `/channels/${channelId}/posts`, params: { limit: 1 } }));
    results.push(await probe('channel analytics',     { path: `/branch/analytics/channels/${channelId}` }));
  }

  const userId = usersRes?.ok ? await firstId('/users') : null;
  if (userId) {
    results.push(await probe('user detail (existing)', { path: `/users/${userId}` }));
  }

  const groupId = groupsRes?.ok ? await firstId('/groups') : null;
  if (groupId) {
    results.push(await probe('group detail',          { path: `/groups/${groupId}` }));
    results.push(await probe('group members',         { path: `/groups/${groupId}/members`, params: { limit: 1 } }));
    results.push(await probe('users filter by group', { path: '/users', params: { limit: 1, filter: `groups co "${groupId}"` } }));
  }

  const campaignId = campaignsRes?.ok ? await firstId('/campaigns') : null;
  if (campaignId) {
    results.push(await probe('campaign detail',       { path: `/campaigns/${campaignId}` }));
    results.push(await probe('campaign references',   { path: `/campaigns/${campaignId}/references`, params: { sort: 'updated_DESC' } }));
  }

  // ── Write report ────────────────────────────────────────────────────────────
  const reportPath = path.join(process.cwd(), 'scripts/staffbase-probe-report.json');
  const summary = {
    base: BASE,
    timestamp: new Date().toISOString(),
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
    results,
  };
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  console.log(`  ${summary.okCount} ok / ${summary.failCount} failed`);

  // Short status table
  console.log('\nFinal status table:');
  for (const r of results) {
    const pad = (s, n) => String(s).padEnd(n, ' ').slice(0, n);
    console.log(`  ${pad(r.status, 4)} ${pad(r.name, 36)} ${r.path}`);
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
