// Staffbase Intranet — MCP server backed by the REAL Staffbase REST API
// at campsite.staffbase.com. Replaces the mocked api/mcp-intranet.mjs for the
// Companion v2 orchestrator's "intranet" connector slot.
//
// Tools:
//   - list_recent_posts(limit?, channelID?)  — latest news/announcements
//   - search_posts(query, limit?)           — keyword search across titles/teasers
//   - get_post(postId)                      — full content of one post
//   - list_channels()                       — published intranet channels
//   - search_users(query, limit?)           — find a teammate
//   - get_user(userId)                      — full profile of one teammate

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import {
  listRecentPosts,
  searchPosts,
  getPost,
  listChannels,
  searchUsers,
  getUser,
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

// ── Chart shaping helpers ───────────────────────────────────────────────────
// The orchestrator looks for `chart` on tool results and emits a chart_card
// event into the chat stream so ChatPanel renders an inline Chart.js card.

const CHART_COLORS = {
  primary: '#7C3AED',
  secondary: '#0EA5E9',
  tertiary: '#10B981',
  accent: '#F59E0B',
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

function buildServer() {
  const server = new McpServer({ name: 'staffbase-intranet', version: '1.0.0' });

  server.tool(
    'list_recent_posts',
    'Latest published posts from the company intranet (Staffbase News). Returns the most recent N posts with title, teaser, author, channel, and direct link. Use this when the user asks for "what\'s new", "latest announcements", "recent leadership memos", etc.',
    {
      limit: z.number().int().min(1).max(50).optional().describe('How many posts to return (default 10).'),
      channelID: z.string().optional().describe('Optional channel id to scope results to one news channel.'),
    },
    async ({ limit, channelID }) => {
      try {
        const posts = await listRecentPosts({ limit: limit || 10, channelID });
        return asResult({ count: posts.length, posts });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'search_posts',
    'Keyword search across intranet posts. Returns posts whose title or teaser matches the query. Best for "find articles about X", "anything on Q2 roadmap?", "pages mentioning AI".',
    {
      query: z.string().describe('Search keywords.'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results to return (default 10).'),
    },
    async ({ query, limit }) => {
      try {
        const posts = await searchPosts(query, { limit: limit || 10 });
        return asResult({ query, count: posts.length, posts });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'get_post',
    'Fetch the full content of one intranet post by its id, including the body (HTML-stripped) and any feature image.',
    { postId: z.string().describe('The post id (from list_recent_posts or search_posts).') },
    async ({ postId }) => {
      try {
        const post = await getPost(postId);
        return asResult(post);
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'list_channels',
    'List the intranet news channels that exist (e.g. AI corner, Leadership, Product updates). Use this if the user asks "what channels are there?" or wants to scope a search.',
    {},
    async () => {
      try {
        const channels = await listChannels({ limit: 50 });
        return asResult({ count: channels.length, channels });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'search_users',
    'Find Staffbase teammates by name, email, title, department, or role keyword. Uses weighted relevance scoring across all profile fields (name 3x > title 2x > department 1.5x > email 1x) so it handles natural-language queries like "head of marketing", "berlin engineering", or "carol davis". Returns ranked matches with avatar URLs ready to render as user cards.',
    {
      query: z.string().describe('Free-text query: a name, email, title, department, or role keyword (e.g. "marketing", "people ops in berlin", "alice").'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10).'),
    },
    async ({ query, limit }) => {
      try {
        const users = await searchUsers(query, { limit: limit || 10 });
        return asResult({ query, count: users.length, users });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'get_user',
    'Fetch a single Staffbase user by id.',
    { userId: z.string().describe('The Staffbase user id.') },
    async ({ userId }) => {
      try {
        const user = await getUser(userId);
        return asResult(user);
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'analytics_timeseries',
    'Engagement and activity trends from the Staffbase intranet. Returns a chartable timeseries (and the raw data) for posts engagement, users activity, or chat activity over a date range. Best for questions like "show me engagement over the last 30 days", "how is intranet activity trending?", "weekly active users for the quarter".',
    {
      metric: z.enum(['posts', 'users', 'chats']).describe('Which timeseries to fetch: posts (likes/comments/new posts), users (active vs engaged), or chats (chat activity).'),
      groupBy: z.enum(['day', 'week', 'month']).optional().describe('Bucket size (default day).'),
      sinceDays: z.number().int().min(1).max(365).optional().describe('Window size ending now (default 30 days).'),
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
        return asResult({ metric, groupBy: opts.groupBy, sinceDays: opts.sinceDays, chart, raw });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  server.tool(
    'analytics_rankings',
    'Top performing posts or content pages on the Staffbase intranet by visits / likes / comments. Returns a ranked list (with entity titles) plus a chartable bar payload. Best for questions like "what were the most read posts this month?", "top channels by engagement", "top performing news".',
    {
      scope: z.enum(['posts', 'contents']).describe('Whether to rank posts (news items) or contents (channels/pages).'),
      limit: z.number().int().min(1).max(20).optional().describe('How many rows to return (default 5).'),
      sinceDays: z.number().int().min(1).max(365).optional().describe('Window size ending now (default 30 days).'),
    },
    async ({ scope, limit, sinceDays }) => {
      try {
        const opts = { limit: limit || 5, sinceDays: sinceDays || 30 };
        const raw = scope === 'posts'
          ? await getPostsRankings({ ...opts, enrich: true })
          : await getContentsRankings(opts);
        const chart = buildRankingsChart(scope, raw, opts.limit);
        chart.title = `${chart.title} — last ${opts.sinceDays} days`;
        return asResult({ scope, limit: opts.limit, sinceDays: opts.sinceDays, chart, raw });
      } catch (err) {
        return asResult({ error: true, message: err.message });
      }
    }
  );

  return server;
}

// ── HTTP handler (mirrors the existing internal MCP plumbing) ───────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed for stateless server' }, id: null });
    return;
  }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  // Bearer header is the mock staffbase-user token, used by the existing
  // internal mocks for personalization. We don't need it here (the Staffbase
  // API token gives us read-only org-wide access), but the orchestrator sends
  // it on every call so we just accept and ignore.

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
