// POST /api/auth/staffbase/login { staffbaseUserId }
// GET /api/auth/staffbase/login         → list demo personas
//
// Dev/demo fallback: lets you sign in as one of a fixed set of personas
// without going through Google. Useful (a) before Google OAuth is wired up,
// (b) for demoing how the experience changes by role (Alice HR-Manager vs.
// Bob engineer). Google OAuth remains the primary auth path.

import { sql, dbConfigured } from '../../lib/db.mjs';
import { STAFFBASE_DIRECTORY } from '../../lib/staffbase-users.mjs';
import { issueSessionJwt, sessionCookieHeader } from '../../lib/session.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({
      personas: STAFFBASE_DIRECTORY.map((u) => ({
        id: u.id, name: u.name, email: u.email,
        department: u.department, title: u.title, avatar: u.avatar,
      })),
    });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }

  const { staffbaseUserId } = req.body || {};
  const profile = STAFFBASE_DIRECTORY.find((u) => u.id === staffbaseUserId);
  if (!profile) {
    res.status(400).json({ error: 'unknown_user' });
    return;
  }

  const rows = await sql`
    insert into users (staffbase_user_id, email, display_name, department, title, avatar_initials, last_login_at)
    values (${profile.id}, ${profile.email}, ${profile.name}, ${profile.department}, ${profile.title}, ${profile.avatar}, now())
    on conflict (staffbase_user_id) do update
      set email           = excluded.email,
          display_name    = excluded.display_name,
          department      = excluded.department,
          title           = excluded.title,
          avatar_initials = excluded.avatar_initials,
          last_login_at   = now()
    returning id
  `;
  const userId = rows[0].id;

  const jwt = await issueSessionJwt(userId);
  res.setHeader('Set-Cookie', sessionCookieHeader(jwt));
  res.status(200).json({ user: { id: userId, ...profile } });
}
