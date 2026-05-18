/**
 * configStore v8 — single source of truth for the Navigator Studio + Companion
 * prototypes, simulating one canonical Staffbase Intranet workspace.
 *
 * v8 simplification: 5 concepts → 3 (Expert / Workflow / Connection).
 * `connections` carry `kind: 'toolkit' | 'handoff' | 'search'`. Source-of-truth
 * is server-side (`navigator_config` + `navigator_experts`); localStorage is
 * an offline-friendly cache. Seed itself lives in `lib/seed.mjs` and is
 * imported by both client and server.
 *
 * What lives here:
 *   - Storage key + version constants
 *   - `buildSeedConfig()` — calls into lib/seed.mjs + adds client-only
 *     demoUsers (kept here because they're prototype-only).
 *   - `loadConfig()` / `saveConfig()` / `clearConfig()` — localStorage
 *     adapters. No migrations — older snapshots are discarded (hard
 *     cutover, prototype-only).
 *   - Derived selectors (`deriveLiveOrchestrator`, `expertVisibleTo`)
 *     used by the Studio "View as" preview and the runtime.
 *   - `workflowMatchesText` / `notableWordsFromTrigger` — heuristics the
 *     orchestrator's Tier-1 pre-pass also imports server-side
 *     (lib/studio-config.mjs has a server copy to avoid pulling browser
 *     code into Vercel functions).
 */

import { buildSeedClientConfig } from '../../../lib/seed.mjs'

// Bumped to v2 (".v2") to invalidate any v7 caches on the simplification rollout.
export const STORAGE_KEY = 'staffbase.navigator.config.v2'
// v11: tighten Snap-an-IT-issue onFail policy from 'allow' → 'warn' so a
// bad photo prompts retake instead of silently flowing through. The seed
// also tags itself with SEED_VERSION so the client can detect a stale
// server config and call reseed() automatically.
export const CONFIG_VERSION = 11

export function keyForBranch(branchId) {
  return branchId ? `${STORAGE_KEY}:${branchId}` : STORAGE_KEY
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo users — client-only roster for the standalone "Sign in as" picker.
// In production the Companion uses real Google OAuth via /api/auth/me.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_DEMO_USERS = [
  { email: 'zee@staffbase.com',     name: 'Zee Sherif',      role: 'Product',           group: 'Product',          location: 'NYC',           avatar: 'ZS', color: '#00C7B2',
    subtitle: 'I can help you ship — PRDs, roadmap, customer feedback, and team coordination.', daysSinceHire: 412 },
  { email: 'mira@staffbase.com',    name: 'Mira Okafor',     role: 'Engineering',       group: 'Engineering',      location: 'Chemnitz HQ',   avatar: 'MO', color: '#2563EB',
    subtitle: 'I can help with code reviews, IT tickets, GitHub access, and on-call rotations.', daysSinceHire: 87 },
  { email: 'jonas@staffbase.com',   name: 'Jonas Becker',    role: 'Design',            group: 'Design',           location: 'Berlin',        avatar: 'JB', color: '#7C3AED',
    subtitle: 'Design system, research repos, Figma plugins, and travel for offsites.', daysSinceHire: 245 },
  { email: 'sara@staffbase.com',    name: 'Sara Lindqvist',  role: 'Customer Success',  group: 'Customer Success', location: 'Cologne',       avatar: 'SL', color: '#F59E0B',
    subtitle: 'CSM playbooks, customer escalations, intranet content, and partner directory lookups.', daysSinceHire: 31 },
  { email: 'newhire@staffbase.com', name: 'Robin (new hire)',role: 'People',            group: 'People',           location: 'Chemnitz HQ',   avatar: 'RB', color: '#10B981',
    subtitle: 'Day One — pick up MacBook, set up SSO, complete HR profile, meet manager.', daysSinceHire: 1 },
]

export function buildSeedConfig() {
  const seed = buildSeedClientConfig()
  return {
    ...seed,
    version: CONFIG_VERSION,
    demoUsers: SEED_DEMO_USERS.map((u) => ({ ...u })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow trigger heuristic — also re-implemented in lib/studio-config.mjs
// for the server side. Keep the stop-word list in sync.
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','to','on','of','in','a','an',
  'or','is','are','be','do','need','needs','help','want','wants','start','starts',
  'mentions','mention','from','just','some',
])

export function notableWordsFromTrigger(trigger = '') {
  return Array.from(new Set(
    String(trigger).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !WORKFLOW_STOPWORDS.has(w))
  ))
}

export function workflowMatchesText(text, workflow) {
  if (!text || !workflow) return false
  const t = String(text).toLowerCase()
  const words = notableWordsFromTrigger(workflow.trigger || '')
  return words.some((w) => t.includes(w))
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence — localStorage adapters. Hard cutover: any snapshot whose
// version doesn't match CONFIG_VERSION is discarded. Server is canonical.
// ─────────────────────────────────────────────────────────────────────────────

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadConfig(branchId = null) {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(keyForBranch(branchId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== CONFIG_VERSION) return null
    return parsed
  } catch (err) {
    console.warn('[configStore] load failed, falling back to seed:', err)
    return null
  }
}

export function saveConfig(config, branchId = null) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(
      keyForBranch(branchId),
      JSON.stringify({ ...config, version: CONFIG_VERSION }),
    )
  } catch (err) {
    console.warn('[configStore] save failed:', err)
  }
}

export function clearConfig(branchId = null) {
  if (!isBrowser()) return
  window.localStorage.removeItem(keyForBranch(branchId))
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived selectors — single source of truth for "what does the chat see".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live orchestrator scope (workspace-wide) — connections that are connected
 * AND referenced by at least one active expert. Unified shape: returns
 * `{ connections, experts }`. Kind-specific filtering happens at the
 * consumer.
 */
export function deriveLiveOrchestrator(config) {
  if (!config) return { connections: [], experts: [] }
  const activeExperts = (config.experts || []).filter((a) => a.status === 'active')
  const referenced = new Set(activeExperts.flatMap((a) => a.connectionIds || []))
  return {
    connections: (config.connections || []).filter((c) =>
      c.status === 'connected' && referenced.has(c.id)
    ),
    experts: activeExperts,
  }
}

/**
 * Audience check — does this expert reach this user?
 *   - everyone: true → always reach
 *   - otherwise, user must match at least one group/role/location
 *   - empty audience falls back to true so a half-configured expert
 *     doesn't accidentally hide from everyone.
 */
export function expertVisibleTo(expert, user) {
  if (!expert) return false
  const aud = expert.audience || { everyone: true }
  if (aud.everyone) return true
  if (!user) return false
  const groups = aud.groups || []
  const roles = aud.roles || []
  const locations = aud.locations || []
  if (groups.length === 0 && roles.length === 0 && locations.length === 0) return true
  const userGroups = user.groups || []
  const matchGroup = groups.length > 0 && groups.some((g) => userGroups.includes(g))
  const matchRole = roles.length > 0 && user.role && roles.includes(user.role)
  const matchLoc = locations.length > 0 && user.location && locations.includes(user.location)
  return matchGroup || matchRole || matchLoc
}

/**
 * Same as `deriveLiveOrchestrator`, but first filters to experts whose
 * audience includes `user`. Used by Studio's "View as" right rail and by
 * the Companion to scope per-user.
 */
export function deriveLiveOrchestratorFor(config, user) {
  if (!config) return { connections: [], experts: [] }
  if (!user) return deriveLiveOrchestrator(config)
  const visibleExperts = (config.experts || []).filter(
    (a) => a.status === 'active' && expertVisibleTo(a, user)
  )
  const referenced = new Set(visibleExperts.flatMap((a) => a.connectionIds || []))
  return {
    connections: (config.connections || []).filter((c) =>
      c.status === 'connected' && referenced.has(c.id)
    ),
    experts: visibleExperts,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY: Backwards-compat aliases for the in-flight Studio UI rename.
// Remove these once every Studio file uses the new names directly.
// ─────────────────────────────────────────────────────────────────────────────
export const assistantVisibleTo = expertVisibleTo
export const flowMatchesText = workflowMatchesText
