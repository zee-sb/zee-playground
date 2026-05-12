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
  topPosts,
  postPerformance,
  channelHealth,
  audiencePulse,
} from '../staffbase.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
};

function asResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
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

  // ── Engagement analytics ──────────────────────────────────────────────────

  server.tool(
    'top_posts',
    "What's the most viewed or engaged-with content on the intranet right now? Returns the top-ranked posts by visits (or likes / comments / shares) across the last N days, each with full engagement metrics enriched from the Staffbase Analytics API. Use this for queries like \"what's trending\", \"top posts this week\", \"best performing announcement\", \"most read memos\", \"what people are reading\". Pass channelID to narrow to a single channel.",
    {
      days: z.number().int().min(1).max(90).optional().describe('Days of history to look back (default 7, max 90).'),
      limit: z.number().int().min(1).max(50).optional().describe('Max posts to return (default 10).'),
      sortBy: z.enum(['visits', 'likes', 'comments', 'shares']).optional().describe('Metric to rank by (default visits).'),
      channelID: z.string().optional().describe('Optional channel id to scope to one channel.'),
    },
    async ({ days, limit, sortBy, channelID }) => {
      const result = await topPosts({ days: days || 7, limit: limit || 10, sortBy: sortBy || 'visits', channelID });
      return asResult(result);
    }
  );

  server.tool(
    'post_performance',
    'How did a specific post perform? Returns headline engagement numbers (visits, unique visitors, likes, comments, shares) plus a day-by-day series suitable for a sparkline. Use this for queries like "how did the all-hands recap do", "stats on the latest CEO memo", "engagement on post X", "did my last post land". Pair with search_posts when you only have a title or topic — find the postId first, then call this.',
    {
      postId: z.string().describe('The Staffbase post id (from list_recent_posts, search_posts, or get_post).'),
      days: z.number().int().min(1).max(90).optional().describe('Days of history to include in the headline and daily series (default 30).'),
    },
    async ({ postId, days }) => {
      const result = await postPerformance({ postId, days: days || 30 });
      return asResult(result);
    }
  );

  server.tool(
    'channel_health',
    'How active is a specific news channel? Returns posts-in-window count, aggregate visits / likes / comments / shares, the top post by visits, and the top 5 posts in the channel. Use this for queries like "how is the Engineering channel doing", "channel health check", "is anyone reading the All-Hands channel", "which posts in X are performing best". Pair with list_channels when you only have a channel name — find the channel id first.',
    {
      channelID: z.string().describe('The Staffbase channel id (from list_channels).'),
      days: z.number().int().min(1).max(90).optional().describe('Days of history to aggregate over (default 30).'),
    },
    async ({ channelID, days }) => {
      const result = await channelHealth({ channelID, days: days || 30 });
      return asResult(result);
    }
  );

  server.tool(
    'audience_pulse',
    'Platform-wide activity pulse over a recent window. Returns total / registered / active / engaged user counts plus a daily series suitable for a sparkline. Use this for queries like "how engaged is the company this week", "platform pulse", "how many people are actually using the intranet", "user engagement trend". This is the company-level vital sign, NOT a per-post metric.',
    {
      days: z.number().int().min(1).max(90).optional().describe('Days of history (default 7).'),
      groupBy: z.enum(['hour', 'day', 'week', 'month']).optional().describe('Bucket size for the daily series (default day).'),
    },
    async ({ days, groupBy }) => {
      const result = await audiencePulse({ days: days || 7, groupBy: groupBy || 'day' });
      return asResult(result);
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
