// Simulated SSO auth: POST { email } → { token, user }
// Password is accepted but ignored — this is a demo simulation.

const USERS = {
  'alice@acme.com': {
    id: 'alice',
    name: 'Alice Chen',
    email: 'alice@acme.com',
    role: 'hr_admin',
    department: 'HR',
    title: 'HR Manager',
    manager: null,
    ptoBalance: 18,
    avatar: 'AC',
  },
  'bob@acme.com': {
    id: 'bob',
    name: 'Bob Smith',
    email: 'bob@acme.com',
    role: 'employee',
    department: 'Engineering',
    title: 'Software Engineer',
    manager: 'carol@acme.com',
    ptoBalance: 12,
    avatar: 'BS',
  },
  'carol@acme.com': {
    id: 'carol',
    name: 'Carol Davis',
    email: 'carol@acme.com',
    role: 'manager',
    department: 'Product',
    title: 'Product Manager',
    manager: 'alice@acme.com',
    ptoBalance: 15,
    avatar: 'CD',
  },
  'dave@acme.com': {
    id: 'dave',
    name: 'Dave Wilson',
    email: 'dave@acme.com',
    role: 'employee',
    department: 'Design',
    title: 'UX Designer',
    manager: 'carol@acme.com',
    ptoBalance: 9,
    avatar: 'DW',
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
    res.status(401).json({ error: 'Unknown user. Try alice@acme.com, bob@acme.com, carol@acme.com, or dave@acme.com' });
    return;
  }

  // Simulated token: base64(userId:timestamp)
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

  res.status(200).json({ token, user });
}
