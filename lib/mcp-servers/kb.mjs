// Knowledge Base — MCP Server (one per KB connector, multiplexed by ?kbId=).
//
// Each KB connector in lib/seed.mjs has endpoint `/api/mcp-kb?kbId=<kbId>`.
// This handler resolves the kbId from the query string and exposes one tool
// `search` over the documents in data/kb-documents.mjs.
//
// Why hand-rolled JSON-RPC instead of the @modelcontextprotocol SDK:
//   The KB MCP only needs `tools/list` and `tools/call`. The SDK is great
//   for stateful streaming MCPs (resources, prompts, completion) but here
//   we'd be importing 200KB of framework to wrap two 5-line handlers. The
//   orchestrator's rpc() already speaks bare JSON-RPC over HTTP, so we just
//   match that wire format.

import { getKbDocuments, searchKb } from '../../data/kb-documents.mjs';

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function resolveKbId(req) {
  // Vercel populates req.query from the URL; Vite passes the raw URL through.
  if (req.query?.kbId) return String(req.query.kbId);
  const url = req.url || '';
  const m = url.match(/[?&]kbId=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const TOOLS_BY_KB = (kbId) => ([{
  name: 'search',
  description: `Search the "${kbId}" knowledge base. Returns up to 4 ranked snippets with title + lastUpdated + tags + body excerpt. Always cite the title in the answer.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language search query (keywords or a full question both work).' },
      limit: { type: 'integer', minimum: 1, maximum: 8, description: 'Max results to return (default 4).' },
    },
    required: ['query'],
  },
}]);

export default async function handler(req, res) {
  // CORS — match the rest of the MCP servers so the dev proxy is happy.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, X-Companion-User-Id');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const kbId = resolveKbId(req);
  if (!kbId) {
    res.status(400).json({ error: 'kbId query param required' });
    return;
  }
  if (!getKbDocuments(kbId).length) {
    res.status(404).json({ error: 'unknown_kb', kbId });
    return;
  }

  // Parse JSON-RPC body — Vercel parses for us, Vite/local may not.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { body = JSON.parse(raw); } catch { body = {}; }
  }

  const { id = 0, method, params } = body || {};

  try {
    if (method === 'tools/list') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(rpcResult(id, { tools: TOOLS_BY_KB(kbId) }));
      return;
    }
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      if (toolName !== 'search') {
        res.status(200).json(rpcError(id, -32601, `Unknown tool: ${toolName}`));
        return;
      }
      const query = String(args.query || '').trim();
      const limit = Math.min(Math.max(parseInt(args.limit, 10) || 4, 1), 8);
      const hits = searchKb(kbId, query, { limit });
      const payload = hits.length
        ? { kbId, query, results: hits, count: hits.length }
        : { kbId, query, results: [], message: `No results in "${kbId}" for "${query}". Try broader terms.` };
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(rpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      }));
      return;
    }
    // Initialize / ping / unknown — answer politely so the orchestrator's
    // probe doesn't get a 5xx.
    if (method === 'initialize') {
      res.status(200).json(rpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: `kb-${kbId}`, version: '1.0.0' },
      }));
      return;
    }
    res.status(200).json(rpcError(id, -32601, `Method not found: ${method}`));
  } catch (err) {
    console.error('[kb-mcp]', err);
    res.status(500).json(rpcError(id, -32000, err.message || 'internal_error'));
  }
}
