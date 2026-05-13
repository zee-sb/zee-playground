// Simulated SSO auth: POST { email } → { token, user }
// Password is accepted but ignored — this is a demo simulation.
//
// Roster mirrors the canonical EMPLOYEES list in lib/mcp-servers/hr.mjs.
// Token format is base64(userId:timestamp) — downstream MCP servers decode
// the userId and look it up in their own EMPLOYEES table, so the `id`s here
// must stay aligned with hr.mjs / it.mjs.

const USERS = {
  'zyad.abuzeid@staffbase.com': {
    id: 'zee',
    name: 'Zee Abuzeid',
    email: 'zyad.abuzeid@staffbase.com',
    role: 'employee',
    department: 'Product',
    title: 'Senior Product Manager',
    manager: 'carol.davis@staffbase.com',
    ptoBalance: 17,
    avatar: 'ZA',
  },
  'alice.chen@staffbase.com': {
    id: 'alice',
    name: 'Alice Chen',
    email: 'alice.chen@staffbase.com',
    role: 'hr_admin',
    department: 'People',
    title: 'HR Manager',
    manager: null,
    ptoBalance: 18,
    avatar: 'AC',
  },
  'bob.smith@staffbase.com': {
    id: 'bob',
    name: 'Bob Smith',
    email: 'bob.smith@staffbase.com',
    role: 'employee',
    department: 'Engineering',
    title: 'Software Engineer',
    manager: 'carol.davis@staffbase.com',
    ptoBalance: 12,
    avatar: 'BS',
  },
  'carol.davis@staffbase.com': {
    id: 'carol',
    name: 'Carol Davis',
    email: 'carol.davis@staffbase.com',
    role: 'manager',
    department: 'Product',
    title: 'Product Manager',
    manager: 'eve@staffbase.com',
    ptoBalance: 15,
    avatar: 'CD',
  },
  'dave.wilson@staffbase.com': {
    id: 'dave',
    name: 'Dave Wilson',
    email: 'dave.wilson@staffbase.com',
    role: 'employee',
    department: 'Design',
    title: 'UX Designer',
    manager: 'carol.davis@staffbase.com',
    ptoBalance: 9,
    avatar: 'DW',
  },
  'erin@staffbase.com': {
    id: 'erin',
    name: 'Erin Patel',
    email: 'erin@staffbase.com',
    role: 'employee',
    department: 'Operations',
    title: 'Office Worker',
    manager: 'alice.chen@staffbase.com',
    ptoBalance: 14,
    avatar: 'EP',
  },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email } = req.body || {};

  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const user = USERS[email.toLowerCase()];
  if (!user) {
    const known = Object.keys(USERS).join(', ');
    res.status(401).json({ error: `Unknown user. Try ${known}.` });
    return;
  }

  // Simulated token: base64(userId:timestamp)
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

  res.status(200).json({ token, user });
}
