// Stateless session cookies — signed JWT in httpOnly cookie.

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'sb_companion_session';
const STATE_COOKIE_NAME = 'sb_companion_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const STATE_TTL_SECONDS = 60 * 10;             // 10 minutes

function getSecret() {
  const raw = process.env.SESSION_JWT_SECRET;
  if (!raw) throw new Error('SESSION_JWT_SECRET is not set');
  return new TextEncoder().encode(raw);
}

export async function issueSessionJwt(userId) {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionJwt(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}

export async function issueStateJwt(state) {
  return await new SignJWT({ state })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyStateJwt(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.state || null;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function serializeCookie(name, value, { maxAge, expires, path = '/', httpOnly = true, secure = true, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${path}`);
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
}

export function sessionCookieHeader(jwt) {
  return serializeCookie(COOKIE_NAME, jwt, { maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookieHeader() {
  return serializeCookie(COOKIE_NAME, '', { maxAge: 0 });
}

export function stateCookieHeader(jwt) {
  return serializeCookie(STATE_COOKIE_NAME, jwt, { maxAge: STATE_TTL_SECONDS, sameSite: 'Lax' });
}

export function clearStateCookieHeader() {
  return serializeCookie(STATE_COOKIE_NAME, '', { maxAge: 0 });
}

export const COOKIE_NAMES = { session: COOKIE_NAME, state: STATE_COOKIE_NAME };

export async function getUserFromReq(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return await verifySessionJwt(cookies[COOKIE_NAME]);
}
