// Trace Doctor — MCP server flavor (Claude in Slack connector).
//
// Thin JSON-RPC wrapper around the deterministic rule engine
// (lib/trace-doctor-engine.mjs) plus the LLM review layer
// (lib/trace-doctor-llm.mjs) — the Slack connector is headless, so it needs
// the LLM pass baked in to get the same judgment a human running the Claude
// skill would supply live. Exposes one tool, `analyze_trace`. Wire format
// matches the other flavors (initialize, tools/list, tools/call) so it plugs
// straight into api/mcp/[flavor].mjs and can be added as a custom connector to
// Claude in Slack.

import { analyzeDeep } from '../trace-doctor-llm.mjs';

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

const TOOLS = [
  {
    name: 'analyze_trace',
    description: 'Analyze a Langfuse Navigator / AI-Assistant conversation trace (or an array of traces) and return a root-cause diagnostic report. Reads eval scores + judge comments and execution observations, runs a deterministic rule engine, then adds an LLM review pass: language consistency across every turn (not just the first message), system-prompt contradiction/gap analysis (when the export captures the prompt text), and per-searchKnowledgeBase-call query/relevance review (when the export captures tool input/output — most exports today don\'t, so this degrades gracefully). Classifies every problem into the fix layer that owns it: prompt engineering, search-query generation, search results/retrieval, failed tool calls, or wrong/ungrounded sources — plus a meta layer for when the eval pipeline itself failed to parse the trace. Pass one trace to get a single-trace deep-dive, or an array to get a batch/fleet aggregate. Accepts the trace as a JSON object or a JSON string (users often paste raw JSON).',
    inputSchema: {
      type: 'object',
      properties: {
        trace: { description: 'A single Langfuse trace (object or JSON string), OR an array of traces for a batch report.' },
        format: { type: 'string', enum: ['markdown', 'json'], description: "Output format. 'markdown' (default) returns a human-readable report; 'json' returns structured signals + findings." },
      },
      required: ['trace'],
    },
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, X-Companion-User-Id');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  // Optional shared-secret auth. If TRACE_DOCTOR_TOKEN is set, require a matching
  // `Authorization: Bearer <token>` header (configure the same token on the Claude
  // connector). If unset, the endpoint stays open — fine for dev, but lock it down
  // before a company-wide rollout because traces can contain customer content.
  const requiredToken = process.env.TRACE_DOCTOR_TOKEN;
  if (requiredToken) {
    const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '');
    const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (provided !== requiredToken) {
      res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid bearer token.' });
      return;
    }
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { body = JSON.parse(raw); } catch { body = {}; }
  }
  const { id = 0, method, params } = body || {};

  try {
    if (method === 'initialize') {
      res.status(200).json(rpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'trace-doctor', version: '1.0.0' },
      }));
      return;
    }
    if (method === 'tools/list') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(rpcResult(id, { tools: TOOLS }));
      return;
    }
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      if (toolName === 'analyze_trace') {
        if (args.trace == null) {
          res.status(200).json(rpcResult(id, { content: [{ type: 'text', text: 'Error: no `trace` provided. Paste the Langfuse trace JSON (or an array of traces).' }], isError: true }));
          return;
        }
        const format = args.format === 'json' ? 'json' : 'markdown';
        let out;
        try {
          out = await analyzeDeep(args.trace, format);
        } catch (e) {
          res.status(200).json(rpcResult(id, { content: [{ type: 'text', text: `Error analyzing trace: ${e.message}. Make sure it's a valid Langfuse trace export.` }], isError: true }));
          return;
        }
        const text = (format === 'json') ? JSON.stringify(out, null, 2) : out;
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(rpcResult(id, { content: [{ type: 'text', text }] }));
        return;
      }
      res.status(200).json(rpcError(id, -32601, `Unknown tool: ${toolName}`));
      return;
    }
    res.status(200).json(rpcError(id, -32601, `Method not found: ${method}`));
  } catch (err) {
    console.error('[trace-doctor-mcp]', err);
    res.status(500).json(rpcError(id, -32000, err.message || 'internal_error'));
  }
}
