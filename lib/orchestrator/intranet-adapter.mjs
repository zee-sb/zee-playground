// Adapter — shapes Staffbase MCP-proxy responses into the `cards` field
// the Companion chat UI knows how to render.
//
// The team's MCP-proxy returns raw Staffbase API JSON (driven by the
// OpenAPI specs), which is great for an LLM tool-calling loop but not for
// the prototype's pretty card components. The old `lib/mcp-servers/
// staffbase.mjs` mock used to bake `cards` into its responses; this
// adapter does the same job after the fact for whichever tool got called.
//
// Tools we explicitly shape:
//   GetPosts, SearchPosts, GetChannelPosts, GetClientChannelPosts,
//   GetClientNewsPagePosts  → { type: 'post_list', posts }
//   GetPost                 → { type: 'post', post }
//   GetChannels, GetBranchChannels, GetClientNewsPageChannels
//                           → { type: 'post_list', posts: <channels-as-tiles> }
//   searchProfiles, getProfiles
//                           → { type: 'user_grid', users }
//   getProfile, getPublicProfile
//                           → { type: 'user', user }
//
// Everything else passes through unchanged — the LLM will summarize the raw
// JSON in prose.

function pickLocalized(obj, key = 'contents') {
  const bag = obj?.[key];
  if (!bag || typeof bag !== 'object') return null;
  // Prefer en_US/en, then any first non-empty entry.
  for (const lang of ['en_US', 'en', ...Object.keys(bag)]) {
    if (bag[lang] && typeof bag[lang] === 'object') return bag[lang];
  }
  return null;
}

function authorToCard(a) {
  if (!a || typeof a !== 'object') return undefined;
  const first = a.firstName || '';
  const last = a.lastName || '';
  const name = [first, last].filter(Boolean).join(' ').trim() || a.publicEmailAddress || '';
  return {
    id: a.id,
    name,
    avatar: a.avatar?.icon?.url || a.avatar?.thumb?.url || a.avatar?.original?.url || null,
  };
}

function postToCard(p) {
  const localized = pickLocalized(p, 'contents') || {};
  const channelLocalized = pickLocalized(p.channel?.config || {}, 'localization') || {};
  const image =
    localized.feedImage?.original?.url ||
    localized.feedImage?.url ||
    localized.image?.original?.url ||
    localized.image?.url ||
    null;
  return {
    id: p.id,
    title: localized.title || '(untitled)',
    teaser: localized.teaser || stripHtml(localized.content || '').slice(0, 200),
    channel: p.channel
      ? { id: p.channelID || p.channel.id, title: channelLocalized.title || '' }
      : (p.channelID ? { id: p.channelID, title: '' } : undefined),
    author: authorToCard(p.author),
    published: p.published || p.publishedAt || p.created,
    image,
    likes: p.likes,
    comments: p.comments,
    url: p.links?.html || p.links?.webUrl || null,
  };
}

function channelToCard(c) {
  const localized = pickLocalized(c.config || {}, 'localization') || {};
  return {
    id: c.id,
    title: localized.title || '(unnamed channel)',
    teaser: localized.description || '',
    channel: { id: c.id, title: localized.title || '' },
    published: c.lastPostPublishedAt || c.updated,
    image: null,
  };
}

function profileToCard(raw) {
  // searchProfiles returns a wrapper { data: { internalUserId, values: {...} } }
  // — flatten it so the rest of the helper can read fields uniformly.
  const u = raw?.data && raw.data.values
    ? { id: raw.data.internalUserId, ...raw.data.values }
    : (raw || {});
  const profile = u.profile || {};
  const first = u.firstName || profile.firstName || u.firstname || '';
  const last = u.lastName || profile.lastName || u.lastname || '';
  const name = [first, last].filter(Boolean).join(' ').trim()
    || u.fullName
    || u.publicEmailAddress
    || u.email
    || u.id
    || '(unknown)';
  return {
    id: u.id,
    name,
    email: u.publicEmailAddress || profile.publicEmailAddress || u.email || null,
    title: u.position || profile.position || u.positionroletag || null,
    department: u.department || profile.department || u.department_1 || null,
    location: u.location || profile.location || u.locationtag || null,
    avatar: u.avatar?.icon?.url || profile.avatar?.icon?.url || u.avatar?.thumb?.url || null,
  };
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const POST_LIST_TOOLS = new Set([
  'GetPosts',
  'SearchPosts',
  'GetChannelPosts',
  'GetClientChannelPosts',
  'GetClientNewsPagePosts',
]);
const CHANNEL_LIST_TOOLS = new Set([
  'GetChannels',
  'GetBranchChannels',
  'GetClientNewsPageChannels',
]);
const PROFILE_LIST_TOOLS = new Set([
  'searchProfiles',
  'getProfiles',
]);
const PROFILE_SINGLE_TOOLS = new Set([
  'getProfile',
  'getPublicProfile',
]);

// Mutates the result in place — adds a `cards` field next to the raw data
// so the orchestrator's existing card-emit logic picks it up. Returns the
// same object for fluent chaining.
export function adaptIntranetResult(toolName, result, { query } = {}) {
  if (!result || typeof result !== 'object') return result;

  if (POST_LIST_TOOLS.has(toolName)) {
    const posts = Array.isArray(result.data) ? result.data.map(postToCard) : [];
    result.cards = {
      type: 'post_list',
      title: toolName === 'SearchPosts' && query
        ? `Posts matching "${query}"`
        : (toolName === 'GetChannelPosts' ? 'Channel posts' : 'Recent posts'),
      posts,
    };
    return result;
  }

  if (CHANNEL_LIST_TOOLS.has(toolName)) {
    const posts = Array.isArray(result.data) ? result.data.map(channelToCard) : [];
    result.cards = { type: 'post_list', title: 'Channels', posts };
    return result;
  }

  if (PROFILE_LIST_TOOLS.has(toolName)) {
    // searchProfiles returns `{ entries, total }`, getProfiles returns array.
    const raw = Array.isArray(result.entries)
      ? result.entries
      : (Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []));
    const users = raw.map(profileToCard);
    result.cards = {
      type: 'user_grid',
      title: query ? `Matches for "${query}"` : 'People',
      users,
    };
    return result;
  }

  if (PROFILE_SINGLE_TOOLS.has(toolName)) {
    // The result is the profile itself (no envelope).
    const user = profileToCard(result);
    result.cards = { type: 'user', user };
    return result;
  }

  // GetPost — single post by id.
  if (toolName === 'GetPost') {
    const post = postToCard(result);
    result.cards = { type: 'post', post };
    return result;
  }

  return result;
}
