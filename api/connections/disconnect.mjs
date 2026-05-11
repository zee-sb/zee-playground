// POST /api/connections/disconnect { provider }
// Removes a connection row for the current user. Does NOT revoke the upstream
// OAuth grant — that requires a separate revocation call which Atlassian's
// API token endpoint supports but for the prototype we just drop the row.

import { getUserFromReq } from '../lib/session.mjs';
import { dbConfigured } from '../lib/db.mjs';
import { deleteConnection } from '../lib/connections.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const { provider } = req.body || {};
  if (!provider) {
    res.status(400).json({ error: 'provider required' });
    return;
  }
  await deleteConnection(session.userId, provider);
  res.status(200).json({ ok: true });
}
