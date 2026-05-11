// Neon HTTP client — single instance reused across function invocations.
// Works with Vercel Postgres (Neon-backed) too: just point DATABASE_URL at it.

import { neon } from '@neondatabase/serverless';

const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;

if (!connStr && process.env.NODE_ENV === 'production') {
  console.warn('[db] No DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL set — companion endpoints will fail.');
}

// neon() returns a tagged-template function: sql`select ...`
export const sql = connStr ? neon(connStr) : null;

export function dbConfigured() {
  return Boolean(connStr);
}
