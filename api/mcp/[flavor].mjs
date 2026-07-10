// Single Vercel function dispatching to every MCP server flavor.
// Consolidated to stay under the Hobby plan's 12-function-per-deployment limit.
//
// vercel.json rewrites map the historical URLs onto this catch-all:
//   /api/mcp            → /api/mcp/hr         (Acme HR Portal)
//   /api/mcp-atlassian  → /api/mcp/atlassian
//   /api/mcp-auth       → /api/mcp/auth       (simulated SSO login)
//   /api/mcp-intranet   → /api/mcp/intranet
//   /api/mcp-it         → /api/mcp/it
//   /api/mcp-staffbase  → /api/mcp/staffbase
//   /api/mcp-voices     → /api/mcp/voices     (Staffbase Voices — recognition, pulse)
//   /api/mcp-servicenow → /api/mcp/servicenow (ServiceNow ITSM — per-user OAuth)
//   /api/mcp-trace-doctor → /api/mcp/trace-doctor (Langfuse trace analyzer, Slack MCP)
//   /api/trace-doctor   → /api/mcp/trace-doctor-app (Langfuse trace analyzer, in-app REST API)

import hrHandler from '../../lib/mcp-servers/hr.mjs';
import atlassianHandler from '../../lib/mcp-servers/atlassian.mjs';
import authHandler from '../../lib/mcp-servers/auth.mjs';
import intranetHandler from '../../lib/mcp-servers/intranet.mjs';
import itHandler from '../../lib/mcp-servers/it.mjs';
import staffbaseHandler from '../../lib/mcp-servers/staffbase.mjs';
import kbHandler from '../../lib/mcp-servers/kb.mjs';
import voicesHandler from '../../lib/mcp-servers/voices.mjs';
import servicenowHandler from '../../lib/mcp-servers/servicenow.mjs';
import traceDoctorHandler from '../../lib/mcp-servers/trace-doctor.mjs';
import traceDoctorAppHandler from '../../lib/mcp-servers/trace-doctor-app.mjs';

const HANDLERS = {
  hr: hrHandler,
  atlassian: atlassianHandler,
  auth: authHandler,
  intranet: intranetHandler,
  it: itHandler,
  staffbase: staffbaseHandler,
  kb: kbHandler,
  voices: voicesHandler,
  servicenow: servicenowHandler,
  'trace-doctor': traceDoctorHandler,
  'trace-doctor-app': traceDoctorAppHandler,
};

function resolveFlavor(req) {
  // Vercel populates req.query.flavor from the [flavor] dynamic segment.
  if (req.query?.flavor) return String(req.query.flavor);
  // Fallback: parse from the URL in case the runtime didn't populate it.
  const url = (req.url || '').split('?')[0];
  const m = url.match(/\/api\/mcp\/([^/]+)/);
  if (m) return m[1];
  // The bare `/api/mcp` rewrite target is `/api/mcp/hr` — if for some reason
  // we land here without a flavor, default to the HR portal.
  return 'hr';
}

export default async function handler(req, res) {
  const flavor = resolveFlavor(req);
  const target = HANDLERS[flavor];
  if (!target) {
    res.status(404).json({ error: 'unknown_mcp_flavor', flavor });
    return;
  }
  try {
    return await target(req, res);
  } catch (err) {
    console.error(`[mcp/${flavor}]`, err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  }
}
