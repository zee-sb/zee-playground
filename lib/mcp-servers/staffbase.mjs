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
