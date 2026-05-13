// Thin client for the Staffbase REST API (campsite.staffbase.com).
//
// Auth: read-only API token via `Authorization: Basic <token>` — the token
// itself is the already-base64 form of `<id>:<secret>`.

const BASE = process.env.STAFFBASE_API_BASE || 'https://campsite.staffbase.com/api';
const TOKEN = process.env.STAFFBASE_API_TOKEN || '';

function authHeader() {
  if (!TOKEN) throw new Error('STAFFBASE_API_TOKEN is not configured');
  return `Basic ${TOKEN}`;
}

async function get(path, params) {
  const url = new URL(`${BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Staffbase ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
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
    } : null,
    channel: channelTitle ? { id: p.channelID, title: channelTitle } : { id: p.channelID },
    published: p.published,
    url: p.links?.detail_view?.href || null,
    likes: p.likeCount,
    comments: p.commentCount,
  };
  if (full) {
    out.content = stripHtml(content.content || '').slice(0, 4000);
    out.image = content.image?.url || content.feedImage?.url || null;
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

// Best-effort client-side search: pull the latest N posts and filter by
// title/teaser. The Staffbase /posts endpoint ignored ?q / ?searchText in
// testing, and POST /posts/search is 405. Good enough for a demo over ~6.6k
// posts when we cap recent scan to 200.
export async function searchPosts(query, { limit = 10, scan = 200 } = {}) {
  const all = await listRecentPostsRaw({ limit: scan });
  const q = (query || '').toLowerCase();
  if (!q) return all.slice(0, limit).map((p) => shapePost(p));
  const matches = all.filter((p) => {
    const c = pickLocale(p.contents);
    const haystack = `${stripHtml(c.title || '')} ${stripHtml(c.teaser || '')}`.toLowerCase();
    return haystack.includes(q);
  });
  return matches.slice(0, limit).map((p) => shapePost(p));
}

async function listRecentPostsRaw({ limit }) {
  const data = await get('/posts', { limit, order: 'published_desc' });
  return data.data || [];
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
  const data = await get('/installations', { limit });
  const all = data.data || [];
  return all.filter((i) => i.pluginID === 'page').map(shapePage);
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
    avatar: u.avatar?.icon?.url || u.avatar?.original?.url || null,
    customFields: Object.keys(customFields).length ? customFields : undefined,
  };
}

export async function listUsers({ limit = 50 } = {}) {
  const data = await get('/users', { limit });
  return (data.data || []).map(shapeUser);
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
  const data = await get('/users', { limit: scan });
  const users = (data.data || []).map(shapeUser);
  const qTerms = tokens(query);
  if (!qTerms.length) return users.slice(0, limit);
  const ranked = users
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

// Try to find the live Staffbase profile matching a Google email. Used at
// sign-in time so the signed-in user picks up their real intranet photo,
// title, and department instead of canned values from the seed directory.
// Returns null when nothing matches (or when the API isn't configured).
export async function findUserByEmail(email) {
  if (!email || !TOKEN) return null;
  const target = String(email).toLowerCase();
  try {
    // Scan a generous slice of the directory; weighted scoring isn't needed —
    // we're looking for an exact email match.
    const data = await get('/users', { limit: 500 });
    const rows = data?.data || [];
    for (const u of rows) {
      const emails = (u.emails || []).map((e) => String(e?.value || '').toLowerCase());
      if (emails.includes(target)) return shapeUser(u);
    }
    return null;
  } catch (err) {
    console.error('[staffbase] findUserByEmail failed:', err.message);
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
