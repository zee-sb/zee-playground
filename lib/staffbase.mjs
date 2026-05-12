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
  return {
    id: c.id,
    title: l.title || '(untitled)',
    description: l.description || null,
    published: c.published,
  };
}

export async function listChannels({ limit = 50 } = {}) {
  const data = await get('/channels', { limit });
  return (data.data || []).map(shapeChannel);
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

// ── Analytics ────────────────────────────────────────────────────────────────
//
// Backed by the Staffbase Analytics API at /branch/analytics/... — engagement
// rankings + time-series for posts, users, chats. SCIM filter syntax for the
// `filter` param (e.g. `postId eq "..."`, `channelID eq "..."`).

function windowFromDays(days = 7, end = new Date()) {
  const until = new Date(end);
  const since = new Date(until.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  return { since: since.toISOString(), until: until.toISOString(), days };
}

// Wraps an analytics call with a friendly error envelope so the LLM gets
// actionable text on token-scope or network failures instead of a stack trace.
async function analytics(label, fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = err.message || String(err);
    // Common case: the API token doesn't include the analytics scope.
    if (/403|401|unauthor/i.test(msg)) {
      return { error: true, message: `Staffbase Analytics is not available for the configured API token (${label}). Ask an admin to grant the analytics scope.` };
    }
    return { error: true, message: `Staffbase Analytics call failed (${label}): ${msg}` };
  }
}

// The /branch/analytics/posts/rankings response shape:
//   { entities: { posts: { [id]: rawPost }, channels: {...}, ... },
//     ranking: [{ postId, visits, uniqueVisitors, likes, comments, shares, ... }] }
// We resolve each ranking row against the `entities.posts` dictionary and
// re-use `shapePost` so titles/URLs/authors look identical to the rest of
// the connector's output.
function enrichRanking(payload) {
  const postEntities = payload?.entities?.posts || {};
  const rows = Array.isArray(payload?.ranking) ? payload.ranking : [];
  const out = [];
  for (const r of rows) {
    const postId = r.postId || r.id;
    if (!postId) continue;
    const raw = postEntities[postId];
    if (!raw) continue; // deleted post — skip
    const shaped = shapePost(raw);
    out.push({
      ...shaped,
      visits: Number(r.visits || 0),
      uniqueVisitors: Number(r.uniqueVisitors || 0),
      likes: Number(r.likes ?? shaped.likes ?? 0),
      comments: Number(r.comments ?? shaped.comments ?? 0),
      shares: Number(r.shares || 0),
    });
  }
  return out;
}

function scimFilter(parts) {
  return parts.filter(Boolean).join(' and ');
}

// "What's trending" — ranked posts by visits (or likes/comments/shares) across
// a recent window. Optional channelID / spaceID to narrow scope.
export async function topPosts({
  days = 7, limit = 10, sortBy = 'visits', channelID, spaceID,
} = {}) {
  return analytics('top_posts', async () => {
    const win = windowFromDays(days);
    const sortField = ['visits', 'likes', 'comments', 'shares'].includes(sortBy) ? sortBy : 'visits';
    const filter = scimFilter([
      channelID && `channelID eq "${channelID}"`,
      spaceID && `spaceId eq "${spaceID}"`,
    ]);
    const params = {
      since: win.since,
      until: win.until,
      sort: `${sortField}_DESC`,
      limit: Math.min(50, Math.max(1, limit)),
      enrich: true,
      groupBy: 'postId',
    };
    if (filter) params.filter = filter;
    const data = await get('/branch/analytics/posts/rankings', params);
    return {
      window: win,
      sortBy: sortField,
      posts: enrichRanking(data),
    };
  });
}

// Per-post engagement — headline numbers + day-by-day series for a sparkline.
export async function postPerformance({ postId, days = 30 } = {}) {
  if (!postId) return { error: true, message: 'postId is required' };
  return analytics('post_performance', async () => {
    const win = windowFromDays(days);
    const filter = `postId eq "${postId}"`;
    const [rankingData, seriesData] = await Promise.all([
      get('/branch/analytics/posts/rankings', {
        since: win.since, until: win.until, filter, enrich: true, groupBy: 'postId',
      }),
      get('/branch/analytics/posts/timeseries', {
        since: win.since, until: win.until, filter, groupBy: 'day',
      }),
    ]);
    const enriched = enrichRanking(rankingData);
    const post = enriched[0] || null;
    if (!post) {
      return { error: true, message: 'No analytics data for that post in the selected window — it may be too new or the post id may be wrong.' };
    }
    const daily = (seriesData?.timeseries || []).map((b) => ({
      date: b.date || b.timestamp || null,
      visits: Number(b.visits || 0),
      likes: Number(b.likes || 0),
      comments: Number(b.comments || 0),
      shares: Number(b.shares || 0),
    }));
    return {
      window: win,
      post,
      headline: {
        visits: post.visits,
        uniqueVisitors: post.uniqueVisitors,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
      },
      daily,
    };
  });
}

// Aggregate channel health — count of posts in window, total/avg engagement,
// top post by visits.
export async function channelHealth({ channelID, days = 30 } = {}) {
  if (!channelID) return { error: true, message: 'channelID is required' };
  return analytics('channel_health', async () => {
    const win = windowFromDays(days);
    const data = await get('/branch/analytics/posts/rankings', {
      since: win.since, until: win.until,
      filter: `channelID eq "${channelID}"`,
      sort: 'visits_DESC',
      enrich: true, groupBy: 'postId', limit: 50,
    });
    const posts = enrichRanking(data);
    const totals = posts.reduce((acc, p) => {
      acc.totalVisits += p.visits;
      acc.totalUniqueVisitors += p.uniqueVisitors;
      acc.totalLikes += p.likes;
      acc.totalComments += p.comments;
      acc.totalShares += p.shares;
      return acc;
    }, { totalVisits: 0, totalUniqueVisitors: 0, totalLikes: 0, totalComments: 0, totalShares: 0 });
    const postsInWindow = posts.length;
    const channel = posts[0]?.channel || { id: channelID, title: null };
    return {
      channel,
      window: win,
      totals: {
        ...totals,
        postsInWindow,
        avgVisitsPerPost: postsInWindow ? Math.round(totals.totalVisits / postsInWindow) : 0,
      },
      topPost: posts[0] || null,
      topPosts: posts.slice(0, 5),
    };
  });
}

// Platform pulse — total/registered/active/engaged users over the window,
// plus a daily series for a sparkline.
export async function audiencePulse({ days = 7, groupBy = 'day' } = {}) {
  return analytics('audience_pulse', async () => {
    const win = windowFromDays(days);
    const validGroupBy = ['hour', 'day', 'week', 'month', 'year'].includes(groupBy) ? groupBy : 'day';
    const data = await get('/branch/analytics/v2/users/timeseries', {
      since: win.since, until: win.until, groupBy: validGroupBy,
    });
    const total = data?.total || {};
    const daily = (data?.timeseries || []).map((b) => ({
      date: b.date || b.timestamp || null,
      totalUsers: Number(b.totalUsers || 0),
      registeredUsers: Number(b.registeredUsers || 0),
      activeUsers: Number(b.activeUsers || 0),
      engagedUsers: Number(b.engagedUsers || 0),
    }));
    return {
      window: win,
      total: {
        totalUsers: Number(total.totalUsers || 0),
        registeredUsers: Number(total.registeredUsers || 0),
        activeUsers: Number(total.activeUsers || 0),
        engagedUsers: Number(total.engagedUsers || 0),
      },
      daily,
    };
  });
}
