/**
 * configStore v7 — single source of truth for the Navigator Studio + Companion
 * prototypes, simulating one canonical Staffbase Intranet workspace.
 *
 * v7 unification: connectors (MCPs / agents / KBs) collapse into one list
 * with a `kind` discriminator. Source-of-truth is server-side
 * (`navigator_config` + `navigator_assistants`); localStorage is an
 * offline-friendly cache. The seed itself lives in `lib/seed.mjs` and is
 * imported by both client and server.
 *
 * What lives here:
 *   - Storage key + version constants
 *   - `buildSeedConfig()` — calls into lib/seed.mjs + adds client-only
 *     demoUsers (kept here because they're prototype-only).
 *   - `loadConfig()` / `saveConfig()` / `clearConfig()` — localStorage
 *     adapters. No migrations — older snapshots are discarded (hard
 *     cutover, prototype-only).
 *   - Derived selectors (`deriveLiveOrchestrator`, `assistantVisibleTo`)
 *     used by the Studio "View as" preview and the runtime.
 *   - `flowMatchesText` / `notableWordsFromTrigger` — heuristics the
 *     orchestrator's Tier-1 pre-pass also imports server-side
 *     (lib/studio-config.mjs has a server copy to avoid pulling browser
 *     code into Vercel functions).
 */

import { buildSeedClientConfig } from '../../../lib/seed.mjs'

export const STORAGE_KEY = 'staffbase.navigator.config'
export const CONFIG_VERSION = 7

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
// Flow trigger heuristic — also re-implemented in lib/studio-config.mjs for
// the server side. Keep the stop-word list in sync.
// ─────────────────────────────────────────────────────────────────────────────

const FLOW_STOPWORDS = new Set([
  'employee','employees','asks','wants','says','their','they','the','and','for',
  'that','this','about','have','with','what','when','to','on','of','in','a','an',
  'or','is','are','be','do','need','needs','help','want','wants','start','starts',
  'mentions','mention','from','just','some',
])

export function notableWordsFromTrigger(trigger = '') {
  return Array.from(new Set(
    String(trigger).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !FLOW_STOPWORDS.has(w))
  ))
}

export function flowMatchesText(text, flow) {
  if (!text || !flow) return false
  const t = String(text).toLowerCase()
  const words = notableWordsFromTrigger(flow.trigger || '')
  return words.some((w) => t.includes(w))
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence — localStorage adapters. Hard cutover: any snapshot whose
// version doesn't match CONFIG_VERSION is discarded. Server is canonical.
// ─────────────────────────────────────────────────────────────────────────────

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadConfig() {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== CONFIG_VERSION) return null
    return parsed
  } catch (err) {
    console.warn('[configStore] load failed, falling back to seed:', err)
    return null
  }
}

export function saveConfig(config) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, version: CONFIG_VERSION }))
  } catch (err) {
    console.warn('[configStore] save failed:', err)
  }
}

export function clearConfig() {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived selectors — single source of truth for "what does the chat see".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live orchestrator scope (workspace-wide) — connectors that are connected
 * AND referenced by at least one active assistant. Unified shape: returns
 * `{ connectors, assistants }`. Kind-specific filtering happens at the
 * consumer.
 */
export function deriveLiveOrchestrator(config) {
  if (!config) return { connectors: [], assistants: [] }
  const activeAssistants = (config.assistants || []).filter((a) => a.status === 'active')
  const referenced = new Set(activeAssistants.flatMap((a) => a.connectorIds || []))
  return {
    connectors: (config.connectors || []).filter((c) =>
      c.status === 'connected' && referenced.has(c.id)
    ),
    assistants: activeAssistants,
  }
}

/**
 * Audience check — does this assistant reach this user?
 *   - everyone: true → always reach
 *   - otherwise, user must match at least one group/role/location
 *   - empty audience falls back to true so a half-configured assistant
 *     doesn't accidentally hide from everyone.
 */
export function assistantVisibleTo(assistant, user) {
  if (!assistant) return false
  const aud = assistant.audience || { everyone: true }
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
 * Same as `deriveLiveOrchestrator`, but first filters to assistants whose
 * audience includes `user`. Used by Studio's "View as" right rail and by
 * the Companion to scope per-user.
 */
export function deriveLiveOrchestratorFor(config, user) {
  if (!config) return { connectors: [], assistants: [] }
  if (!user) return deriveLiveOrchestrator(config)
  const visibleAssistants = (config.assistants || []).filter(
    (a) => a.status === 'active' && assistantVisibleTo(a, user)
  )
  const referenced = new Set(visibleAssistants.flatMap((a) => a.connectorIds || []))
  return {
    connectors: (config.connectors || []).filter((c) =>
      c.status === 'connected' && referenced.has(c.id)
    ),
    assistants: visibleAssistants,
  }
}
