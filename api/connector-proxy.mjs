// Connector proxy — forwards a JSON-RPC `tools/list` (or arbitrary method)
// call to an MCP endpoint the admin pasted into the Add Connector modal.
// Exists so the Studio can test a third-party MCP server without running into
// browser CORS. (Named `connector-proxy` rather than `mcp-proxy` because the
// `/api/mcp-:flavor` rewrite in vercel.json would otherwise capture the path.)
//
// POST /api/connector-proxy
// Body: { url: "https://...", method?: "tools/list", params?: {}, auth?: {
//   type: "none" | "bearer" | "header", token?, headerName?, headerValue?
// } }
// Returns: { ok: true, result } | { ok: false, error, status }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = await readJson(req);
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const method = typeof body.method === 'string' ? body.method : 'tools/list';
  const params = body.params && typeof body.params === 'object' ? body.params : {};
  const auth = body.auth || { type: 'none' };

  if (!url) {
    res.status(400).json({ ok: false, error: 'url is required' });
    return;
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/api/')) {
    res.status(400).json({ ok: false, error: 'url must be http(s) or an /api/ path' });
    return;
  }

  // Resolve relative /api/* to same-origin for local testing.
  const targetUrl = url.startsWith('/api/')
    ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}${url}`
    : url;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (auth.type === 'bearer' && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  } else if (auth.type === 'header' && auth.headerName && auth.headerValue) {
    headers[auth.headerName] = auth.headerValue;
  }

  const rpcBody = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  };

  let upstreamRes;
  try {
    upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcBody),
      // Cap the request so a misbehaving endpoint can't hang the serverless fn.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: `Could not reach endpoint: ${err.message || 'network error'}`,
    });
    return;
  }

  const text = await upstreamRes.text();
  if (!upstreamRes.ok) {
    res.status(200).json({
      ok: false,
      status: upstreamRes.status,
      error: `Endpoint returned ${upstreamRes.status}: ${text.slice(0, 200)}`,
    });
    return;
  }

  // MCP endpoints sometimes stream — accept either application/json or SSE.
  let parsed = null;
  const ct = (upstreamRes.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/event-stream') || text.includes('\ndata:')) {
    // Pick the last `data:` frame that parses to a JSON-RPC response.
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/^data:\s*(.*)$/);
      if (!m) continue;
      try {
        const obj = JSON.parse(m[1]);
        if (obj && (obj.result !== undefined || obj.error)) parsed = obj;
      } catch { /* skip */ }
    }
  } else {
    try { parsed = JSON.parse(text); } catch {}
  }

  if (!parsed) {
    res.status(200).json({
      ok: false,
      error: 'Endpoint did not return a JSON-RPC response',
      raw: text.slice(0, 400),
    });
    return;
  }
  if (parsed.error) {
    res.status(200).json({ ok: false, error: parsed.error.message || JSON.stringify(parsed.error) });
    return;
  }
  res.status(200).json({ ok: true, result: parsed.result });
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
