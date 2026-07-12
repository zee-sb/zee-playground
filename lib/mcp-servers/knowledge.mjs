// Knowledge — MCP Server (unified hybrid retrieval across ALL content).
//
// One `search` tool backed by lib/retrieval.mjs (pgvector + full-text, RRF-fused)
// over the knowledge_chunks index — KB policy docs AND live Campsite content.
// Registered as a single always-on `kind: 'search'` connection (lib/seed.mjs),
// so the orchestrator's citation path (index.mjs `source_citation`) lights up the
// existing SourcesBadge / SourcesBottomSheet UI with zero frontend changes.
//
// Served via the api/mcp/[flavor].mjs dispatcher (flavor "knowledge") to stay
// under the Hobby plan's 12-function limit — the /api/mcp-:flavor rewrite maps
// the seed's /api/mcp-knowledge endpoint onto /api/mcp/knowledge.

import { retrieve } from '../retrieval.mjs';

function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }

// Branch is forwarded by the orchestrator as ?branch=<id> (see rpc() in
// lib/orchestrator/index.mjs). Global KB rows use the '*' sentinel and are
// always searched regardless of branch.
function resolveBranch(req) {
  if (req.query?.branch) return String(req.query.branch);
  const m = (req.url || '').match(/[?&]branch=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '*';
}

const TOOLS = [
  {
    name: 'search',
    description: 'Search ALL company knowledge — HR/IT/onboarding/travel policy docs AND live Campsite intranet posts and pages — in one semantic query. Returns ranked passages with title, source, and last-updated. Cite the title in your answer.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question or keywords.' },
        limit: { type: 'integer', minimum: 1, maximum: 8, description: 'Max passages to return (default 5).' },
      },
      required: ['query'],
    },
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, X-Companion-User-Id');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const branch = resolveBranch(req);

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
      res.status(200).json(rpcResult(id, { tools: TOOLS }));
      return;
    }
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      if (toolName === 'search') {
        const query = String(args.query || '').trim();
        const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 8);
        // retrieve() never throws — worst case returns [].
        const hits = await retrieve(query, { limit, branchId: branch });
        const results = hits.map((h) => ({
          id: h.docId,
          title: h.title,
          snippet: h.snippet,
          source: h.sourceType === 'kb' ? (h.kbId || 'Knowledge Base') : 'Campsite',
          sourceType: h.sourceType,
          url: h.url,
          lastUpdated: h.lastUpdated,
          // A longer excerpt so the model can answer directly from the passage.
          text: String(h.body || '').slice(0, 900),
        }));
        const payload = results.length
          ? { query, results, count: results.length }
          : { query, results: [], message: `No indexed knowledge matched "${query}". Try a live tool (Intranet, HR, IT) or broader terms.` };
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }));
        return;
      }
      res.status(200).json(rpcError(id, -32601, `Unknown tool: ${toolName}`));
      return;
    }
    if (method === 'initialize') {
      res.status(200).json(rpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'knowledge', version: '1.0.0' },
      }));
      return;
    }
    res.status(200).json(rpcError(id, -32601, `Method not found: ${method}`));
  } catch (err) {
    console.error('[knowledge-mcp]', err);
    // Degrade to an empty result rather than a 5xx so a turn never hard-fails.
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(rpcResult(id, { content: [{ type: 'text', text: JSON.stringify({ results: [], error: err.message || 'internal_error' }) }] }));
  }
}
