// GET /api/companion/messages?conversationId=… → list messages in order

import { getUserFromReq } from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const url = new URL(req.url, 'http://x');
  const conversationId = url.searchParams.get('conversationId');
  if (!conversationId) {
    res.status(400).json({ error: 'conversationId is required' });
    return;
  }

  // Ownership check
  const own = await sql`select id from conversations where id = ${conversationId} and user_id = ${session.userId}`;
  if (!own.length) {
    res.status(404).json({ error: 'conversation_not_found' });
    return;
  }

  const rows = await sql`
    select id, role, content, created_at
    from messages
    where conversation_id = ${conversationId}
    order by created_at asc
  `;
  res.status(200).json({ messages: rows });
}
