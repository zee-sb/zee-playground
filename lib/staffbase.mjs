// Thin client for the Staffbase REST API (campsite.staffbase.com).
//
// Auth: read-only API token via `Authorization: Basic <token>` — the token
// itself is the already-base64 form of `<id>:<secret>`.
//
// Multi-tenant context: every request resolves baseUrl + apiToken from an
// AsyncLocalStorage frame the route handler pushes (lib/tenants.mjs +
// api/*.mjs). When no frame is active we fall back to the legacy env vars
// (STAFFBASE_API_BASE / STAFFBASE_API_TOKEN) so single-tenant deployments
// keep working through one migration cycle.

import { AsyncLocalStorage } from 'node:async_hooks';

export const staffbaseContext = new AsyncLocalStorage();

const ENV_BASE = process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api';
const ENV_TOKEN = process.env.STAFFBASE_API_TOKEN || '';

function readCtx() {
  const store = staffbaseContext.getStore();
  return {
    baseUrl: store?.baseUrl || ENV_BASE,
    apiToken: store?.apiToken || ENV_TOKEN,
  };
}

function authHeader(token) {
  if (!token) throw new Error('STAFFBASE_API_TOKEN is not configured');
  return `Basic ${token}`;
}

async function get(path, params, { accept = 'application/json' } = {}) {
  const { baseUrl, apiToken } = readCtx();
  const url = new URL(`${baseUrl}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader(apiToken), Accept: accept },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Staffbase ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
}

async function post(path, body = {}) {
  const { baseUrl, apiToken } = readCtx();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(apiToken),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Staffbase POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

// Run a callback with a specific tenant's credentials in scope. All Staffbase
// API calls made inside the callback (and any awaits that descend from it)
// will use the supplied baseUrl + apiToken instead of the env-var fallback.
export function withStaffbaseContext(ctx, fn) {
  return staffbaseContext.run({ baseUrl: ctx.baseUrl, apiToken: ctx.apiToken }, fn);
}

// Out-of-band client for code paths that can't run inside an AsyncLocalStorage
// frame — e.g. verifying a candidate API token before storing it. Resolves the
// ctx eagerly per call rather than reading the env-var fallback, so a bad
// token surfaces as an auth error rather than silently using the prod token.
export function makeClient({ baseUrl, apiToken }) {
  if (!apiToken) throw new Error('makeClient requires an apiToken');
  if (!baseUrl) throw new Error('makeClient requires a baseUrl');
  return {
    getBranch: () => staffbaseContext.run({ baseUrl, apiToken }, () => getBranch()),
    findUserByEmail: (email) => staffbaseContext.run({ baseUrl, apiToken }, () => findUserByEmail(email)),
  };
}

// ── Branch ───────────────────────────────────────────────────────────────────
//
// POST /branch returns the workspace metadata for this token: id, name, and
// the full branch config (available locales, custom CSS, etc.). The id is
// the persistence key for everything Navigator caches server-side.
//
// We use POST /branch/anything (the Staffbase routing accepts any path under
// /branch/ with POST and returns the branch object); we just call /branch
// directly with an empty body.

export async function getBranch() {
  const data = await post('/branch', {});
  return {
    id: data.id,
    name: data.name || null,
    slug: data.slug || null,
    availableLocales: data.config?.availableLocales || [],
  };
}

// ── Posts ────────────────────────────────────────────────────────────────────

function pickLocale(contents, locale = 'en_US') {
  if (!contents) return {};
  if (contents[locale]) return contents[locale];
  // Fall back to the first available locale
  const keys = Object.keys(contents);
  return keys.length ? contents[keys[0]] : {};
}

export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shapePost(p, { full = false } = {}) {
  const content = pickLocale(p.contents);
  const teaser = stripHtml(content.teaser || '').slice(0, 280);
  const channelTitle = pickLocale(p.channel?.config?.localization).title || null;
  const out = {
    id: p.id,
    title: stripHtml(content.title || '(untitled)'),
    teaser,
    author: p.author ? {
      id: p.author.id,
      name: [p.author.firstName, p.author.lastName].filter(Boolean).join(' ') || p.author.profile?.firstName || null,
      avatar: p.author.avatar?.icon?.url || p.author.avatar?.original?.url || null,
    } : null,
    channel: channelTitle ? { id: p.channelID, title: channelTitle } : { id: p.channelID },
    published: p.published,
    url: p.links?.detail_view?.href || null,
    likes: p.likeCount,
    comments: p.commentCount,
    image: content.image?.url || content.feedImage?.url || null,
  };
  if (full) {
    out.content = stripHtml(content.content || '').slice(0, 4000);
  }
  return out;
}

export async function listRecentPosts({ limit = 10, channelID } = {}) {
  const data = await get('/posts', { limit, order: 'published_desc', channelID });
  return (data.data || []).map((p) => shapePost(p));
}

export async function getPost(postId) {
  const data = await get(`/posts/${postId}`);
  return shapePost(data, { full: true });
}

// Two-stage post search. Both stages re-sort by `published` desc so older
// posts (sometimes 2018-era) never bubble above recent ones — Staffbase's
// server-side relevance ranking can otherwise surface stale matches.
//   1. Server-side — /posts?query=<q> works on this tenant (returns a narrowed
//      total) so we try that first. Cheaper, broader.
//   2. Client-side fallback — scan the latest N and substring-match titles +
//      teasers. Keeps us robust if a tenant's posts endpoint doesn't honour
//      `query` (older deployments).
function sortByPublishedDesc(rows) {
  return [...rows].sort((a, b) => {
    const da = new Date(a.published || 0).getTime();
    const db = new Date(b.published || 0).getTime();
    return db - da;
  });
}

export async function searchPosts(query, { limit = 10, scan = 200 } = {}) {
  const q = (query || '').trim();
  if (!q) {
    const all = await listRecentPostsRaw({ limit });
    return sortByPublishedDesc(all).map((p) => shapePost(p));
  }
  // Stage 1 — server side
  try {
    const server = await get('/posts', { limit: Math.max(limit * 2, 20), order: 'published_desc', query: q });
    const rows = server?.data || [];
    if (rows.length) {
      const lower = q.toLowerCase();
      const filtered = rows.filter((p) => {
        const c = pickLocale(p.contents);
        const hay = `${stripHtml(c.title || '')} ${stripHtml(c.teaser || '')}`.toLowerCase();
        return hay.includes(lower);
      });
      const winners = filtered.length ? filtered : rows;
      return sortByPublishedDesc(winners).slice(0, limit).map((p) => shapePost(p));
    }
  } catch {}
  // Stage 2 — fallback scan
  const all = await listRecentPostsRaw({ limit: scan });
  const lower = q.toLowerCase();
  const matches = all.filter((p) => {
    const c = pickLocale(p.contents);
    const hay = `${stripHtml(c.title || '')} ${stripHtml(c.teaser || '')}`.toLowerCase();
    return hay.includes(lower);
  });
  return sortByPublishedDesc(matches).slice(0, limit).map((p) => shapePost(p));
}

async function listRecentPostsRaw({ limit }) {
  const data = await get('/posts', { limit, order: 'published_desc' });
  return data.data || [];
}

// Posts scoped to a channel; uses /channels/{id}/posts which is cheaper than
// filtering /posts client-side and returns the same shape.
export async function listChannelPosts(channelId, { limit = 20 } = {}) {
  const data = await get(`/channels/${channelId}/posts`, { limit, order: 'published_desc' });
  return (data.data || []).map((p) => shapePost(p));
}

// ── Channels ─────────────────────────────────────────────────────────────────

function shapeChannel(c) {
  const l = pickLocale(c.config?.localization);
  const locales = Object.keys(c.config?.localization || {});
  return {
    id: c.id,
    title: l.title || '(untitled)',
    description: l.description || null,
    published: c.published,
    locales,
    // Real counts straight from the API — beats our 50-post sample.
    postCount: c.postCount ?? null,
    lastPostPublishedAt: c.lastPostPublishedAt ?? null,
    availableInPublicArea: c.availableInPublicArea ?? null,
  };
}

export async function listChannels({ limit = 50 } = {}) {
  const data = await get('/channels', { limit });
  return (data.data || []).map(shapeChannel);
}

export async function getChannel(channelId) {
  const data = await get(`/channels/${channelId}`);
  return shapeChannel(data);
}

// ── Pages ────────────────────────────────────────────────────────────────────
//
// Pages live under /installations with pluginID === 'page'. The API doesn't
// support filtering by pluginID server-side, so we fetch a slice and filter
// client-side. Page bodies are rich HTML — much deeper context than a post
// teaser — so they're the best signal for "what reference content lives here".

function shapePage(p) {
  const l = pickLocale(p.config?.localization);
  const contentLocale = pickLocale(p.contents);
  const body = stripHtml(contentLocale.content || contentLocale.body || '').slice(0, 2000);
  return {
    id: p.id,
    title: l.title || '(untitled)',
    description: l.description || null,
    published: p.published,
    locales: Object.keys(p.config?.localization || {}),
    bodyExcerpt: body,
    bodyLength: body.length,
    spaceID: p.spaceID || null,
  };
}

export async function listPages({ limit = 200 } = {}) {
  // `/installations` doesn't honour `order` for some tenants, so we sort
  // descending by `published` after the fetch as the canonical newest-first
  // ordering. Pass the param anyway so newer Staffbase deployments that DO
  // accept it can take the cheap server-side path.
  const data = await get('/installations', { limit, order: 'published_desc' });
  const all = data.data || [];
  const pages = all.filter((i) => i.pluginID === 'page').map(shapePage);
  return pages.sort((a, b) => {
    const da = new Date(a.published || 0).getTime();
    const db = new Date(b.published || 0).getTime();
    return db - da;
  });
}

// Search pages by substring on title + body excerpt. Always sorted newest
// first so MCP search results don't surface stale 2018-era pages.
export async function searchPages(query, { limit = 10, scan = 200 } = {}) {
  const q = (query || '').trim();
  const all = await listPages({ limit: scan });
  if (!q) return all.slice(0, limit);
  const lower = q.toLowerCase();
  return all.filter((p) => {
    const hay = `${p.title || ''} ${p.description || ''} ${p.bodyExcerpt || ''}`.toLowerCase();
    return hay.includes(lower);
  }).slice(0, limit);
}

// ── Groups ───────────────────────────────────────────────────────────────────
//
// Groups are real signal: they often map 1:1 to org structure (e.g. "Dep.
// Customer Success", "GTM", "Marketing") or to feature opt-ins. Their
// titles + descriptions give the LLM clear evidence about how the workspace
// segments employees.

function shapeGroup(g) {
  const l = pickLocale(g.config?.localization);
  return {
    id: g.id,
    name: l.title || g.name || '(untitled)',
    description: l.description || null,
    externalID: g.externalID || null,
    type: g.type || null,
    memberCount: Array.isArray(g.accessorIDs) ? g.accessorIDs.length : null,
    adminCount: Array.isArray(g.adminIDs) ? g.adminIDs.length : null,
  };
}

export async function listGroups({ limit = 50 } = {}) {
  const data = await get('/groups', { limit });
  return (data.data || []).map(shapeGroup);
}

// ── Users ────────────────────────────────────────────────────────────────────

// Profile fields we explicitly hoist out of `u.profile` because they're
// recognised across most Staffbase instances. Anything else in the raw profile
// is passed through under `customFields` so the LLM can still surface
// instance-specific data (e.g. "skills", "pronouns", custom org fields).
const KNOWN_PROFILE_FIELDS = new Set([
  'firstName', 'lastName', 'position', 'department', 'location',
  // Org / reporting (different Staffbase instances use different field names)
  'manager', 'managerEmail', 'managerName', 'superior', 'superiorEmail',
  'reportsTo', 'reportsToEmail',
]);

function pickOrgInfo(profile = {}) {
  // Try the common manager-field aliases in priority order so the LLM gets a
  // canonical `manager` key regardless of how this Staffbase instance named
  // the field.
  const managerName =
    profile.managerName ||
    profile.manager ||
    profile.superior ||
    profile.reportsTo ||
    null;
  const managerEmail =
    profile.managerEmail ||
    profile.superiorEmail ||
    profile.reportsToEmail ||
    null;
  return managerName || managerEmail ? { managerName, managerEmail } : null;
}

function shapeUser(u) {
  const profile = u.profile || {};
  const customFields = {};
  for (const [k, v] of Object.entries(profile)) {
    if (!KNOWN_PROFILE_FIELDS.has(k) && v != null && v !== '') customFields[k] = v;
  }
  return {
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || profile.firstName || u.email || '(unknown)',
    email: u.emails?.[0]?.value || null,
    title: profile.position || null,
    department: profile.department || null,
    location: profile.location || null,
    manager: pickOrgInfo(profile),
    activated: u.activated,
    status: u.status || null,
    avatar: u.avatar?.icon?.url || u.avatar?.original?.url || null,
    customFields: Object.keys(customFields).length ? customFields : undefined,
  };
}

// True for a real teammate the chat should expose: status is "activated"
// (skips deactivated/disabled accounts) AND the profile has at least one
// non-empty signal (title/department/location/avatar). Catches test or
// placeholder rows like "Martin Test" with empty profiles.
function isActiveTeammate(u) {
  if (u.status && u.status !== 'activated') return false;
  return Boolean(u.title || u.department || u.location || u.avatar);
}

export async function listUsers({ limit = 50 } = {}) {
  // Over-fetch a little so the filter doesn't shrink the page below `limit`.
  const data = await get('/users', { limit: Math.min(Math.max(limit * 2, limit + 10), 200) });
  return (data.data || []).map(shapeUser).filter(isActiveTeammate).slice(0, limit);
}

// Returns just the directory-wide count (the `total` from `/users`). Used by
// the setup discovery to display the real population size without having to
// page through every user — we still sample a few hundred for distribution
// analysis, but the count we show is authoritative.
export async function getUsersTotal() {
  const data = await get('/users', { limit: 1 });
  return typeof data.total === 'number' ? data.total : null;
}

// Tokenize a query string into normalised lowercase terms, dropping common
// stop words. "who is the head of marketing?" → ["who","is","head","marketing"]
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'in', 'at', 'to', 'for', 'and', 'or', 'with', 'is', 'are', 'who', 'what', 'where', 'find', 'show', 'me', 'about', 'on', 'our', 'my']);
function tokens(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9@. ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length >= 2);
}

// Score a user against the query terms. Higher = better match.
// Name matches dominate (3×); title and department are weighted next (2× / 1.5×);
// email is fallback (1×). Exact name match gets a big bonus.
function scoreUser(user, qTerms) {
  if (!qTerms.length) return 0;
  const name = (user.name || '').toLowerCase();
  const title = (user.title || '').toLowerCase();
  const dept = (user.department || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  const local = email.split('@')[0] || '';

  let score = 0;
  let matchedTerms = 0;
  for (const term of qTerms) {
    let termScore = 0;
    if (name === term) termScore = Math.max(termScore, 200);
    if (name.includes(term)) termScore = Math.max(termScore, 90);
    if (name.split(/\s+/).some((p) => p.startsWith(term))) termScore = Math.max(termScore, 70);
    if (title.includes(term)) termScore = Math.max(termScore, 50);
    if (dept.includes(term)) termScore = Math.max(termScore, 40);
    if (local.startsWith(term)) termScore = Math.max(termScore, 60);
    if (email.includes(term)) termScore = Math.max(termScore, 25);
    if (termScore > 0) matchedTerms++;
    score += termScore;
  }
  // Multi-term coverage bonus — full-phrase matches outrank partial ones.
  if (matchedTerms > 1) score += matchedTerms * 30;
  return score;
}

// Smarter directory search: ranks the (already-fetched) directory of users
// against the query using term-weighted scoring across name/title/department/
// email. Returns top `limit` ranked hits, plus the raw score on each so the
// LLM can see how confident the match is.
export async function searchUsers(query, { limit = 10, scan = 500 } = {}) {
  const qTerms = tokens(query);
  if (!qTerms.length) {
    const data = await get('/users', { limit });
    return (data.data || []).map(shapeUser).filter(isActiveTeammate);
  }

  // Stage 1 — server-side narrowing. /users?query=<term> is supported and
  // shrinks the candidate pool dramatically (e.g. 670 → 52 for "marketing").
  // Try the longest, most distinctive term first so we don't accidentally hit
  // a stop-wordy result like "the".
  const seed = [...qTerms].sort((a, b) => b.length - a.length)[0];
  let users = [];
  try {
    const narrowed = await get('/users', { limit: Math.min(scan, 200), query: seed });
    users = (narrowed.data || []).map(shapeUser);
  } catch {}

  // Stage 2 — if the server returned too few, broaden by full scan.
  if (users.length < limit) {
    const broad = await get('/users', { limit: scan });
    const broadShaped = (broad.data || []).map(shapeUser);
    // Merge, dedupe by id, keeping server-narrowed first.
    const seen = new Set(users.map((u) => u.id));
    for (const u of broadShaped) if (!seen.has(u.id)) users.push(u);
  }

  // Stage 3 — drop test/placeholder/deactivated accounts, then re-rank with
  // the weighted scorer for relevance.
  const ranked = users
    .filter(isActiveTeammate)
    .map((u) => ({ user: u, score: scoreUser(u, qTerms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({ ...r.user, _matchScore: r.score }));
  return ranked;
}

export async function getUser(userId) {
  const data = await get(`/users/${userId}`);
  return shapeUser(data);
}

// Match an email against a Campsite user record. The directory exposes the
// email in multiple shapes depending on which endpoint returned it:
//   - /users          → top-level `email`, plus `emails: [{value}]`
//   - /users/search   → `email: {value}` (object), plus `externalId` (often
//                       the user's email for Google-SSO tenants)
function matchesEmail(u, target) {
  if (!u) return false;
  const candidates = [];
  if (typeof u.email === 'string') candidates.push(u.email);
  else if (u.email && typeof u.email === 'object' && u.email.value) candidates.push(u.email.value);
  if (Array.isArray(u.emails)) for (const e of u.emails) candidates.push(e?.value);
  if (u.externalId) candidates.push(u.externalId);
  return candidates.some((c) => String(c || '').toLowerCase() === target);
}

// Try to find the live Staffbase profile matching a Google email. Used at
// sign-in time so the signed-in user picks up their real intranet photo,
// title, department, and custom fields instead of canned values from the
// seed directory. Returns null when nothing matches (or when the API isn't
// configured).
//
// Strategy:
//
//   1. Fast path — `GET /users/{externalId}`. For Google-SSO tenants the
//      externalId is the user's email, so this is a single direct lookup
//      that returns the full profile (avatar, title, department, location,
//      customFields). Sub-second.
//
//   2. Fallback — `GET /users/search` cursor walk. Returns slim user records
//      at ~100/page; we stop at the first email match against either
//      `externalId` or the `email.value`. Once we know the id, hydrate via
//      `GET /users/{id}`. Used for tenants where externalId is not the
//      email (e.g. SAML with a numeric subject), and as a safety net.
//
// Returns the shaped user (same contract as `getUser`) or null on miss.
export async function findUserByEmail(email) {
  if (!email) return null;
  const { apiToken } = readCtx();
  if (!apiToken) return null;
  const target = String(email).toLowerCase();

  // ── Pass 1: direct lookup by externalId (= email on Google-SSO tenants).
  try {
    const direct = await get(`/users/${encodeURIComponent(target)}`);
    // Defensive: a non-email externalId might collide; only trust if it
    // actually matches one of the user's email fields.
    if (direct && matchesEmail(direct, target)) {
      return shapeUser(direct);
    }
  } catch (err) {
    // 404 is normal when the externalId doesn't match — fall through.
    if (!/→ 404/.test(err.message)) {
      console.warn('[staffbase] direct externalId lookup failed:', err.message);
    }
  }

  // ── Pass 2: cursor walk via /users/search.
  try {
    const pageSize = 100;
    const maxPages = 200; // up to 20k users — generous ceiling
    let cursor = null;
    for (let page = 0; page < maxPages; page++) {
      const params = { limit: pageSize };
      if (cursor) params.cursor = cursor;
      // /users/search responds 406 for `Accept: application/json` on some
      // tenants — `Accept: */*` is required.
      const data = await get('/users/search', params, { accept: '*/*' }).catch((err) => {
        console.warn('[staffbase] /users/search failed:', err.message);
        return null;
      });
      if (!data) return null;
      const entries = data.entries || [];
      for (const e of entries) {
        const slim = e?.data || e;
        if (matchesEmail(slim, target)) {
          return await getUser(slim.id).catch(() => null);
        }
      }
      if (!data.nextCursor) break;
      cursor = data.nextCursor;
    }
    return null;
  } catch (err) {
    console.error('[staffbase] findUserByEmail fallback failed:', err.message);
    return null;
  }
}

// ── Analytics ────────────────────────────────────────────────────────────────
// Thin wrappers over /branch/analytics/* — returns the raw shape from the API
// (already clean JSON). All wrappers accept ISO `since`/`until` strings or fall
// back to a `sinceDays` window ending now.

const DEFAULT_TZ = 'Europe/Berlin';

function defaultSince(days = 30) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function analyticsParams({ since, until, groupBy, timezone, sinceDays } = {}) {
  return {
    groupBy: groupBy || 'day',
    since: since || defaultSince(sinceDays || 30),
    until: until || nowIso(),
    timezone: timezone || DEFAULT_TZ,
    format: 'json',
  };
}

export async function getPostsTimeseries(opts = {}) {
  return await get('/branch/analytics/posts/timeseries', analyticsParams(opts));
}

export async function getUsersTimeseries(opts = {}) {
  return await get('/branch/analytics/v2/users/timeseries', analyticsParams(opts));
}

export async function getChatsTimeseries(opts = {}) {
  return await get('/branch/analytics/chats/timeseries', analyticsParams(opts));
}

export async function getPostsRankings({ since, until, timezone, sinceDays, limit = 10, sort, enrich = true } = {}) {
  return await get('/branch/analytics/posts/rankings', {
    since: since || defaultSince(sinceDays || 30),
    until: until || nowIso(),
    timezone: timezone || DEFAULT_TZ,
    format: 'json',
    limit,
    sort,
    enrich: enrich ? 'true' : 'false',
  });
}

export async function getContentsRankings({ since, until, timezone, sinceDays, limit = 10, sort } = {}) {
  return await get('/branch/analytics/contents/rankings', {
    since: since || defaultSince(sinceDays || 30),
    until: until || nowIso(),
    timezone: timezone || DEFAULT_TZ,
    format: 'json',
    limit,
    sort,
  });
}

// ── Org structure: spaces, groups (extended) ────────────────────────────────

function shapeSpace(s) {
  return {
    id: s.id,
    name: s.name || '(untitled)',
    sectionCount: Array.isArray(s.sections) ? s.sections.length : 0,
    sections: Array.isArray(s.sections) ? s.sections.map((x) => ({ type: x.type || x.pluginID || null, title: x.title || null })) : [],
    adminCount: Array.isArray(s.adminIDs) ? s.adminIDs.length : 0,
    accessorCount: Array.isArray(s.accessorIDs) ? s.accessorIDs.length : 0,
    childCount: Array.isArray(s.childIds) ? s.childIds.length : 0,
  };
}

export async function listSpaces({ limit = 50 } = {}) {
  const data = await get('/spaces', { limit });
  return (data.data || []).map(shapeSpace);
}

export async function getGroup(groupId) {
  const data = await get(`/groups/${groupId}`);
  return shapeGroup(data);
}

// Users in a group: use SCIM filter (`groups co "<id>"`). Tested live; works
// against this tenant's /users endpoint.
export async function listUsersInGroup(groupId, { limit = 50 } = {}) {
  const data = await get('/users', { limit, filter: `groups co "${groupId}"` });
  return (data.data || []).map(shapeUser);
}

// Aggregated org breakdown — bucket the directory by a known profile field.
// We sample up to `sample` users (default 1000) and tally. Returns the top
// `limit` buckets sorted descending.
export async function orgBreakdown(by = 'department', { sample = 1000, limit = 12 } = {}) {
  const data = await get('/users', { limit: Math.min(sample, 1000) });
  const rows = (data.data || []).map(shapeUser);
  const counts = new Map();
  const key = by === 'department' ? 'department' : by === 'location' ? 'location' : 'title';
  for (const u of rows) {
    const v = (u[key] || 'Unknown').trim();
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const buckets = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  return { by: key, sampled: rows.length, totalDirectory: data.total ?? null, buckets };
}

// ── Comments ────────────────────────────────────────────────────────────────

function shapeComment(c) {
  const author = c.author || {};
  return {
    id: c.id,
    postId: c.installationID || null,         // installationID is the post the comment lives on
    parentId: c.parentID || null,
    isReply: c.parentType === 'comment',
    text: stripHtml(c.text || '').slice(0, 400),
    author: {
      id: c.authorID || author.id || null,
      name: [author.firstName, author.lastName].filter(Boolean).join(' ') || null,
      avatar: author.avatar?.icon?.url || author.avatar?.original?.url || null,
    },
    published: c.published,
    status: c.status,
    created: c.created || null,
    updated: c.updated || null,
  };
}

export async function listComments({ sinceDays, limit = 25 } = {}) {
  const params = { limit };
  if (sinceDays) {
    const since = defaultSince(sinceDays);
    params.filter = `created gt "${since}"`;
  }
  const data = await get('/comments', params);
  return (data.data || []).map(shapeComment);
}

export async function listPostComments(postId, { limit = 25 } = {}) {
  const data = await get('/comments', { limit, filter: `installationID eq "${postId}"` });
  return (data.data || []).map(shapeComment);
}

// Derive a daily comment-volume timeseries from /comments (since the dedicated
// /branch/analytics/comments/timeseries endpoint 404s on this tenant). We pull
// up to `scan` recent comments and bucket by day.
export async function getCommentsActivity({ sinceDays = 30, scan = 500 } = {}) {
  const since = defaultSince(sinceDays);
  const data = await get('/comments', { limit: scan, filter: `created gt "${since}"` });
  const rows = data.data || [];
  const byDay = new Map();
  for (const c of rows) {
    if (!c.created) continue;
    const day = c.created.slice(0, 10); // YYYY-MM-DD
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  const days = [...byDay.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return { sinceDays, sampled: rows.length, totalMatching: data.total ?? null, days };
}

// ── Campaigns ───────────────────────────────────────────────────────────────

function shapeCampaign(c) {
  return {
    id: c.id,
    title: c.title || '(untitled)',
    goal: c.goal || null,
    color: c.color || null,
    startAt: c.startAt || null,
    endAt: c.endAt || null,
    actionsCount: Array.isArray(c.actions) ? c.actions.length : 0,
    stats: c.stats || null,
    createdAt: c.createdAt || null,
    updatedAt: c.updatedAt || null,
  };
}

export async function listCampaigns({ limit = 20 } = {}) {
  const data = await get('/campaigns', { limit });
  return (data.data || []).map(shapeCampaign);
}

export async function getCampaign(campaignId) {
  const data = await get(`/campaigns/${campaignId}`);
  return shapeCampaign(data);
}

export async function listCampaignReferences(campaignId, { sort = 'updated_DESC', limit = 25 } = {}) {
  const data = await get(`/campaigns/${campaignId}/references`, { sort, limit });
  return (data.data || []).map((r) => ({
    id: r.id,
    referenceID: r.referenceID || null,
    sourceType: r.sourceType || null,
    plannedAt: r.plannedAt || null,
    title: r.title || r.referenceTitle || null,
    status: r.status || null,
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
  }));
}

// ── Tags ────────────────────────────────────────────────────────────────────
// /tags returns { tags: [{ id, name, taggedItemsCount }], total, cursor }

export async function listTags({ limit = 50 } = {}) {
  const data = await get('/tags', { limit });
  const rows = data.tags || data.data || [];
  return rows.map((t) => ({
    id: t.id,
    name: t.name || t.label || '(untitled)',
    count: t.taggedItemsCount ?? t.count ?? null,
  }));
}

// ── Media ───────────────────────────────────────────────────────────────────

function shapeMedia(m) {
  const info = m.resourceInfo || {};
  return {
    id: m.id,
    publicID: m.publicID || null,
    fileName: m.fileName || null,
    label: m.label || null,
    url: info.url || null,
    width: info.width || null,
    height: info.height || null,
    bytes: info.bytes || null,
    format: info.format || null,
    mimeType: info.mimeType || null,
    created: m.created || null,
    updated: m.updated || null,
    referencedBy: Array.isArray(m.referencedBy) ? m.referencedBy.length : 0,
  };
}

export async function listRecentMedia({ limit = 24 } = {}) {
  const data = await get('/media', { limit });
  return (data.data || []).map(shapeMedia);
}

// ── Pages (direct endpoint — more comprehensive than /installations) ────────

function shapePageDirect(p) {
  // /pages payloads use `contents` keyed by locale → { title, content, ... }
  const localized = pickLocale(p.contents);
  const body = stripHtml(localized.content || localized.body || '').slice(0, 2000);
  return {
    id: p.id,
    title: localized.title || '(untitled)',
    description: localized.description || null,
    contentType: p.contentType || null,
    spaceId: p.spaceId || null,
    publishedAt: p.publishedAt || null,
    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null,
    isOutdated: !!p.isOutdated,
    bodyExcerpt: body,
    bodyLength: body.length,
  };
}

export async function listPagesDirect({ limit = 50 } = {}) {
  const data = await get('/pages', { limit });
  return (data.data || []).map(shapePageDirect);
}
