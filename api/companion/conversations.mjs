// GET  /api/companion/conversations           → list conversations for the signed-in user
// POST /api/companion/conversations { title? } → create one and return the new id

import { getUserFromReq } from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';

export default async function handler(req, res) {
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }

  if (req.method === 'GET') {
    const rows = await sql`
      select id, title, created_at, updated_at
      from conversations
      where user_id = ${session.userId}
      order by updated_at desc
      limit 50
    `;
    res.status(200).json({ conversations: rows });
    return;
  }

  if (req.method === 'POST') {
    const title = (req.body && typeof req.body.title === 'string') ? req.body.title.slice(0, 200) : null;
    const rows = await sql`
      insert into conversations (user_id, title)
      values (${session.userId}, ${title})
      returning id, title, created_at, updated_at
    `;
    res.status(201).json({ conversation: rows[0] });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
