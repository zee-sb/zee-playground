// Helpers for turning external identity payloads into the
// Staffbase-flavoured user record we persist + show to the mocked MCPs.
//
// The previous static demo directory (5–6 hardcoded personas) is gone:
// the Companion demo sign-in now takes an email and resolves it against
// the live Campsite directory (`lib/staffbase.mjs:findUserByEmail`), so
// no preflight cast is needed.

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function deriveIdFromEmail(email) {
  const local = (email || '').split('@')[0] || 'user';
  return local.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || 'user';
}

// Synthesize a Companion-internal identity from whatever a Google ID-token
// payload gives us. Used by the (currently disabled) Google OAuth callback.
export function resolveStaffbaseIdentity(googleInfo) {
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
