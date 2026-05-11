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

function shapeUser(u) {
  return {
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.profile?.firstName || u.email || '(unknown)',
    email: u.emails?.[0]?.value || null,
    title: u.profile?.position || null,
    department: u.profile?.department || null,
    location: u.profile?.location || null,
    activated: u.activated,
    avatar: u.avatar?.icon?.url || u.avatar?.original?.url || null,
  };
}

export async function listUsers({ limit = 50 } = {}) {
  const data = await get('/users', { limit });
  return (data.data || []).map(shapeUser);
}

export async function searchUsers(query, { limit = 10, scan = 200 } = {}) {
  const data = await get('/users', { limit: scan });
  const q = (query || '').toLowerCase();
  const users = (data.data || []).map(shapeUser);
  if (!q) return users.slice(0, limit);
  return users
    .filter((u) => `${u.name} ${u.email} ${u.title} ${u.department}`.toLowerCase().includes(q))
    .slice(0, limit);
}

export async function getUser(userId) {
  const data = await get(`/users/${userId}`);
  return shapeUser(data);
}
