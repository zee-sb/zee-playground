// GET /api/auth/me → current Staffbase user + their connected providers.

import { getUserFromReq } from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';
import { listConnectionsForUser } from '../lib/connections.mjs';

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

  const rows = await sql`
    select id, staffbase_user_id, email, display_name, department, title, avatar_initials
    from users where id = ${session.userId}
  `;
  if (!rows.length) {
    res.status(401).json({ error: 'user_not_found' });
    return;
  }
  const u = rows[0];
  const connections = await listConnectionsForUser(u.id);
  res.status(200).json({
    user: {
      id: u.id,
      staffbaseUserId: u.staffbase_user_id,
      email: u.email,
      displayName: u.display_name,
      department: u.department,
      title: u.title,
      avatarInitials: u.avatar_initials,
    },
    connections: connections.map((c) => ({
      provider: c.provider,
      status: c.status,
      externalEmail: c.external_email,
      metadata: c.metadata,
      connectedAt: c.created_at,
    })),
  });
}
