// Staffbase Intranet — MCP server backed by the real Staffbase REST API at
// campsite.staffbase.com.
//
// This MCP is a *capabilities envelope* over the public Staffbase API. Every
// tool returns a uniform contract that the orchestrator + ChatPanel know how
// to render inline:
//
//   {
//     summary: string,                  // narration-ready 1-liner for the LLM
//     chart:   { kind, title, labels, datasets } | undefined,  // → AnalyticsChartCard
//     cards:   { type, ...props }      | undefined,  // → CardRouter (new pipeline)
//     raw:     { ... }                  // full data for citation
//   }
//
// `chart` triggers a `chart_card` event in the orchestrator (existing).
// `cards` triggers a new `card` event handled by CardRouter (this PR).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import {
  listRecentPosts,
  listChannelPosts,
  searchPosts,
  getPost,
  listChannels,
  getChannel,
  listPagesDirect,
  searchUsers,
  getUser,
  listGroups,
  getGroup,
  listUsersInGroup,
  orgBreakdown,
  listSpaces,
  listComments,
  listPostComments,
  getCommentsActivity,
  listCampaigns,
  getCampaign,
  listCampaignReferences,
  listTags,
  listRecentMedia,
  getPostsTimeseries,
  getUsersTimeseries,
  getChatsTimeseries,
  getPostsRankings,
  getContentsRankings,
} from '../staffbase.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
};

function asResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

// ── Chart shaping helpers (kept for the existing analytics tools) ───────────

const CHART_COLORS = {
  primary: '#7C3AED',
  secondary: '#0EA5E9',
  tertiary: '#10B981',
  accent: '#F59E0B',
  warm: '#EF4444',
};

function formatTimeseriesLabel(group) {
  if (!group) return '';
  if (group.day && group.month && group.year) {
    return new Date(group.year, (group.month || 1) - 1, group.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (group.month && group.year) {
    return new Date(group.year, (group.month || 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  if (group.week && group.year) return `W${group.week} ${group.year}`;
  if (group.year) return String(group.year);
  return '';
}

function buildTimeseriesChart(metric, raw) {
  const ts = raw?.timeseries || [];
  const labels = ts.map((row) => formatTimeseriesLabel(row.group));
  let datasets = [];
  let title = '';
  if (metric === 'posts') {
    title = 'Posts engagement';
    datasets = [
      { label: 'Likes', data: ts.map((r) => r.likes || 0), color: CHART_COLORS.primary },
      { label: 'Comments', data: ts.map((r) => r.comments || 0), color: CHART_COLORS.secondary },
      { label: 'New posts', data: ts.map((r) => r.newPosts || 0), color: CHART_COLORS.tertiary },
    ];
  } else if (metric === 'users') {
    title = 'Active vs engaged users';
    datasets = [
      { label: 'Active users', data: ts.map((r) => r.activeUsers || 0), color: CHART_COLORS.primary },
      { label: 'Engaged users', data: ts.map((r) => r.engagedUsers || 0), color: CHART_COLORS.secondary },
    ];
  } else if (metric === 'chats') {
    title = 'Chat activity';
    datasets = [
      { label: 'Active chat users', data: ts.map((r) => r.activeChatUsers || 0), color: CHART_COLORS.primary },
      { label: 'Direct conversations', data: ts.map((r) => r.activeDirectConversations || 0), color: CHART_COLORS.secondary },
      { label: 'Group conversations', data: ts.map((r) => r.activeGroupConversations || 0), color: CHART_COLORS.tertiary },
    ];
  }
  return { kind: 'line', title, labels, datasets };
}

function pickEntityTitle(entities, type, id) {
  if (!entities || !id) return null;
  return entities[type]?.[id]?.title || entities[type]?.[id]?.name || null;
}

function shortLabel(s, n = 36) {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function buildRankingsChart(scope, raw, limit) {
  const ranks = Array.isArray(raw?.ranking) ? raw.ranking.slice(0, limit) : [];
  const entities = raw?.entities || {};
  const labels = ranks.map((r) => {
    if (scope === 'posts') {
      const id = r.group?.postId || r.postId;
      return shortLabel(pickEntityTitle(entities, 'posts', id) || '(untitled)');
    }
    const id = r.group?.contentId || r.contentId;
    return shortLabel(pickEntityTitle(entities, 'contents', id) || '(untitled)');
  });
  const visits = ranks.map((r) => r.registeredVisits ?? 0);
  const uniques = ranks.map((r) => r.registeredVisitors ?? 0);
  const datasets = scope === 'posts'
    ? [
        { label: 'Views', data: visits, color: CHART_COLORS.primary },
        { label: 'Likes + comments', data: ranks.map((r) => (r.likes || 0) + (r.comments || 0)), color: CHART_COLORS.secondary },
      ]
    : [
        { label: 'Views', data: visits, color: CHART_COLORS.primary },
        { label: 'Unique readers', data: uniques, color: CHART_COLORS.secondary },
      ];
  return {
    kind: 'bar',
    title: scope === 'posts' ? 'Top posts — engagement' : 'Top content — engagement',
    labels,
    datasets,
  };
}

// ── Card shaping helpers ────────────────────────────────────────────────────

function userToCard(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    department: u.department,
    location: u.location,
    avatar: u.avatar,
    manager: u.manager,
    customFields: u.customFields,
  };
}

function postToCard(p) {
  return {
    id: p.id,
    title: p.title,
    teaser: p.teaser,
    channel: p.channel,
    author: p.author,
    published: p.published,
    image: p.image || null,
    likes: p.likes,
    comments: p.comments,
    url: p.url,
  };
}

function formatNumber(n) {
  if (n == null) return '—';
  if (typeof n !== 'number') return String(n);
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

// ── Capabilities catalog (also referenced by describe_capabilities) ─────────

const CAPABILITIES = [
  {
    category: 'People & Org',
    description: "Find teammates, get profiles, list groups, break the org down by department/location/title.",
    examples: [
      'Who heads marketing?',
      'Find Anna in engineering',
      'Show the AI Assistant Debug group',
      'Tell me about Zyad Abuzeid',
      "What's our org breakdown by department?",
    ],
    tools: ['find_user', 'get_user_profile', 'list_groups', 'list_users_in_group', 'org_breakdown', 'list_spaces'],
  },
  {
    category: 'News & Content',
    description: 'Latest posts, search the intranet, drill into a single article, list pages and channels.',
    examples: [
      "What's new on Campsite this week?",
      'Find anything about Q3 strategy',
      'Show me the latest leadership posts',
      'Open the all-hands recap post',
      'Show all news channels by post volume',
    ],
    tools: ['list_recent_posts', 'search_posts', 'get_post', 'list_channels', 'list_pages', 'channel_posts'],
  },
  {
    category: 'Analytics & Engagement',
    description: 'Engagement trends, top performing content, multi-metric dashboards.',
    examples: [
      'How is engagement trending over the last 30 days?',
      'Top posts this month',
      'Show me a Campsite engagement summary',
      'Comment activity over the last week',
    ],
    tools: ['analytics_timeseries', 'analytics_rankings', 'engagement_summary', 'comments_activity'],
  },
  {
    category: 'Conversations & Comments',
    description: 'Recent comments across the intranet or scoped to a single post.',
    examples: [
      'Recent comments on the intranet',
      'Comments on the all-hands post',
    ],
    tools: ['list_comments', 'list_post_comments'],
  },
  {
    category: 'Campaigns',
    description: 'Active campaigns, their goals, and the content scheduled into them.',
    examples: [
      'What active campaigns do we have?',
      'Show the items in the Health & Safety campaign',
    ],
    tools: ['list_campaigns', 'campaign_detail'],
  },
  {
    category: 'Taxonomy & Media',
    description: 'Tags and media assets used across the workspace.',
    examples: [
      'What tags do we use?',
      'Show recent media uploads',
    ],
    tools: ['list_tags', 'list_recent_media'],
  },
  {
    category: 'Discovery',
    description: 'Meta-tools to discover what this Staffbase MCP can answer.',
    examples: [
      'What can you tell me about Staffbase?',
      'What data do you have access to?',
    ],
    tools: ['describe_capabilities', 'global_search'],
  },
];

function buildServer() {
  const server = new McpServer({ name: 'staffbase-intranet', version: '2.0.0' });

  // ─────────────────────────────────────────────────────────────────────────
  // People & Org
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'find_user',
    'Find Staffbase teammates by name, email, title, department, role, or any natural-language descriptor (e.g. "head of marketing", "engineers in Berlin", "Anna"). Uses the server-side /users?query= filter to narrow the candidate pool, then re-ranks with a weighted scorer across name/title/department/email. Returns ranked matches with avatars, ready to render as a UserGrid.',
    {
      query: z.string().describe('Free-text query: a name, email, title, department, or descriptor.'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10).'),
    },
    async ({ query, limit }) => {
      try {
        const users = await searchUsers(query, { limit: limit || 10 });
        const summary = users.length
          ? `Found ${users.length} teammate${users.length === 1 ? '' : 's'} matching "${query}". Top match: ${users[0].name}${users[0].title ? ` (${users[0].title})` : ''}.`
          : `No teammates matched "${query}".`;
        return asResult({
          summary,
          cards: { type: 'user_grid', title: `Matches for "${query}"`, users: users.map(userToCard) },
          raw: { query, count: users.length, users },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'get_user_profile',
    'Fetch the full profile for one Staffbase user by id (job title, department, location, manager, avatar, custom fields). Use this after find_user surfaces an id, or when the user names a specific person.',
    { userId: z.string().describe('The Staffbase user id (from find_user).') },
    async ({ userId }) => {
      try {
        const u = await getUser(userId);
        return asResult({
          summary: `${u.name}${u.title ? ` — ${u.title}` : ''}${u.department ? `, ${u.department}` : ''}.`,
          cards: { type: 'user', user: userToCard(u) },
          raw: u,
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_groups',
    'List Staffbase groups (departments, role groups, feature opt-ins). Returns a leaderboard ranked by member count so the LLM can spot the most populated groups quickly.',
    { limit: z.number().int().min(1).max(100).optional().describe('Max groups to return (default 30).') },
    async ({ limit }) => {
      try {
        const groups = await listGroups({ limit: limit || 30 });
        const ranked = [...groups].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
        const top = ranked.slice(0, 10);
        return asResult({
          summary: `Workspace has ${groups.length} groups${ranked[0]?.name ? `. Largest: ${ranked[0].name} (${ranked[0].memberCount} members)` : ''}.`,
          cards: {
            type: 'leaderboard',
            title: 'Groups by member count',
            rows: top.map((g) => ({ id: g.id, label: g.name, value: g.memberCount || 0, sublabel: g.description || g.type })),
            valueLabel: 'members',
          },
          raw: { count: groups.length, groups: ranked },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_users_in_group',
    'List the members of a specific Staffbase group. Use this after list_groups returns the id, or when the user names a recognisable group (e.g. "Marketing", "Engineering"). Renders as a UserGrid.',
    {
      groupId: z.string().describe('The Staffbase group id.'),
      limit: z.number().int().min(1).max(100).optional().describe('Max members (default 25).'),
    },
    async ({ groupId, limit }) => {
      try {
        const [group, members] = await Promise.all([
          getGroup(groupId).catch(() => null),
          listUsersInGroup(groupId, { limit: limit || 25 }),
        ]);
        const groupName = group?.name || 'group';
        return asResult({
          summary: members.length
            ? `${members.length} members in ${groupName}.`
            : `No members found in ${groupName}.`,
          cards: { type: 'user_grid', title: `${groupName} — members`, users: members.map(userToCard) },
          raw: { group, count: members.length, members },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'org_breakdown',
    'Aggregated employee breakdown by department, location, or title. Samples up to 1000 users and tallies the top buckets. Returns a bar chart and a leaderboard. Best for "what does our org look like?", "where are most engineers based?", "which department is biggest?".',
    {
      by: z.enum(['department', 'location', 'title']).optional().describe('Which profile field to aggregate by (default department).'),
      limit: z.number().int().min(3).max(20).optional().describe('How many buckets to show (default 12).'),
    },
    async ({ by, limit }) => {
      try {
        const field = by || 'department';
        const r = await orgBreakdown(field, { sample: 1000, limit: limit || 12 });
        const labels = r.buckets.map((b) => shortLabel(b.name, 24));
        const data = r.buckets.map((b) => b.count);
        return asResult({
          summary: `Sampled ${r.sampled} of ${r.totalDirectory || '?'} employees by ${field}. Largest: ${r.buckets[0]?.name} (${r.buckets[0]?.count}).`,
          chart: {
            kind: 'bar',
            title: `Employees by ${field}`,
            labels,
            datasets: [{ label: 'Headcount', data, color: CHART_COLORS.primary }],
          },
          cards: {
            type: 'leaderboard',
            title: `Top ${field}s`,
            rows: r.buckets.map((b) => ({ label: b.name, value: b.count })),
            valueLabel: 'people',
          },
          raw: r,
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_spaces',
    'List the Staffbase Spaces (multi-product structure: Employee App / Front Door / etc.). Most tenants have a single space; multi-product tenants have several.',
    {},
    async () => {
      try {
        const spaces = await listSpaces({ limit: 30 });
        return asResult({
          summary: `Workspace has ${spaces.length} space${spaces.length === 1 ? '' : 's'}.`,
          cards: {
            type: 'leaderboard',
            title: 'Spaces',
            rows: spaces.map((s) => ({ label: s.name, value: s.accessorCount, sublabel: `${s.childCount} children, ${s.sectionCount} sections` })),
            valueLabel: 'accessors',
          },
          raw: { count: spaces.length, spaces },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // News & Content
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'list_recent_posts',
    'Latest published posts from the company intranet. Use for "what\'s new", "latest announcements", "recent leadership memos". Renders as a PostList with thumbnails.',
    {
      limit: z.number().int().min(1).max(50).optional().describe('How many posts (default 10).'),
      channelID: z.string().optional().describe('Optional channel id to scope results.'),
    },
    async ({ limit, channelID }) => {
      try {
        const posts = await listRecentPosts({ limit: limit || 10, channelID });
        return asResult({
          summary: posts.length
            ? `Showing ${posts.length} most recent posts${channelID ? ' in this channel' : ''}.`
            : 'No recent posts found.',
          cards: { type: 'post_list', title: 'Recent posts', posts: posts.map(postToCard) },
          raw: { count: posts.length, posts },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'search_posts',
    'Keyword search across intranet posts. Tries the server-side /posts?query= filter first (fast, broad coverage) and falls back to a client-side scan. Best for "find anything on Q3 roadmap", "posts mentioning AI Assistant".',
    {
      query: z.string().describe('Search keywords.'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10).'),
    },
    async ({ query, limit }) => {
      try {
        const posts = await searchPosts(query, { limit: limit || 10 });
        return asResult({
          summary: posts.length
            ? `Found ${posts.length} posts mentioning "${query}".`
            : `No posts matched "${query}".`,
          cards: { type: 'post_list', title: `Posts matching "${query}"`, posts: posts.map(postToCard) },
          raw: { query, count: posts.length, posts },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'get_post',
    'Fetch the full content of one intranet post by its id, including the body (HTML-stripped) and feature image. Use after list_recent_posts or search_posts surfaces an id.',
    { postId: z.string().describe('The post id.') },
    async ({ postId }) => {
      try {
        const post = await getPost(postId);
        return asResult({
          summary: `${post.title}${post.author?.name ? ` — by ${post.author.name}` : ''}${post.channel?.title ? `, ${post.channel.title}` : ''}.`,
          cards: { type: 'post', post: { ...postToCard(post), body: post.content || null } },
          raw: post,
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'channel_posts',
    'List the recent posts published in one channel. Use after list_channels surfaces a channel id, or when the user names a known channel.',
    {
      channelId: z.string().describe('The channel id.'),
      limit: z.number().int().min(1).max(30).optional().describe('Max posts (default 10).'),
    },
    async ({ channelId, limit }) => {
      try {
        const [channel, posts] = await Promise.all([
          getChannel(channelId).catch(() => null),
          listChannelPosts(channelId, { limit: limit || 10 }),
        ]);
        const name = channel?.title || 'channel';
        return asResult({
          summary: `${posts.length} recent posts in ${name}.`,
          cards: { type: 'post_list', title: `${name} — recent posts`, posts: posts.map(postToCard) },
          raw: { channel, count: posts.length, posts },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_channels',
    'List the intranet news channels with their post counts. Renders as a leaderboard so the LLM can see which channels are most active. Use for "what channels are there?", "most active news channels".',
    { limit: z.number().int().min(1).max(100).optional().describe('Max channels (default 50).') },
    async ({ limit }) => {
      try {
        const channels = await listChannels({ limit: limit || 50 });
        const ranked = [...channels].sort((a, b) => (b.postCount || 0) - (a.postCount || 0));
        const top = ranked.slice(0, 12);
        return asResult({
          summary: `${channels.length} channels${ranked[0] ? `. Largest: ${ranked[0].title} (${formatNumber(ranked[0].postCount)} posts)` : ''}.`,
          cards: {
            type: 'leaderboard',
            title: 'Channels by post volume',
            rows: top.map((c) => ({ id: c.id, label: c.title, value: c.postCount || 0, sublabel: c.description })),
            valueLabel: 'posts',
          },
          raw: { count: channels.length, channels: ranked },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_pages',
    'List intranet pages (reference content / wiki-style entries, not news posts). Uses the /pages endpoint directly which is more comprehensive than the /installations route.',
    { limit: z.number().int().min(1).max(50).optional().describe('Max pages (default 20).') },
    async ({ limit }) => {
      try {
        const pages = await listPagesDirect({ limit: limit || 20 });
        return asResult({
          summary: `${pages.length} pages.`,
          cards: {
            type: 'post_list',
            title: 'Intranet pages',
            posts: pages.map((p) => ({
              id: p.id,
              title: p.title,
              teaser: (p.bodyExcerpt || '').slice(0, 240),
              channel: { title: p.contentType || 'Page' },
              published: p.publishedAt,
              image: null,
              likes: null,
              comments: null,
            })),
          },
          raw: { count: pages.length, pages },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Comments
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'list_comments',
    'Recent comments across the intranet. Optionally filter to the last N days. Renders as a TimelineCard. Good for "recent comments", "what are people talking about?".',
    {
      sinceDays: z.number().int().min(1).max(90).optional().describe('Window size (default 7 days).'),
      limit: z.number().int().min(1).max(50).optional().describe('Max comments (default 25).'),
    },
    async ({ sinceDays, limit }) => {
      try {
        const comments = await listComments({ sinceDays: sinceDays || 7, limit: limit || 25 });
        return asResult({
          summary: `${comments.length} comments in the last ${sinceDays || 7} days.`,
          cards: {
            type: 'timeline',
            title: `Recent comments — last ${sinceDays || 7} days`,
            events: comments.map((c) => ({
              id: c.id,
              when: c.created,
              icon: c.isReply ? 'reply' : 'comment',
              title: c.author?.name || 'Someone',
              detail: c.text,
              avatar: c.author?.avatar || null,
            })),
          },
          raw: { count: comments.length, comments },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_post_comments',
    'Comments left on one specific post. Use after get_post or list_recent_posts surfaces an id.',
    {
      postId: z.string().describe('The post id.'),
      limit: z.number().int().min(1).max(50).optional().describe('Max comments (default 25).'),
    },
    async ({ postId, limit }) => {
      try {
        const comments = await listPostComments(postId, { limit: limit || 25 });
        return asResult({
          summary: `${comments.length} comments on this post.`,
          cards: {
            type: 'timeline',
            title: 'Comments on this post',
            events: comments.map((c) => ({
              id: c.id,
              when: c.created,
              icon: c.isReply ? 'reply' : 'comment',
              title: c.author?.name || 'Someone',
              detail: c.text,
              avatar: c.author?.avatar || null,
            })),
          },
          raw: { postId, count: comments.length, comments },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'comments_activity',
    'Daily comment volume across the intranet for the last N days. Best for "are people commenting more lately?", "comment activity trend". Returns a bar chart.',
    { sinceDays: z.number().int().min(1).max(60).optional().describe('Window size (default 14 days).') },
    async ({ sinceDays }) => {
      try {
        const r = await getCommentsActivity({ sinceDays: sinceDays || 14, scan: 500 });
        const labels = r.days.map((d) => new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        return asResult({
          summary: `${r.sampled} comments sampled across the last ${r.sinceDays} days (${formatNumber(r.totalMatching)} total matching).`,
          chart: {
            kind: 'bar',
            title: `Comment activity — last ${r.sinceDays} days`,
            labels,
            datasets: [{ label: 'Comments', data: r.days.map((d) => d.count), color: CHART_COLORS.secondary }],
          },
          raw: r,
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Analytics
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'analytics_timeseries',
    'Engagement and activity trends. Returns a chartable timeseries (and the raw data) for posts engagement, user activity, or chat activity over a date range. Best for "show me engagement over the last 30 days", "weekly active users for the quarter", "how is chat activity trending?".',
    {
      metric: z.enum(['posts', 'users', 'chats']).describe('Which timeseries: posts, users, or chats.'),
      groupBy: z.enum(['day', 'week', 'month']).optional().describe('Bucket size (default day).'),
      sinceDays: z.number().int().min(1).max(365).optional().describe('Window size (default 30 days).'),
    },
    async ({ metric, groupBy, sinceDays }) => {
      try {
        const opts = { groupBy: groupBy || 'day', sinceDays: sinceDays || 30 };
        let raw;
        if (metric === 'posts') raw = await getPostsTimeseries(opts);
        else if (metric === 'users') raw = await getUsersTimeseries(opts);
        else raw = await getChatsTimeseries(opts);
        const chart = buildTimeseriesChart(metric, raw);
        chart.title = `${chart.title} — last ${opts.sinceDays} days`;
        return asResult({
          summary: `${chart.title} (grouped by ${opts.groupBy}).`,
          metric, groupBy: opts.groupBy, sinceDays: opts.sinceDays, chart, raw,
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'analytics_rankings',
    'Top performing posts or content pages by visits, likes, and comments. Returns a ranked bar chart. Best for "most read posts this month", "top content by engagement", "best performing news".',
    {
      scope: z.enum(['posts', 'contents']).describe('Rank posts (news items) or contents (channels/pages).'),
      limit: z.number().int().min(1).max(20).optional().describe('How many to return (default 5).'),
      sinceDays: z.number().int().min(1).max(365).optional().describe('Window size (default 30 days).'),
    },
    async ({ scope, limit, sinceDays }) => {
      try {
        const opts = { limit: limit || 5, sinceDays: sinceDays || 30 };
        const raw = scope === 'posts'
          ? await getPostsRankings({ ...opts, enrich: true })
          : await getContentsRankings(opts);
        const chart = buildRankingsChart(scope, raw, opts.limit);
        chart.title = `${chart.title} — last ${opts.sinceDays} days`;
        const top = chart.labels[0];
        return asResult({
          summary: `${chart.title}${top ? `. Top: ${top}` : ''}.`,
          scope, limit: opts.limit, sinceDays: opts.sinceDays, chart, raw,
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'engagement_summary',
    'A single-call dashboard that joins posts, users, and chats timeseries into one multi-line chart plus headline KPIs (total active users, engaged users, new posts, total likes/comments). Best for "how is Campsite engagement overall?", "give me a dashboard view".',
    { sinceDays: z.number().int().min(7).max(180).optional().describe('Window size (default 30 days).') },
    async ({ sinceDays }) => {
      try {
        const days = sinceDays || 30;
        const opts = { groupBy: 'day', sinceDays: days };
        const [postsTs, usersTs, chatsTs] = await Promise.all([
          getPostsTimeseries(opts),
          getUsersTimeseries(opts),
          getChatsTimeseries(opts),
        ]);
        const ts = postsTs?.timeseries || [];
        const labels = ts.map((r) => formatTimeseriesLabel(r.group));

        // Stretch the users/chats series to match posts labels by group key.
        const labelOf = (g) => formatTimeseriesLabel(g);
        const usersByLabel = new Map((usersTs?.timeseries || []).map((r) => [labelOf(r.group), r]));
        const chatsByLabel = new Map((chatsTs?.timeseries || []).map((r) => [labelOf(r.group), r]));

        const datasets = [
          { label: 'Active users', data: labels.map((l) => usersByLabel.get(l)?.activeUsers || 0), color: CHART_COLORS.primary },
          { label: 'Engaged users', data: labels.map((l) => usersByLabel.get(l)?.engagedUsers || 0), color: CHART_COLORS.secondary },
          { label: 'New posts', data: ts.map((r) => r.newPosts || 0), color: CHART_COLORS.tertiary },
          { label: 'Chat users', data: labels.map((l) => chatsByLabel.get(l)?.activeChatUsers || 0), color: CHART_COLORS.accent },
        ];

        const sum = (arr) => arr.reduce((s, x) => s + (x || 0), 0);
        const totalLikes = sum(ts.map((r) => r.likes || 0));
        const totalComments = sum(ts.map((r) => r.comments || 0));
        const totalNewPosts = sum(ts.map((r) => r.newPosts || 0));
        const peakActive = Math.max(0, ...datasets[0].data);
        const peakEngaged = Math.max(0, ...datasets[1].data);

        return asResult({
          summary: `Last ${days} days: ${formatNumber(totalNewPosts)} new posts, ${formatNumber(totalLikes)} likes, ${formatNumber(totalComments)} comments. Peak ${formatNumber(peakActive)} active / ${formatNumber(peakEngaged)} engaged users.`,
          chart: { kind: 'line', title: `Engagement summary — last ${days} days`, labels, datasets },
          cards: {
            type: 'kpi',
            title: `Headline KPIs — last ${days} days`,
            tiles: [
              { label: 'New posts', value: formatNumber(totalNewPosts) },
              { label: 'Likes', value: formatNumber(totalLikes) },
              { label: 'Comments', value: formatNumber(totalComments) },
              { label: 'Peak active users', value: formatNumber(peakActive) },
            ],
          },
          raw: { sinceDays: days, postsTs, usersTs, chatsTs },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Campaigns
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'list_campaigns',
    'List active and recent Staffbase campaigns with their goals, dates, and stats. Renders as a PostList shaped for campaigns.',
    { limit: z.number().int().min(1).max(50).optional().describe('Max campaigns (default 20).') },
    async ({ limit }) => {
      try {
        const campaigns = await listCampaigns({ limit: limit || 20 });
        return asResult({
          summary: `${campaigns.length} campaigns.`,
          cards: {
            type: 'post_list',
            title: 'Campaigns',
            posts: campaigns.map((c) => ({
              id: c.id,
              title: c.title,
              teaser: c.goal || '',
              channel: { title: c.startAt && c.endAt ? `${c.startAt.slice(0,10)} → ${c.endAt.slice(0,10)}` : 'Campaign' },
              published: c.startAt,
              image: null,
              likes: null,
              comments: null,
              meta: { actionsCount: c.actionsCount, color: c.color },
            })),
          },
          raw: { count: campaigns.length, campaigns },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'campaign_detail',
    'Detail view of one campaign, with the timeline of content (references) scheduled into it.',
    { campaignId: z.string().describe('The campaign id (from list_campaigns).') },
    async ({ campaignId }) => {
      try {
        const [campaign, references] = await Promise.all([
          getCampaign(campaignId),
          listCampaignReferences(campaignId, { sort: 'updated_DESC', limit: 25 }).catch(() => []),
        ]);
        return asResult({
          summary: `${campaign.title}${campaign.goal ? ` — ${campaign.goal}` : ''}. ${references.length} references.`,
          cards: {
            type: 'timeline',
            title: `${campaign.title} — schedule`,
            events: references.map((r) => ({
              id: r.id,
              when: r.plannedAt || r.updatedAt,
              icon: 'campaign',
              title: r.title || `${r.sourceType || 'item'} ${r.referenceID || ''}`.trim(),
              detail: r.status || r.sourceType || '',
            })),
          },
          raw: { campaign, references },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Taxonomy & Media
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'list_tags',
    'List the tags used across the workspace, ranked by how many items use them. Useful for content discovery.',
    { limit: z.number().int().min(5).max(100).optional().describe('Max tags (default 30).') },
    async ({ limit }) => {
      try {
        const tags = await listTags({ limit: limit || 30 });
        const ranked = [...tags].sort((a, b) => (b.count || 0) - (a.count || 0));
        return asResult({
          summary: `${tags.length} tags${ranked[0] ? `. Most used: "${ranked[0].name}" (${ranked[0].count})` : ''}.`,
          cards: {
            type: 'leaderboard',
            title: 'Top tags',
            rows: ranked.slice(0, 15).map((t) => ({ label: t.name, value: t.count || 0 })),
            valueLabel: 'items',
          },
          raw: { count: tags.length, tags: ranked },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_recent_media',
    'Recently uploaded media assets (images, videos, files). Returns metadata; clients render thumbnails where image URLs are present.',
    { limit: z.number().int().min(1).max(48).optional().describe('Max items (default 12).') },
    async ({ limit }) => {
      try {
        const media = await listRecentMedia({ limit: limit || 12 });
        return asResult({
          summary: `${media.length} recent media items.`,
          cards: {
            type: 'post_list',
            title: 'Recent media',
            posts: media.map((m) => ({
              id: m.id,
              title: m.fileName || m.label || '(unnamed)',
              teaser: `${m.format || m.mimeType || ''}${m.width ? ` · ${m.width}×${m.height}` : ''}${m.bytes ? ` · ${Math.round(m.bytes / 1024)} KB` : ''}`,
              channel: { title: 'Media' },
              published: m.created,
              image: m.url || null,
              likes: null,
              comments: null,
            })),
          },
          raw: { count: media.length, media },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Discovery
  // ─────────────────────────────────────────────────────────────────────────

  server.tool(
    'global_search',
    'Fans out a single query across posts, users, and channels in parallel. Best when the user asks an ambiguous question and you don\'t yet know which surface holds the answer (e.g. "anything about Q3", "find me everything on health & safety").',
    {
      query: z.string().describe('The query.'),
      limit: z.number().int().min(1).max(15).optional().describe('Max items per surface (default 5).'),
    },
    async ({ query, limit }) => {
      try {
        const per = limit || 5;
        const [posts, users, channels] = await Promise.all([
          searchPosts(query, { limit: per }).catch(() => []),
          searchUsers(query, { limit: per }).catch(() => []),
          listChannels({ limit: 100 }).then((all) => {
            const q = query.toLowerCase();
            return all.filter((c) => (c.title || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)).slice(0, per);
          }).catch(() => []),
        ]);
        const total = posts.length + users.length + channels.length;
        return asResult({
          summary: total
            ? `Found ${posts.length} posts, ${users.length} people, ${channels.length} channels for "${query}".`
            : `Nothing matched "${query}".`,
          cards: {
            type: 'mixed',
            title: `Results for "${query}"`,
            sections: [
              { kind: 'post_list', title: 'Posts', posts: posts.map(postToCard) },
              { kind: 'user_grid', title: 'People', users: users.map(userToCard) },
              { kind: 'leaderboard', title: 'Channels', rows: channels.map((c) => ({ id: c.id, label: c.title, value: c.postCount || 0, sublabel: c.description })), valueLabel: 'posts' },
            ].filter((s) => (s.posts || s.users || s.rows || []).length > 0),
          },
          raw: { query, posts, users, channels },
        });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'describe_capabilities',
    'Returns a structured catalog of what this Staffbase MCP can answer, organised by category, with example questions per category. CALL THIS FIRST when the user asks "what can you do", "what data do you have", "help me get started", or any meta question about what\'s available. Renders as a CapabilitiesCard.',
    {},
    async () => {
      return asResult({
        summary: `This Staffbase integration covers ${CAPABILITIES.length} capability areas: ${CAPABILITIES.map((c) => c.category).join(', ')}.`,
        cards: {
          type: 'capabilities',
          title: 'What you can ask Staffbase',
          categories: CAPABILITIES,
        },
        raw: { categories: CAPABILITIES },
      });
    }
  );

  return server;
}

// ── HTTP handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed for stateless server' }, id: null });
    return;
  }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  } catch (err) {
    console.error('[mcp-staffbase]', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
}
