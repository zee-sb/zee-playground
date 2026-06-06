// Connector proxy — forwards a JSON-RPC `tools/list` (or arbitrary method)
// call to an MCP endpoint the admin pasted into the Add Connector modal.
// Exists so the Studio can test a third-party MCP server without running into
// browser CORS. (Named `connector-proxy` rather than `mcp-proxy` because the
// `/api/mcp-:flavor` rewrite in vercel.json would otherwise capture the path.)
//
// Also handles the MCP Streamable HTTP session protocol: if the first hit
// returns an `Mcp-Session-Id` response header, we replay the requested
// method with that header set. That covers the Staffbase MCP-proxy and any
// other 2025-03-26-spec server pasted into the modal.
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

  // Step 1 — try the requested method directly. If the endpoint is a
  // session-mode MCP server (Streamable HTTP), this initial hit will either
  // respond with an Mcp-Session-Id header (which we then replay against) or
  // fail with a 4xx telling us to initialize first. Either way step 2 picks
  // up the slack — single-shot servers just return their result here.
  let attempt = await postRpc(targetUrl, headers, method, params);
  if (attempt.networkError) {
    res.status(502).json({ ok: false, error: `Could not reach endpoint: ${attempt.networkError}` });
    return;
  }

  // Step 2 — if the upstream looks session-mode, run the MCP initialize
  // handshake to capture a Mcp-Session-Id, then replay the requested method
  // with that header set. We treat "got a session id back" OR "got a 4xx
  // (likely 'session id required')" as the trigger.
  const needsHandshake =
    attempt.respSessionId ||
    (attempt.status >= 400 && attempt.status < 500 && method !== 'initialize');

  if (needsHandshake) {
    const init = await postRpc(targetUrl, headers, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'zee-playground-studio', version: '0.1' },
    });
    if (init.networkError) {
      res.status(502).json({ ok: false, error: `Could not reach endpoint: ${init.networkError}` });
      return;
    }
    if (!init.respSessionId) {
      // Some servers return the id in the body — fall through and let the
      // caller see the original error.
    } else {
      attempt = await postRpc(targetUrl, { ...headers, 'Mcp-Session-Id': init.respSessionId }, method, params);
      if (attempt.networkError) {
        res.status(502).json({ ok: false, error: `Could not reach endpoint: ${attempt.networkError}` });
        return;
      }
    }
  }

  if (attempt.status >= 400) {
    res.status(200).json({
      ok: false,
      status: attempt.status,
      error: `Endpoint returned ${attempt.status}: ${attempt.text.slice(0, 200)}`,
    });
    return;
  }

  if (!attempt.parsed) {
    res.status(200).json({
      ok: false,
      error: 'Endpoint did not return a JSON-RPC response',
      raw: attempt.text.slice(0, 400),
    });
    return;
  }
  if (attempt.parsed.error) {
    res.status(200).json({ ok: false, error: attempt.parsed.error.message || JSON.stringify(attempt.parsed.error) });
    return;
  }
  res.status(200).json({ ok: true, result: attempt.parsed.result });
}

// Shared transport helper used for both the initial hit and the
// post-handshake replay. Returns a normalized `{ status, text, parsed,
// respSessionId, networkError? }` so the handler above stays linear.
async function postRpc(url, baseHeaders, method, params) {
  const rpcBody = { jsonrpc: '2.0', id: Date.now(), method, params: params || {} };
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(rpcBody),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { networkError: err.message || 'network error' };
  }
  const text = await res.text();
  const respSessionId = res.headers.get('mcp-session-id') || null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  let parsed = null;
  if (ct.includes('text/event-stream') || text.includes('\ndata:')) {
    for (const line of text.split('\n')) {
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
  return { status: res.status, text, parsed, respSessionId };
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
