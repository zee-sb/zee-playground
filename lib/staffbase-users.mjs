// Real-Google-identity → Staffbase-flavoured user record.
//
// When a Staffbase teammate signs in with Google, we want them to "see
// themselves" in the mocked HR / IT / Intranet MCPs. The mocks in api/mcp.mjs
// look up employees by short id (`zee`, `alice`, `bob`…). So we keep a small
// directory here mapping known emails to a rich profile, and synthesize a
// reasonable profile for anyone else who signs in.

export const STAFFBASE_DIRECTORY = [
  { id: 'zee',   email: 'zyad.abuzeid@staffbase.com', name: 'Zee Abuzeid',   department: 'Product',     title: 'Senior Product Manager', avatar: 'ZA' },
  { id: 'alice', email: 'alice@acme.com',             name: 'Alice Chen',    department: 'HR',          title: 'HR Manager',             avatar: 'AC' },
  { id: 'bob',   email: 'bob@acme.com',               name: 'Bob Smith',     department: 'Engineering', title: 'Software Engineer',      avatar: 'BS' },
  { id: 'carol', email: 'carol@acme.com',             name: 'Carol Davis',   department: 'Product',     title: 'Product Manager',        avatar: 'CD' },
  { id: 'dave',  email: 'dave@acme.com',              name: 'Dave Wilson',   department: 'Design',      title: 'UX Designer',            avatar: 'DW' },
];

function lookupByEmail(email) {
  if (!email) return null;
  const lower = email.toLowerCase();
  return STAFFBASE_DIRECTORY.find((u) => u.email.toLowerCase() === lower) || null;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function deriveIdFromEmail(email) {
  // local-part, sanitized to a-z0-9 — stable per email
  const local = (email || '').split('@')[0] || 'user';
  return local.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || 'user';
}

// Take whatever Google gave us and produce the Companion-internal identity
// record (id, email, display name, etc.). Known emails get their canonical
// profile; new emails get a sane synthesized one.
export function resolveStaffbaseIdentity(googleInfo) {
  const hit = lookupByEmail(googleInfo?.email);
  if (hit) {
    return {
      id: hit.id,
      email: googleInfo.email,
      name: hit.name,
      department: hit.department,
      title: hit.title,
      avatar: hit.avatar,
      picture: googleInfo.picture || null,
    };
  }
  return {
    id: deriveIdFromEmail(googleInfo?.email),
    email: googleInfo?.email || '',
    name: googleInfo?.name || googleInfo?.email || 'Staffbase teammate',
    department: null,
    title: null,
    avatar: initials(googleInfo?.name || googleInfo?.email),
    picture: googleInfo?.picture || null,
  };
}

// Mock bearer used when calling the internal mocked MCPs. Their decodeToken()
// expects base64(userId:timestamp).
export function buildMockBearer(staffbaseUserId) {
  return Buffer.from(`${staffbaseUserId}:${Date.now()}`).toString('base64');
}
