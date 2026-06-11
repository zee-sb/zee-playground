import { useCallback, useEffect, useRef, useState } from 'react'
import { compileV2, mergeCompiledConfig, mergeCompiledExperts } from '../../../lib/v2-compiler.mjs'
import { useActiveTenant } from '../AIAssistant/useActiveTenant.js'

/**
 * useV2Store — state for the Navigator V2 target-concept prototypes
 * (NavigatorV2 Studio + NavigatorV2Chat).
 *
 * Follows the useConfigStore pattern: hydrate synchronously from
 * localStorage so the UI paints immediately, write through on every
 * mutation, cross-tab sync via the `storage` event.
 *
 * Two seeds:
 *   buildV2Seed()   — full demo data (setup.stage = 'demo')
 *   buildDay0Seed() — fresh tenant   (setup.stage = 'day0' → 'connected')
 *
 * Cross-cutting layer: deriveTuneChecks(config) — a pure function that
 * computes whether the whole config is "in tune" (sources, policies,
 * processes, packs, terminology, escalation routes all consistent).
 * Rendered as the Setup health strip on the Overview tab; each finding
 * carries either a one-click fix descriptor or a deep-link.
 *
 * Server seam (LIVE): V2 state persists per tenant inside the existing
 * navigator_config blob, under `tenantOverrides.v2`, via the same
 * `/api/navigator-config?action=load|save` endpoint + revision CAS that
 * useConfigStore uses. On every push, lib/v2-compiler.mjs ALSO emits the V1
 * runtime entities (connections / workflows / experts, all tagged
 * origin:'v2') so the live orchestrator obeys V2 edits. localStorage stays
 * as the offline cache — Vite-only dev keeps working scripted/seeded.
 */

export const V2_STORAGE_KEY = 'navigatorV2Config'
export const V2_VERSION = 5

// ── Server transports ───────────────────────────────────────────────────────
// Same conventions as useConfigStore: tolerate Vite-only dev (HTML responses),
// thread ?branch=, surface 409 as a typed error for the CAS retry.

const CONFIG_ENDPOINT = '/api/navigator-config'
const EXPERT_ENDPOINT = '/api/navigator-assistant'

async function safeJson(resp) {
  const ct = resp.headers.get('content-type') || ''
  if (!ct.toLowerCase().includes('application/json')) return null
  try { return await resp.json() } catch { return null }
}

function withBranch(url, branchId) {
  if (!branchId) return url
  return `${url}${url.includes('?') ? '&' : '?'}branch=${encodeURIComponent(branchId)}`
}

async function fetchServerV2(branchId) {
  let resp
  try {
    resp = await fetch(withBranch(`${CONFIG_ENDPOINT}?action=load`, branchId), {
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' },
    })
  } catch { return null }
  if (!resp.ok) return null
  return safeJson(resp)
}

async function pushServerV2(payload, branchId) {
  let resp
  try {
    resp = await fetch(withBranch(`${CONFIG_ENDPOINT}?action=save`, branchId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { return null }
  if (resp.status === 409) {
    const body = (await safeJson(resp)) || {}
    const err = new Error('revision_conflict')
    err.code = 'revision_conflict'
    err.currentRevision = body.currentRevision
    throw err
  }
  if (!resp.ok) return null
  return safeJson(resp)
}

async function fetchServerExpertsV2(branchId) {
  let resp
  try {
    resp = await fetch(withBranch(`${EXPERT_ENDPOINT}?action=list`, branchId), { credentials: 'include' })
  } catch { return null }
  if (!resp.ok) return null
  const data = await safeJson(resp)
  return Array.isArray(data?.experts) ? data.experts : null
}

async function pushServerExpertsV2(experts, branchId) {
  let resp
  try {
    resp = await fetch(withBranch(`${EXPERT_ENDPOINT}?action=bulk-save`, branchId), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experts }),
    })
  } catch { return null }
  if (!resp.ok) return null
  const data = await safeJson(resp)
  return Array.isArray(data?.experts) ? data.experts : null
}

// Active tenant, readable outside React (recordChatEscalation). Mirrors
// useActiveTenant's URL-param + cookie convention.
export function activeBranchIdSync() {
  if (typeof window === 'undefined') return null
  const fromUrl = new URLSearchParams(window.location.search).get('tenant')
  if (fromUrl) return fromUrl
  const m = document.cookie.match(/(?:^|;\s*)sb_active_tenant=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function v2KeyForBranch(branchId) {
  return branchId ? `${V2_STORAGE_KEY}:${branchId}` : V2_STORAGE_KEY
}

// Overlay live connection health from the server config onto V2 sources.
// Real health when the server is reachable; the seeded value survives as the
// fallback (Vite-only dev / offline demo).
export function overlayServerHealth(state, serverConfig) {
  const connections = Array.isArray(serverConfig?.connections) ? serverConfig.connections : []
  const byV2Source = new Map(connections.filter((c) => c?.v2SourceId).map((c) => [c.v2SourceId, c]))
  if (!byV2Source.size || !Array.isArray(state?.sources)) return state
  const STATUS_TO_HEALTH = { connected: 'connected', degraded: 'degraded', disconnected: 'disconnected' }
  return {
    ...state,
    sources: state.sources.map((s) => {
      const conn = byV2Source.get(s.id)
      if (!conn) return s
      const health = STATUS_TO_HEALTH[conn.status]
      if (!health || health === s.health) return s
      return {
        ...s,
        health,
        healthNote: health === 'connected' ? undefined : (s.healthNote || `${s.name} is ${health} (live status from the workspace config).`),
      }
    }),
  }
}

// ── Shared vocabulary ────────────────────────────────────────────────────────

export const DOMAINS = [
  { id: 'general', name: 'General intranet',      hint: 'News, pages, directory, everyday questions' },
  { id: 'hr',      name: 'HR policy',             hint: 'Leave, contracts, benefits, payroll' },
  { id: 'medical', name: 'Medical / flight ops',  hint: 'Safety-critical procedures — never paraphrased' },
  { id: 'legal',   name: 'Legal / Works council', hint: 'Agreements, co-determination, contract changes' },
]

export const POLICY_OPTIONS = [
  { id: 'citations',      label: 'Answer with citations' },
  { id: 'cite-or-refuse', label: 'Cite-or-refuse' },
  { id: 'deflect',        label: 'Deflect to human' },
]

export const TIER_OPTIONS = [
  { id: 'assist',  label: 'Assist',  hint: 'Read & explain only' },
  { id: 'trigger', label: 'Trigger', hint: 'Prepare — a human submits' },
  { id: 'execute', label: 'Execute', hint: 'Act, with confirmation' },
]

export const TONE_PRESETS = ['Friendly & concise', 'Formal', 'Plainspoken frontline']

// ── Source catalog ───────────────────────────────────────────────────────────
// One entry per SYSTEM (or external agent), never per protocol. Day-0 connect
// and the demand-driven suggestions both clone from here, so the two seeds
// can't drift apart.

export const SOURCE_DEFS = {
  staffbase: {
    id: 'staffbase', kind: 'system', name: 'Staffbase Intranet', color: '#00C7B2',
    health: 'connected',
    identity: 'service', identityOptions: ['service'],
    engineRoom: 'engine room: native API · campsite.staffbase.com · content + directory scopes',
    capabilities: [
      { id: 'sb-answer',  label: 'Answer questions from news, pages & policies', write: false, tier: 'assist' },
      { id: 'sb-people',  label: 'Look up people in the directory',              write: false, tier: 'assist' },
      { id: 'sb-comment', label: 'Post a comment or reply on your behalf',       write: true,  tier: 'trigger' },
    ],
  },
  sharepoint: {
    id: 'sharepoint', kind: 'system', name: 'SharePoint', color: '#0EA5E9',
    health: 'degraded',
    healthNote: 'Auth token expired 2h ago — retrieval paused. Employees are told: “I can’t verify SharePoint content right now.” No stale answers are served.',
    identity: 'employee', identityOptions: ['employee', 'service'],
    engineRoom: 'engine room: MCP · sharepoint-mcp v1.4 · Graph delegated scopes',
    capabilities: [
      { id: 'sp-search', label: 'Search policy & procedure documents', write: false, tier: 'assist' },
      { id: 'sp-meta',   label: 'Check document owner & freshness',    write: false, tier: 'assist' },
    ],
  },
  workday: {
    id: 'workday', kind: 'system', name: 'Workday', color: '#F59E0B',
    health: 'connected',
    identity: 'employee', identityOptions: ['employee', 'service'],
    engineRoom: 'engine room: MCP · workday-mcp v2.1 · 14 tools exposed',
    capabilities: [
      { id: 'wd-balance', label: 'Look up time-off balances',                 write: false, tier: 'assist' },
      { id: 'wd-leave',   label: 'Submit a leave request, acting as you',     write: true,  tier: 'trigger' },
      { id: 'wd-data',    label: 'Update personal data (address, bank)',      write: true,  tier: 'trigger' },
      { id: 'wd-payslip', label: 'Explain your payslip line by line',         write: false, tier: 'assist' },
    ],
  },
  servicenow: {
    id: 'servicenow', kind: 'system', name: 'ServiceNow', color: '#10B981',
    health: 'connected',
    identity: 'employee', identityOptions: ['employee', 'service'],
    engineRoom: 'engine room: REST API · now-bridge v3 · ITSM + HRSD tables',
    capabilities: [
      { id: 'sn-status', label: 'Check the status of your tickets',          write: false, tier: 'assist' },
      { id: 'sn-create', label: 'Open an IT ticket on your behalf',          write: true,  tier: 'trigger' },
      { id: 'sn-reset',  label: 'Reset your password after verification',    write: true,  tier: 'execute' },
    ],
  },
  personio: {
    id: 'personio', kind: 'system', name: 'Personio', color: '#7C3AED',
    health: 'connected',
    identity: 'employee', identityOptions: ['employee'],
    engineRoom: 'engine room: MCP · personio-mcp v0.9 · read + absence scopes',
    capabilities: [
      { id: 'pe-contract', label: 'Look up your contract & tariff details', write: false, tier: 'assist' },
      { id: 'pe-bank',     label: 'Update your bank details',               write: true,  tier: 'trigger' },
    ],
  },
  // External agents are just another source — same card, same tiers, same
  // health. A handoff is Trigger-semantics: the employee confirms before the
  // agent takes the conversation over.
  'it-agent': {
    id: 'it-agent', kind: 'agent', name: 'IT Virtual Agent', color: '#6366F1',
    health: 'connected',
    identity: 'agent', identityOptions: ['agent'],
    scopeNote: 'Receives only the conversation you hand over and the employee’s name — nothing else.',
    engineRoom: 'engine room: A2A protocol · agent card v0.3 · vendor-hosted (ServiceNow VA)',
    capabilities: [
      { id: 'ag-repair', label: 'Take over conversations about hardware repairs', write: true, handoff: true, tier: 'trigger' },
      { id: 'ag-status', label: 'Report repair progress back into the chat',      write: false, tier: 'assist' },
    ],
  },
}

const clone = (x) => JSON.parse(JSON.stringify(x))

// ── Seeds ────────────────────────────────────────────────────────────────────

export function buildV2Seed() {
  return {
    version: V2_VERSION,
    setup: { stage: 'demo', connectedAt: null, liveDismissed: true },

    sources: [
      clone(SOURCE_DEFS.staffbase),
      clone(SOURCE_DEFS.sharepoint),
      clone(SOURCE_DEFS.workday),
      clone(SOURCE_DEFS.servicenow),
      clone(SOURCE_DEFS.personio),
      clone(SOURCE_DEFS['it-agent']),
    ],

    // ── Question log — clustered demand, last 7 days ────────────────────────
    questionClusters: [
      { id: 'parking',        theme: 'Parking permits at HQ',                 count: 17, trend: 'up',   delta: '+40%', coverage: 'gap',
        note: 'No connected source covers this.', proposalId: 'p-parking' },
      { id: 'parental',       theme: 'Parental leave entitlements',           count: 23, trend: 'up',   delta: '+22%', coverage: 'answered',
        note: 'Answered from HR Policy Hub · 96% with citations.' },
      { id: 'a320-winter',    theme: 'A320 winter operations procedures',     count: 9,  trend: 'flat', delta: '±0%',  coverage: 'partial',
        note: 'Cite-or-refuse policy active. §7 (engine anti-ice) missing from the manual corpus.' },
      { id: 'works-council',  theme: 'Works council agreement — remote work', count: 6,  trend: 'up',   delta: '+50%', coverage: 'escalated',
        note: '3 routed to HR Direct this week — includes 1 live escalation from the V2 chat demo.' },
      { id: 'vpn',            theme: 'VPN & remote access setup',             count: 12, trend: 'down', delta: '−18%', coverage: 'answered',
        note: 'Answered from IT knowledge base.' },
      { id: 'travel-expense', theme: 'Travel expense reimbursement',          count: 14, trend: 'up',   delta: '+12%', coverage: 'partial',
        note: 'Policy answered; the submission steps confuse people. See process proposal.', proposalId: 'p-process' },
      { id: 'meal',           theme: 'Cafeteria menu & meal allowance',       count: 8,  trend: 'flat', delta: '±0%',  coverage: 'partial',
        note: 'German term “Essenszuschuss” misses the English policy page.', proposalId: 'p-term' },
      { id: 'shift-swap',     theme: 'Shift swap rules (Hamburg crew)',       count: 11, trend: 'up',   delta: '+31%', coverage: 'gap',
        note: 'CrewNet doesn’t expose swap rules to Navigator yet.', proposalId: 'p-shiftswap' },
    ],

    // ── Proposals — Navigator's drafts, awaiting admin review ───────────────
    proposals: [
      {
        id: 'p-parking', kind: 'gap-answer', status: 'open', clusterId: 'parking',
        title: '17 people asked about parking permits at HQ this week — no source covers it.',
        draft: 'Employees at Chemnitz HQ can request a parking permit via the Facilities desk (Building B, ground floor) or facilities@campsite.de. Permits are issued monthly; EV charging spots are bookable per day in the Staffbase app under Workplace → Parking.',
        route: 'Facilities',
        effect: 'Publishes the answer and marks the gap covered.',
      },
      {
        id: 'p-shiftswap', kind: 'gap-answer', status: 'open', clusterId: 'shift-swap',
        title: '11 Hamburg crew members asked about shift swap rules — no source covers it.',
        draft: 'Shift swaps must be requested in CrewNet at least 48h before the earlier shift, between colleagues with the same qualification level. The duty manager confirms automatically unless rest-time rules are violated.',
        route: 'Crew Ops',
        effect: 'Publishes the answer and marks the gap covered.',
      },
      {
        id: 'p-stale', kind: 'stale', status: 'open',
        title: 'Stale content: “Travel policy” page was last updated 14 months ago.',
        draft: 'This page was cited in 31 answers this month. Owner: Anna Roth (Finance). Suggest notifying her to review per-diem rates and the new rail-first rule.',
        effect: 'Notifies the page owner with the usage evidence attached.',
      },
      {
        id: 'p-bundle', kind: 'bundle', status: 'open',
        title: 'Cabin crew in Hamburg keep asking about A320 procedures — create a capability bundle?',
        draft: 'Bundle “Cabin Crew HAM”: SharePoint flight-ops corpus + Staffbase crew pages, cite-or-refuse policy, plainspoken tone. Audience derived from profile: role = Cabin crew, base = Hamburg.',
        effect: 'Creates the bundle in Behaviors (internal — employees never see it).',
        payload: {
          bundle: {
            id: 'b-cabincrew-ham', name: 'Cabin Crew HAM', origin: 'proposal',
            audience: [
              { field: 'role', value: 'Cabin crew' },
              { field: 'base', value: 'Hamburg (HAM)' },
              { field: 'fleet', value: 'A320' },
            ],
            sources: ['SharePoint · flight-ops corpus', 'Staffbase · crew pages'],
            policy: 'cite-or-refuse', tone: 'Plainspoken frontline',
          },
        },
      },
      {
        id: 'p-process', kind: 'process', status: 'open', clusterId: 'travel-expense',
        title: 'Travel expense questions follow the same 4-step pattern — draft a “Travel claim” process?',
        draft: 'Collect receipts & trip details → manager approves → submit to Finance via Workday → confirm with payout date. 14 questions this week stalled at “who approves this?”.',
        effect: 'Adds a draft process to Behaviors for you to test-drive and activate.',
        payload: {
          process: {
            id: 'proc-travel-claim', name: 'Travel claim', status: 'draft', origin: 'proposal',
            justification: 'Requires manager approval + finance audit trail — a confirmation gate alone can’t guarantee the approval order.',
            steps: [
              { type: 'collect', label: 'Collect receipts, dates, and cost center' },
              { type: 'approve', label: 'Line manager approves the claim' },
              { type: 'submit',  label: 'Submit to Finance via Workday' },
              { type: 'confirm', label: 'Confirm to the employee with the payout date' },
            ],
          },
        },
      },
      {
        id: 'p-term', kind: 'terminology', status: 'open', clusterId: 'meal',
        title: '“Essenszuschuss” appears in 8 questions but misses the English policy page.',
        draft: 'Add terminology pair: “Essenszuschuss” → “meal allowance” so retrieval bridges the language gap.',
        effect: 'Adds the pair to Tone & terminology.',
        payload: { term: { from: 'Essenszuschuss', to: 'meal allowance' } },
      },
    ],

    // ── Behaviors ───────────────────────────────────────────────────────────
    behaviors: {
      answerPolicies: { general: 'citations', hr: 'citations', medical: 'cite-or-refuse', legal: 'deflect' },
      policyOrigins: {}, // domainId → pack name, when set by a pack install
      terminology: [
        { id: 't1', from: 'PTO',         to: 'Flexible Time Off' },
        { id: 't2', from: 'HQ',          to: 'Chemnitz Campus' },
        { id: 't3', from: 'Crew Portal', to: 'CrewNet' },
      ],
      tonePreset: 'Friendly & concise',
      bannedPhrases: ['synergy', 'going forward', 'per my last message'],
      rawInstructions: '',
      escalationRoutes: {
        general: { type: 'channel', target: '#ask-internal-comms' },
        hr:      { type: 'queue',   target: 'HR Direct' },
        medical: { type: 'team',    target: 'Flight Ops Duty Office' },
        // Live tune issue (seeded): legal is set to "deflect to human" but
        // nobody finished wiring the route. Setup health catches the dead end.
        legal:   { type: 'team',    target: '' },
      },
      bundles: [
        {
          id: 'b-frontline', name: 'Frontline Logistics', origin: 'seed',
          audience: [
            { field: 'location', value: 'Warehouse DUS' },
            { field: 'role', value: 'Logistics' },
            { field: 'contract', value: 'Shift / tariff' },
          ],
          sources: ['Staffbase · ops pages', 'ServiceNow · tickets'],
          policy: 'citations', tone: 'Plainspoken frontline',
        },
        {
          id: 'b-hrpartners', name: 'HR Partners', origin: 'seed',
          audience: [
            { field: 'role', value: 'HR Partner' },
            { field: 'office', value: 'All DE offices' },
          ],
          sources: ['Workday · HR data', 'Personio · contracts', 'Staffbase · HR Policy Hub'],
          policy: 'citations', tone: 'Formal',
        },
      ],
      processes: [
        {
          id: 'proc-wc-data', name: 'Works council data request', status: 'active', origin: 'seed',
          justification: 'Requires works-council sign-off + a full audit trail — co-determination law, not convenience.',
          steps: [
            { type: 'collect', label: 'Collect the data scope and legal basis' },
            { type: 'approve', label: 'Works council chair signs off' },
            { type: 'submit',  label: 'Submit to the people-data team' },
            { type: 'confirm', label: 'Confirm completion to both parties' },
          ],
        },
      ],
    },

    installedPacks: {}, // packId → { installedAt, answers, priorPolicies }
    day0Suggestions: [], // demand-driven onboarding nudges — day-0 mode only

    escalations: [
      { id: 'esc-seed-1', topic: 'Works council agreement — remote work', to: 'HR Direct', via: 'chat', when: 'Tue 14:12', status: 'open' },
    ],
  }
}

/**
 * Day-0 seed: a fresh tenant. Nothing connected, nothing observed.
 * Defaults are deliberately conservative so the Setup health strip reads
 * "in tune" the moment the intranet connects — value first, configuration
 * only when demand justifies it.
 */
export function buildDay0Seed() {
  return {
    version: V2_VERSION,
    setup: { stage: 'day0', connectedAt: null, liveDismissed: false },
    sources: [],
    questionClusters: [],
    proposals: [],
    behaviors: {
      answerPolicies: { general: 'citations', hr: 'citations', medical: 'deflect', legal: 'deflect' },
      policyOrigins: {},
      terminology: [],
      tonePreset: 'Friendly & concise',
      bannedPhrases: [],
      rawInstructions: '',
      escalationRoutes: {
        general: { type: 'channel', target: '#ask-internal-comms' },
        hr:      { type: 'queue',   target: 'HR Direct' },
        medical: { type: 'team',    target: 'Flight Ops Duty Office' },
        legal:   { type: 'team',    target: 'Works Council Office' },
      },
      bundles: [],
      processes: [],
    },
    installedPacks: {},
    day0Suggestions: [],
    escalations: [],
  }
}

/**
 * Demand-driven suggestions that appear after the day-0 connect — over time
 * within a session (timed reveal) or all at once on reload. Each carries the
 * evidence cluster that lands in the question log when it reveals, so the
 * "watching" state visibly fills up.
 */
function buildDay0Suggestions() {
  return [
    {
      id: 'sg-servicenow', appearAfterMs: 7000, status: 'pending', sourceId: 'servicenow',
      title: '12 questions about IT tickets already — connect ServiceNow?',
      detail: 'Ticket status and password resets keep coming up. ServiceNow was detected in your SSO catalog — one connection covers both.',
      cta: 'Connect ServiceNow',
      cluster: { id: 'd0-it', theme: 'IT tickets & password resets', count: 12, trend: 'up', delta: 'new', coverage: 'gap',
        note: 'No connected source covers this yet — see the suggestion above.' },
    },
    {
      id: 'sg-hrpack', appearAfterMs: 15000, status: 'pending',
      title: 'HR questions are forming a pattern — install the HR Starter pack?',
      detail: 'Leave, contracts, payroll. The pack’s needs match your connected sources, so it’s useful immediately — and uninstall reverts everything.',
      cta: 'Install HR Starter',
      cluster: { id: 'd0-hr', theme: 'Parental leave & contracts', count: 7, trend: 'up', delta: 'new', coverage: 'partial',
        note: 'Partially answered from intranet pages — the HR Starter pack adds policies and a notification process.' },
    },
    {
      id: 'sg-workday', appearAfterMs: 23000, status: 'pending', sourceId: 'workday',
      title: '9 people asked about their leave balance — connect Workday?',
      detail: 'Balances live in Workday. Connected under employee identity, Navigator answers each person from their own record — no shared service account.',
      cta: 'Connect Workday',
      cluster: { id: 'd0-leave', theme: 'Time-off balances', count: 9, trend: 'up', delta: 'new', coverage: 'gap',
        note: 'Needs an HRIS connection — see the suggestion above.' },
    },
  ]
}

// Static pack catalog — definitions don't change at runtime, so they live
// outside the persisted blob.
export const PACKS_CATALOG = [
  {
    id: 'hr-starter', name: 'HR Starter', emoji: '🌱',
    tagline: 'Leave, contracts, payroll basics, parental-leave notification.',
    contents: {
      bundles: [
        {
          id: 'b-pk-newparents', name: 'New parents',
          audience: [{ field: 'life event', value: 'Parental leave (declared)' }],
          sources: ['Workday · leave data', 'Staffbase · HR Policy Hub'],
          policy: 'citations', tone: 'Friendly & concise',
        },
        {
          id: 'b-pk-managers', name: 'People managers',
          audience: [{ field: 'role', value: 'Manager (derived from org chart)' }],
          sources: ['Workday · team data', 'Staffbase · manager guides'],
          policy: 'citations', tone: 'Formal',
        },
      ],
      processes: [
        {
          id: 'proc-pk-parental', name: 'Parental-leave notification', status: 'draft',
          justification: 'Statutory deadlines + written-form requirement — must be auditable.',
          steps: [
            { type: 'collect', label: 'Collect expected date and leave model' },
            { type: 'approve', label: 'HR partner confirms eligibility' },
            { type: 'submit',  label: 'File the notification in Workday' },
            { type: 'confirm', label: 'Send confirmation + checklist to the employee' },
          ],
        },
      ],
      policies: [{ domain: 'hr', policy: 'citations' }],
      terminology: [
        { from: 'Elternzeit', to: 'parental leave (Elternzeit)' },
        { from: 'Mutterschutz', to: 'maternity protection (Mutterschutz)' },
      ],
    },
    intents: [
      { id: 'i-hris',    label: 'Needs an HRIS connection',            matchSource: 'workday' },
      { id: 'i-leave',   label: 'Needs leave policy documents',        matchSource: 'sharepoint' },
      { id: 'i-payroll', label: 'Needs a payroll contact',             ask: 'Which team handles payroll questions?' },
      { id: 'i-buddy',   label: 'Needs an onboarding buddy roster',    watch: true },
    ],
  },
  {
    id: 'it-helpdesk', name: 'IT Helpdesk', emoji: '🛠️',
    tagline: 'Tickets, password resets, hardware replacement, access basics.',
    contents: {
      bundles: [
        {
          id: 'b-pk-officeit', name: 'Office IT basics',
          audience: [{ field: 'workplace', value: 'Office-based (derived)' }],
          sources: ['ServiceNow · ITSM', 'Staffbase · IT knowledge base'],
          policy: 'citations', tone: 'Friendly & concise',
        },
      ],
      processes: [
        {
          id: 'proc-pk-hardware', name: 'Hardware replacement', status: 'draft',
          justification: 'Cost-center approval + asset audit trail.',
          steps: [
            { type: 'collect', label: 'Collect device details and reason' },
            { type: 'approve', label: 'Cost-center owner approves' },
            { type: 'submit',  label: 'Place the order in ServiceNow' },
            { type: 'confirm', label: 'Confirm with the delivery date' },
          ],
        },
      ],
      policies: [{ domain: 'general', policy: 'citations' }],
      terminology: [
        { from: 'SSO', to: 'single sign-on' },
        { from: 'MFA', to: 'two-factor login' },
      ],
    },
    intents: [
      { id: 'i-ticket', label: 'Needs a ticketing system',                 matchSource: 'servicenow' },
      { id: 'i-kb',     label: 'Needs an IT knowledge base',               matchSource: 'staffbase' },
      { id: 'i-remote', label: 'Needs remote-access documentation',        watch: true },
    ],
  },
  {
    id: 'cabin-crew', name: 'Cabin Crew Pack', emoji: '✈️',
    tagline: 'Flight-ops procedures (strict), sick-on-duty, crew terminology.',
    contents: {
      bundles: [
        {
          id: 'b-pk-cabincrew', name: 'Cabin crew',
          audience: [
            { field: 'role', value: 'Cabin crew' },
            { field: 'base', value: 'derived from roster' },
            { field: 'fleet', value: 'derived from qualification' },
          ],
          sources: ['SharePoint · flight-ops corpus', 'Staffbase · crew pages'],
          policy: 'cite-or-refuse', tone: 'Plainspoken frontline',
        },
      ],
      processes: [
        {
          id: 'proc-pk-sick', name: 'Sick-on-duty report', status: 'draft',
          justification: 'Regulatory reporting window + audit trail for crew control.',
          steps: [
            { type: 'collect', label: 'Collect flight, symptoms onset, and fitness status' },
            { type: 'approve', label: 'Duty manager acknowledges' },
            { type: 'submit',  label: 'File the report with crew control' },
            { type: 'confirm', label: 'Confirm and share the return-to-duty checklist' },
          ],
        },
      ],
      policies: [{ domain: 'medical', policy: 'cite-or-refuse' }],
      terminology: [
        { from: 'SEP', to: 'safety & emergency procedures' },
        { from: 'FA', to: 'flight attendant' },
      ],
    },
    intents: [
      { id: 'i-flightops', label: 'Needs flight-ops procedure documents',            matchSource: 'sharepoint' },
      { id: 'i-profile',   label: 'Needs crew profile fields (base, fleet, contract)', matchSource: 'staffbase' },
      { id: 'i-roster',    label: 'Needs a crew scheduling system',                  ask: 'Which system holds the crew roster?' },
    ],
  },
]

// ── Setup health — deriveTuneChecks ──────────────────────────────────────────

// Which sources can back which answer-policy domain (for the "policy with no
// backing source" check).
const DOMAIN_SOURCE_HINTS = {
  general: ['staffbase'],
  hr:      ['staffbase', 'workday', 'personio'],
  medical: ['sharepoint'],
  legal:   ['staffbase'],
}

// Sensible defaults for one-click route repair.
const SUGGESTED_ROUTES = {
  general: { type: 'channel', target: '#ask-internal-comms' },
  hr:      { type: 'queue',   target: 'HR Direct' },
  medical: { type: 'team',    target: 'Flight Ops Duty Office' },
  legal:   { type: 'team',    target: 'Works Council Office' },
}

// Deterministic stand-in for "does this term ever appear in indexed
// content?" — the full build checks the retrieval index.
const CONTENT_VOCAB = [
  'flexible time off', 'chemnitz campus', 'meal allowance',
  'parental leave (elternzeit)', 'maternity protection (mutterschutz)',
  'single sign-on', 'two-factor login',
  'safety & emergency procedures', 'flight attendant',
]

const SEVERITY_RANK = { error: 0, warn: 1, info: 2 }

function sourceNameIn(text, source) {
  return (text || '').toLowerCase().includes(source.name.toLowerCase())
}

function processTargets(proc, sourceList) {
  // Which known system does this process write into? Inferred from step text.
  for (const s of sourceList) {
    if (proc.steps.some((st) => sourceNameIn(st.label, s))) return s
  }
  return null
}

/**
 * Pure consistency pass over the whole config. Returns an array of findings:
 *   { id, severity: 'error'|'warn'|'info', text, fix?, link? }
 *   fix  — one-click descriptor, applied via store.applyTuneFix(fix)
 *   link — { tab, label } deep-link into the right Studio tab
 * No find­ings = the workspace is "in tune".
 */
export function deriveTuneChecks(config) {
  if (!config || config.setup?.stage === 'day0') return []
  const checks = []
  const sources = config.sources || []
  const b = config.behaviors || {}
  const allKnownSources = Object.values(SOURCE_DEFS)
  const connectedIds = new Set(sources.map((s) => s.id))

  // 1 — A degraded/disconnected source that other config depends on.
  for (const src of sources) {
    if (src.health === 'connected') continue
    const dependents = []
    for (const [domainId, hintIds] of Object.entries(DOMAIN_SOURCE_HINTS)) {
      const policy = b.answerPolicies?.[domainId]
      if (hintIds.includes(src.id) && policy && policy !== 'deflect') {
        const others = hintIds.filter((id) => id !== src.id && connectedIds.has(id))
        if (others.length === 0) dependents.push(`${DOMAINS.find((d) => d.id === domainId)?.name} answers`)
      }
    }
    const bundles = (b.bundles || []).filter((bd) => bd.sources.some((ref) => sourceNameIn(ref, src)))
    if (bundles.length) dependents.push(bundles.map((bd) => `“${bd.name}”`).join(', '))
    const procs = (b.processes || []).filter((p) => processTargets(p, [src]))
    if (procs.length) dependents.push(procs.map((p) => `the “${p.name}” process`).join(', '))
    const isDown = src.health === 'disconnected'
    checks.push({
      id: `tune-health-${src.id}`,
      severity: isDown ? 'error' : 'warn',
      text: `${src.name} is ${isDown ? 'disconnected' : 'degraded'}${src.healthNote ? ' (auth expired)' : ''}. ${
        dependents.length
          ? `Depends on it: ${dependents.join('; ')} — employees get an honest refusal with escalation instead of stale answers.`
          : 'Nothing critical depends on it yet, but retrieval from it is paused.'
      }`,
      fix: { type: 'reconnect-source', sourceId: src.id, label: `Reconnect ${src.name}` },
      link: { tab: 'sources', label: 'Open Sources & Actions' },
    })
  }

  // 2 — Config that references a system which isn't connected at all.
  const missing = new Map() // sourceId → string[] of dependents
  const need = (srcId, what) => {
    if (connectedIds.has(srcId)) return
    if (!missing.has(srcId)) missing.set(srcId, [])
    missing.get(srcId).push(what)
  }
  for (const def of allKnownSources) {
    if (connectedIds.has(def.id)) continue
    for (const bd of b.bundles || []) {
      if (bd.sources.some((ref) => sourceNameIn(ref, def))) need(def.id, `bundle “${bd.name}”`)
    }
    for (const p of b.processes || []) {
      if (p.steps.some((st) => sourceNameIn(st.label, def))) need(def.id, `process “${p.name}”`)
    }
  }
  for (const [packId] of Object.entries(config.installedPacks || {})) {
    const pack = PACKS_CATALOG.find((p) => p.id === packId)
    if (!pack) continue
    for (const intent of pack.intents) {
      if (intent.matchSource && !connectedIds.has(intent.matchSource)) {
        need(intent.matchSource, `${pack.name} pack (${intent.label.toLowerCase()})`)
      }
    }
  }
  for (const [srcId, deps] of missing) {
    const def = SOURCE_DEFS[srcId]
    const suggestion = (config.day0Suggestions || []).find((s) => s.sourceId === srcId && s.status === 'visible')
    checks.push({
      id: `tune-missing-${srcId}`,
      severity: 'info',
      text: `${def?.name || srcId} isn’t connected, but ${deps.join(', ')} expect${deps.length === 1 ? 's' : ''} it. Navigator answers what it can and watches the question log for the rest.`,
      fix: suggestion ? { type: 'apply-suggestion', suggestionId: suggestion.id, label: `Connect ${def?.name}` } : undefined,
      link: { tab: 'sources', label: 'Open Sources & Actions' },
    })
  }

  // 3 — An answer policy that promises citations but has no backing source.
  for (const d of DOMAINS) {
    const policy = b.answerPolicies?.[d.id]
    if (!policy || policy === 'deflect') continue
    const hintIds = DOMAIN_SOURCE_HINTS[d.id] || []
    if (!hintIds.some((id) => connectedIds.has(id))) {
      const label = POLICY_OPTIONS.find((p) => p.id === policy)?.label || policy
      checks.push({
        id: `tune-policy-${d.id}`,
        severity: 'warn',
        text: `${d.name} is set to “${label}”, but no source that covers it is connected — every question there refuses or escalates.`,
        fix: { type: 'set-policy', domainId: d.id, policy: 'deflect', label: 'Deflect to human for now' },
        link: { tab: 'sources', label: 'Open Sources & Actions' },
      })
    }
  }

  // 4 — A process whose submit target has every write capability on Assist.
  for (const proc of b.processes || []) {
    const target = processTargets(proc, sources)
    if (!target) continue
    const writeCaps = target.capabilities.filter((c) => c.write)
    if (writeCaps.length && writeCaps.every((c) => c.tier === 'assist')) {
      const first = writeCaps[0]
      checks.push({
        id: `tune-tier-${proc.id}`,
        severity: proc.status === 'active' ? 'warn' : 'info',
        text: `“${proc.name}” submits via ${target.name}, but every ${target.name} write capability is set to Assist — the process can’t complete its submit step.`,
        fix: { type: 'set-tier', sourceId: target.id, capId: first.id, tier: 'trigger', label: `Set “${first.label}” to Trigger` },
        link: { tab: 'sources', label: 'Open Sources & Actions' },
      })
    }
  }

  // 5 — A terminology pair that never matches any indexed content.
  for (const t of b.terminology || []) {
    if (!CONTENT_VOCAB.includes((t.to || '').toLowerCase())) {
      checks.push({
        id: `tune-term-${t.id}`,
        severity: 'info',
        text: `Terminology pair “${t.from} → ${t.to}” has never matched any indexed content — ${t.to} isn’t in a connected source, so the pair does nothing yet.`,
        fix: { type: 'remove-term', termId: t.id, label: 'Remove the pair' },
        link: { tab: 'behaviors', label: 'Open Behaviors' },
      })
    }
  }

  // 6 — An escalation route that points at nothing.
  for (const d of DOMAINS) {
    const route = b.escalationRoutes?.[d.id]
    if (route && route.target && route.target.trim()) continue
    const policy = b.answerPolicies?.[d.id]
    const suggested = SUGGESTED_ROUTES[d.id]
    checks.push({
      id: `tune-route-${d.id}`,
      severity: policy === 'deflect' ? 'error' : 'warn',
      text: policy === 'deflect'
        ? `${d.name} is set to “Deflect to human”, but its escalation route is empty — those questions currently dead-end.`
        : `${d.name} has no escalation route — when Navigator can’t answer there, the question has nowhere to go.`,
      fix: suggested ? { type: 'set-route', domainId: d.id, route: suggested, label: `Route to ${suggested.target}` } : undefined,
      link: { tab: 'behaviors', label: 'Open Behaviors' },
    })
  }

  return checks.sort((a, b2) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b2.severity])
}

// ── localStorage adapters ────────────────────────────────────────────────────

export function loadV2Config(branchId = activeBranchIdSync()) {
  if (typeof window === 'undefined') return null
  try {
    // Branch-keyed snapshot first; the legacy un-keyed key is the migration
    // fallback so pre-tenant demo state survives.
    const raw = window.localStorage.getItem(v2KeyForBranch(branchId))
      || window.localStorage.getItem(V2_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== V2_VERSION) return null // hard cutover, prototype-only
    return parsed
  } catch {
    return null
  }
}

export function saveV2Config(config, branchId = activeBranchIdSync()) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(v2KeyForBranch(branchId), JSON.stringify(config))
  } catch { /* quota / private mode — non-fatal for a demo */ }
}

export function clearV2Config(branchId = activeBranchIdSync()) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(v2KeyForBranch(branchId))
    window.localStorage.removeItem(V2_STORAGE_KEY)
  } catch { /* noop */ }
}

/**
 * Called by the V2 chat when a question gets routed to a human, so the
 * escalation shows up in the Studio question log (the loop closing in both
 * directions is the demo's point). Works without the Studio being open, and
 * is safe in day-0 mode (the cluster mapping is a no-op there).
 */
export function recordChatEscalation({ topic, to }) {
  const config = loadV2Config() || buildV2Seed()
  const id = `esc-${Date.now().toString(36)}`
  const next = {
    ...config,
    escalations: [
      { id, topic, to, via: 'chat', when: 'just now', status: 'open' },
      ...(config.escalations || []),
    ],
    questionClusters: (config.questionClusters || []).map((c) =>
      c.id === 'works-council'
        ? { ...c, count: c.count + 1, note: `Routed to ${to} again just now — live from the V2 chat demo. Repeated escalations become a proposal.` }
        : c
    ),
  }
  saveV2Config(next)
  return next
}

// ── Pure mutation helpers (shared by hook actions) ───────────────────────────

function applyPackInstall(prev, pack, answers = {}) {
  const priorPolicies = {}
  const nextPolicies = { ...prev.behaviors.answerPolicies }
  const nextOrigins = { ...prev.behaviors.policyOrigins }
  for (const pol of pack.contents.policies) {
    priorPolicies[pol.domain] = prev.behaviors.answerPolicies[pol.domain]
    nextPolicies[pol.domain] = pol.policy
    nextOrigins[pol.domain] = pack.name
  }
  return {
    ...prev,
    behaviors: {
      ...prev.behaviors,
      answerPolicies: nextPolicies,
      policyOrigins: nextOrigins,
      bundles: [
        ...pack.contents.bundles.map((bd) => ({ ...bd, fromPack: pack.id, origin: 'pack' })),
        ...prev.behaviors.bundles,
      ],
      processes: [
        ...pack.contents.processes.map((p) => ({ ...p, fromPack: pack.id, origin: 'pack' })),
        ...prev.behaviors.processes,
      ],
      terminology: [
        ...prev.behaviors.terminology,
        ...pack.contents.terminology.map((t, i) => ({
          id: `t-${pack.id}-${i}`, ...t, fromPack: pack.id,
        })),
      ],
    },
    installedPacks: {
      ...prev.installedPacks,
      [pack.id]: { installedAt: Date.now(), answers, priorPolicies },
    },
  }
}

function applyPackUninstall(prev, pack) {
  const record = prev.installedPacks[pack.id]
  const nextPolicies = { ...prev.behaviors.answerPolicies }
  const nextOrigins = { ...prev.behaviors.policyOrigins }
  if (record?.priorPolicies) {
    for (const [domain, prior] of Object.entries(record.priorPolicies)) {
      if (prior) nextPolicies[domain] = prior
      delete nextOrigins[domain]
    }
  }
  const nextInstalled = { ...prev.installedPacks }
  delete nextInstalled[pack.id]
  let next = {
    ...prev,
    behaviors: {
      ...prev.behaviors,
      answerPolicies: nextPolicies,
      policyOrigins: nextOrigins,
      bundles: prev.behaviors.bundles.filter((bd) => bd.fromPack !== pack.id),
      processes: prev.behaviors.processes.filter((p) => p.fromPack !== pack.id),
      terminology: prev.behaviors.terminology.filter((t) => t.fromPack !== pack.id),
    },
    installedPacks: nextInstalled,
  }
  // Day-0 coherence: if this pack arrived via a suggestion, re-open it so the
  // question log doesn't claim coverage that no longer exists.
  if (pack.id === 'hr-starter' && (prev.day0Suggestions || []).some((s) => s.id === 'sg-hrpack' && s.status === 'done')) {
    next = {
      ...next,
      day0Suggestions: next.day0Suggestions.map((s) => s.id === 'sg-hrpack' ? { ...s, status: 'visible' } : s),
      questionClusters: next.questionClusters.map((c) =>
        c.id === 'd0-hr'
          ? { ...c, coverage: 'partial', note: 'Partially answered from intranet pages — the HR Starter pack adds policies and a notification process.' }
          : c
      ),
    }
  }
  return next
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useV2Store() {
  const { branchId } = useActiveTenant()
  const branchIdRef = useRef(branchId)
  useEffect(() => { branchIdRef.current = branchId }, [branchId])

  const [config, setConfigState] = useState(() => {
    const loaded = loadV2Config(branchId)
    if (loaded) return loaded
    const seeded = buildV2Seed()
    saveV2Config(seeded, branchId)
    return seeded
  })

  // Server snapshot — the full navigator_config blob + revision the CAS save
  // is based on. `loaded` distinguishes "offline / Vite-only dev" (never
  // push) from "server reachable" (write through on every change).
  const serverRef = useRef({ revision: 0, config: null, experts: null, loaded: false })
  const lastPushedSigRef = useRef(null)
  const pushTimerRef = useRef(null)
  const latestConfigRef = useRef(config)
  useEffect(() => { latestConfigRef.current = config }, [config])

  // Write-through persistence (offline cache, branch-keyed).
  useEffect(() => { saveV2Config(config, branchId) }, [config, branchId])

  // Cross-tab sync (Studio + Chat open side by side).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const watched = v2KeyForBranch(branchId)
    function onStorage(e) {
      if (e.key !== watched && e.key !== V2_STORAGE_KEY) return
      const next = loadV2Config(branchId)
      if (next) setConfigState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [branchId])

  // Tenant switch — re-hydrate from the new branch's offline cache while the
  // server fetch below re-runs.
  const lastBranchRef = useRef(branchId)
  useEffect(() => {
    if (lastBranchRef.current === branchId) return
    lastBranchRef.current = branchId
    serverRef.current = { revision: 0, config: null, experts: null, loaded: false }
    lastPushedSigRef.current = null
    const loaded = loadV2Config(branchId)
    if (loaded) setConfigState(loaded)
    else {
      const seeded = buildV2Seed()
      saveV2Config(seeded, branchId)
      setConfigState(seeded)
    }
  }, [branchId])

  // Debounced compile-and-push. One push writes BOTH halves of the runtime
  // contract: (1) the navigator_config blob — V1 entities compiled from V2
  // state (origin:'v2') merged over the server's hand-made entities, plus the
  // raw V2 state under tenantOverrides.v2 — with revision CAS, and (2) the
  // compiled capability-bundle experts via the experts bulk-save.
  const schedulePush = useCallback(() => {
    if (typeof window === 'undefined') return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(async () => {
      pushTimerRef.current = null
      const srv = serverRef.current
      if (!srv.loaded) return // server unreachable — stay localStorage-only
      const state = latestConfigRef.current
      const sig = JSON.stringify(state)
      if (sig === lastPushedSigRef.current) return
      const compiled = compileV2(state)
      const doSave = async () => pushServerV2({
        config: mergeCompiledConfig(serverRef.current.config, state, compiled),
        baseRevision: serverRef.current.revision,
      }, branchIdRef.current)
      try {
        let saved
        try {
          saved = await doSave()
        } catch (err) {
          if (err.code !== 'revision_conflict') throw err
          // Someone else (V1 Studio, another tab) saved meanwhile — refetch
          // the latest blob and re-merge our compiled output once.
          const fresh = await fetchServerV2(branchIdRef.current)
          if (!fresh) return
          serverRef.current = { ...serverRef.current, revision: fresh.revision || 0, config: fresh.config || null, loaded: true }
          saved = await doSave()
        }
        if (saved) {
          serverRef.current = { ...serverRef.current, revision: saved.revision || serverRef.current.revision, config: saved.config || serverRef.current.config }
          lastPushedSigRef.current = sig
        }
      } catch (err) {
        console.warn('[useV2Store] save failed:', err.message)
        return
      }
      // Experts: replace only source:'v2' rows, keep hand-made V1 experts.
      const expertsPayload = mergeCompiledExperts(serverRef.current.experts || [], compiled.experts)
      const pushed = await pushServerExpertsV2(expertsPayload, branchIdRef.current).catch(() => null)
      if (Array.isArray(pushed)) serverRef.current.experts = pushed
    }, 600)
  }, [])

  // First-mount / branch-change server hydrate.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [payload, experts] = await Promise.all([
        fetchServerV2(branchId).catch(() => null),
        fetchServerExpertsV2(branchId).catch(() => null),
      ])
      if (cancelled) return
      if (!payload) return // offline — seeded/local state stands
      serverRef.current = {
        revision: payload.revision || 0,
        config: payload.config || { connections: [], workflows: [], tenantOverrides: {} },
        experts: Array.isArray(experts) ? experts : [],
        loaded: true,
      }
      const v2 = payload.config?.tenantOverrides?.v2
      if (v2?.state && v2.state.version === V2_VERSION) {
        // Server is canonical. Overlay live connection health onto sources.
        const next = overlayServerHealth(v2.state, payload.config)
        lastPushedSigRef.current = JSON.stringify(v2.state)
        setConfigState(next)
      } else {
        // Server has no (compatible) v2 section yet — push the local state
        // up once so live chat immediately sees compiled entities.
        schedulePush()
      }
    })()
    return () => { cancelled = true }
  }, [branchId, schedulePush])

  const update = useCallback((updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      schedulePush()
      return next
    })
  }, [schedulePush])

  // ── Day-0 onboarding ───────────────────────────────────────────────────
  /** The one decision: connect the intranet. Everything after is iteration. */
  const connectIntranet = useCallback(() => {
    update((prev) => {
      if (prev.setup?.stage !== 'day0') return prev
      return {
        ...prev,
        setup: { stage: 'connected', connectedAt: Date.now(), liveDismissed: false },
        sources: [clone(SOURCE_DEFS.staffbase)],
        day0Suggestions: buildDay0Suggestions(),
      }
    })
  }, [update])

  /** Timed reveal: pending suggestions become visible (and drop their
   * evidence cluster into the question log) once their delay elapsed.
   * Called from the Overview tab on an interval — and on reload, everything
   * overdue reveals at once. Deterministic, no randomness. */
  const revealDueSuggestions = useCallback(() => {
    update((prev) => {
      if (prev.setup?.stage !== 'connected') return prev
      const elapsed = Date.now() - (prev.setup.connectedAt || 0)
      const due = (prev.day0Suggestions || []).filter((s) => s.status === 'pending' && elapsed >= s.appearAfterMs)
      if (due.length === 0) return prev
      const dueIds = new Set(due.map((s) => s.id))
      return {
        ...prev,
        day0Suggestions: prev.day0Suggestions.map((s) => dueIds.has(s.id) ? { ...s, status: 'visible' } : s),
        questionClusters: [
          ...prev.questionClusters,
          ...due.map((s) => ({ ...s.cluster })),
        ],
      }
    })
  }, [update])

  /** One click on a day-0 suggestion: connect the system / install the pack,
   * and flip its evidence cluster to covered. */
  const applySuggestion = useCallback((suggestionId) => {
    update((prev) => {
      const sg = (prev.day0Suggestions || []).find((s) => s.id === suggestionId)
      if (!sg || sg.status === 'done') return prev
      let next = {
        ...prev,
        day0Suggestions: prev.day0Suggestions.map((s) => s.id === suggestionId ? { ...s, status: 'done' } : s),
      }
      if (sg.sourceId && !next.sources.some((s) => s.id === sg.sourceId)) {
        next = { ...next, sources: [...next.sources, clone(SOURCE_DEFS[sg.sourceId])] }
      }
      if (sg.id === 'sg-hrpack' && !next.installedPacks['hr-starter']) {
        const pack = PACKS_CATALOG.find((p) => p.id === 'hr-starter')
        next = applyPackInstall(next, pack)
      }
      const coveredNotes = {
        'd0-it':    'Covered — ServiceNow is connected. Status checks and ticket creation are live.',
        'd0-hr':    'Covered — HR Starter installed: policies, a parental-leave process, and terminology are active.',
        'd0-leave': 'Covered — Workday connected under employee identity. Everyone sees their own balance.',
      }
      next = {
        ...next,
        questionClusters: next.questionClusters.map((c) =>
          c.id === sg.cluster.id ? { ...c, coverage: 'answered', note: coveredNotes[c.id] || 'Covered.' } : c
        ),
      }
      return next
    })
  }, [update])

  const dismissLiveMoment = useCallback(() => {
    update((prev) => ({ ...prev, setup: { ...prev.setup, liveDismissed: true } }))
  }, [update])

  // ── Sources & Actions ──────────────────────────────────────────────────
  const setCapabilityTier = useCallback((sourceId, capId, tier) => {
    update((prev) => ({
      ...prev,
      sources: prev.sources.map((s) => s.id !== sourceId ? s : {
        ...s,
        capabilities: s.capabilities.map((c) => c.id === capId ? { ...c, tier } : c),
      }),
    }))
  }, [update])

  const setIdentityMode = useCallback((sourceId, identity) => {
    update((prev) => ({
      ...prev,
      sources: prev.sources.map((s) => s.id === sourceId ? { ...s, identity } : s),
    }))
  }, [update])

  /** Simulated re-auth: clears a degraded/disconnected state. */
  const reconnectSource = useCallback((sourceId) => {
    update((prev) => ({
      ...prev,
      sources: prev.sources.map((s) =>
        s.id === sourceId ? { ...s, health: 'connected', healthNote: undefined } : s
      ),
    }))
  }, [update])

  // ── Question log / proposals ───────────────────────────────────────────
  const approveProposal = useCallback((proposalId, editedDraft) => {
    update((prev) => {
      const proposal = prev.proposals.find((p) => p.id === proposalId)
      if (!proposal) return prev
      let next = {
        ...prev,
        proposals: prev.proposals.map((p) =>
          p.id === proposalId
            ? { ...p, status: 'approved', draft: editedDraft ?? p.draft, resolvedAt: 'just now' }
            : p
        ),
      }
      // Visible effects, per proposal kind.
      if (proposal.kind === 'gap-answer' && proposal.clusterId) {
        next.questionClusters = next.questionClusters.map((c) =>
          c.id === proposal.clusterId
            ? { ...c, coverage: 'answered', note: 'Covered by an approved answer — published just now.' }
            : c
        )
      }
      if (proposal.kind === 'bundle' && proposal.payload?.bundle) {
        next.behaviors = {
          ...next.behaviors,
          bundles: [{ ...proposal.payload.bundle }, ...next.behaviors.bundles],
        }
      }
      if (proposal.kind === 'process' && proposal.payload?.process) {
        next.behaviors = {
          ...next.behaviors,
          processes: [{ ...proposal.payload.process }, ...next.behaviors.processes],
        }
      }
      if (proposal.kind === 'terminology' && proposal.payload?.term) {
        next.behaviors = {
          ...next.behaviors,
          terminology: [
            ...next.behaviors.terminology,
            { id: `t-${Date.now().toString(36)}`, ...proposal.payload.term, origin: 'proposal' },
          ],
        }
        next.questionClusters = next.questionClusters.map((c) =>
          c.id === proposal.clusterId
            ? { ...c, coverage: 'answered', note: 'Terminology pair added — German queries now hit the English policy page.' }
            : c
        )
      }
      if (proposal.kind === 'stale') {
        next.proposals = next.proposals.map((p) =>
          p.id === proposalId ? { ...p, resolution: 'Owner notified (Anna Roth, Finance) with usage evidence.' } : p
        )
      }
      return next
    })
  }, [update])

  const dismissProposal = useCallback((proposalId) => {
    update((prev) => ({
      ...prev,
      proposals: prev.proposals.map((p) => p.id === proposalId ? { ...p, status: 'dismissed' } : p),
    }))
  }, [update])

  // ── Behaviors ──────────────────────────────────────────────────────────
  const setAnswerPolicy = useCallback((domainId, policy) => {
    update((prev) => ({
      ...prev,
      behaviors: {
        ...prev.behaviors,
        answerPolicies: { ...prev.behaviors.answerPolicies, [domainId]: policy },
        policyOrigins: { ...prev.behaviors.policyOrigins, [domainId]: undefined },
      },
    }))
  }, [update])

  const addTerminology = useCallback((from, to) => {
    update((prev) => ({
      ...prev,
      behaviors: {
        ...prev.behaviors,
        terminology: [...prev.behaviors.terminology, { id: `t-${Date.now().toString(36)}`, from, to }],
      },
    }))
  }, [update])

  const removeTerminology = useCallback((id) => {
    update((prev) => ({
      ...prev,
      behaviors: { ...prev.behaviors, terminology: prev.behaviors.terminology.filter((t) => t.id !== id) },
    }))
  }, [update])

  const setTonePreset = useCallback((tonePreset) => {
    update((prev) => ({ ...prev, behaviors: { ...prev.behaviors, tonePreset } }))
  }, [update])

  const addBannedPhrase = useCallback((phrase) => {
    update((prev) => prev.behaviors.bannedPhrases.includes(phrase) ? prev : ({
      ...prev,
      behaviors: { ...prev.behaviors, bannedPhrases: [...prev.behaviors.bannedPhrases, phrase] },
    }))
  }, [update])

  const removeBannedPhrase = useCallback((phrase) => {
    update((prev) => ({
      ...prev,
      behaviors: { ...prev.behaviors, bannedPhrases: prev.behaviors.bannedPhrases.filter((p) => p !== phrase) },
    }))
  }, [update])

  const setRawInstructions = useCallback((rawInstructions) => {
    update((prev) => ({ ...prev, behaviors: { ...prev.behaviors, rawInstructions } }))
  }, [update])

  const setEscalationRoute = useCallback((domainId, route) => {
    update((prev) => ({
      ...prev,
      behaviors: {
        ...prev.behaviors,
        escalationRoutes: { ...prev.behaviors.escalationRoutes, [domainId]: route },
      },
    }))
  }, [update])

  // ── Processes ──────────────────────────────────────────────────────────
  const addProcess = useCallback((process) => {
    update((prev) => ({
      ...prev,
      behaviors: { ...prev.behaviors, processes: [{ ...process }, ...prev.behaviors.processes] },
    }))
  }, [update])

  const setProcessStatus = useCallback((processId, status) => {
    update((prev) => ({
      ...prev,
      behaviors: {
        ...prev.behaviors,
        processes: prev.behaviors.processes.map((p) => p.id === processId ? { ...p, status } : p),
      },
    }))
  }, [update])

  const removeProcess = useCallback((processId) => {
    update((prev) => ({
      ...prev,
      behaviors: { ...prev.behaviors, processes: prev.behaviors.processes.filter((p) => p.id !== processId) },
    }))
  }, [update])

  // ── Packs ──────────────────────────────────────────────────────────────
  const installPack = useCallback((packId, answers = {}) => {
    const pack = PACKS_CATALOG.find((p) => p.id === packId)
    if (!pack) return
    update((prev) => applyPackInstall(prev, pack, answers))
  }, [update])

  const uninstallPack = useCallback((packId) => {
    const pack = PACKS_CATALOG.find((p) => p.id === packId)
    if (!pack) return
    update((prev) => applyPackUninstall(prev, pack))
  }, [update])

  // ── Setup health fixes ─────────────────────────────────────────────────
  /** Applies a one-click fix descriptor from deriveTuneChecks. */
  const applyTuneFix = useCallback((fix) => {
    if (!fix) return
    switch (fix.type) {
      case 'reconnect-source':  reconnectSource(fix.sourceId); break
      case 'set-tier':          setCapabilityTier(fix.sourceId, fix.capId, fix.tier); break
      case 'remove-term':       removeTerminology(fix.termId); break
      case 'set-route':         setEscalationRoute(fix.domainId, fix.route); break
      case 'set-policy':        setAnswerPolicy(fix.domainId, fix.policy); break
      case 'apply-suggestion':  applySuggestion(fix.suggestionId); break
      default: break
    }
  }, [reconnectSource, setCapabilityTier, removeTerminology, setEscalationRoute, setAnswerPolicy, applySuggestion])

  /** Two reset modes: 'demo' (full seeded data) or 'day0' (fresh tenant).
   * Write-through like every other mutation, so the live runtime follows. */
  const resetV2 = useCallback((mode = 'demo') => {
    clearV2Config(branchIdRef.current)
    const seeded = mode === 'day0' ? buildDay0Seed() : buildV2Seed()
    saveV2Config(seeded, branchIdRef.current)
    setConfigState(seeded)
    schedulePush()
  }, [schedulePush])

  return {
    config,
    update,
    connectIntranet,
    revealDueSuggestions,
    applySuggestion,
    dismissLiveMoment,
    setCapabilityTier,
    setIdentityMode,
    reconnectSource,
    approveProposal,
    dismissProposal,
    setAnswerPolicy,
    addTerminology,
    removeTerminology,
    setTonePreset,
    addBannedPhrase,
    removeBannedPhrase,
    setRawInstructions,
    setEscalationRoute,
    addProcess,
    setProcessStatus,
    removeProcess,
    installPack,
    uninstallPack,
    applyTuneFix,
    resetV2,
  }
}

/**
 * Canned "describe a process" generation — keeps the demo deterministic.
 * In the full build this is one LLM pass that drafts the state machine; the
 * admin only ever sees the plain-language step list below.
 */
export function generateProcessDraft(description) {
  const d = (description || '').toLowerCase()
  if (/travel|expense|claim|reise/.test(d)) {
    return {
      id: `proc-${Date.now().toString(36)}`,
      name: 'Travel claim', status: 'proposed', origin: 'described',
      justification: 'Requires manager approval + finance audit trail — a confirmation gate alone can’t guarantee the approval order.',
      steps: [
        { type: 'collect', label: 'Collect receipts, trip dates, and cost center' },
        { type: 'approve', label: 'Line manager approves the claim' },
        { type: 'submit',  label: 'Submit to Finance via Workday' },
        { type: 'confirm', label: 'Confirm to the employee with the payout date' },
      ],
    }
  }
  if (/onboard|new hire|first day/.test(d)) {
    return {
      id: `proc-${Date.now().toString(36)}`,
      name: 'New-hire equipment setup', status: 'proposed', origin: 'described',
      justification: 'Requires manager sign-off + asset audit trail before day one.',
      steps: [
        { type: 'collect', label: 'Collect start date, role, and equipment needs' },
        { type: 'approve', label: 'Hiring manager confirms the package' },
        { type: 'submit',  label: 'Order hardware and accounts via ServiceNow' },
        { type: 'confirm', label: 'Confirm readiness to manager and new hire' },
      ],
    }
  }
  // Generic 4-step fallback, named from the first few words.
  const name = (description || 'Untitled process').split(/\s+/).slice(0, 4).join(' ')
  return {
    id: `proc-${Date.now().toString(36)}`,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    status: 'proposed', origin: 'described',
    justification: 'Requires a human approval step + audit trail (detected from your description).',
    steps: [
      { type: 'collect', label: 'Collect the required details from the employee' },
      { type: 'approve', label: 'Responsible owner approves' },
      { type: 'submit',  label: 'Submit to the target system' },
      { type: 'confirm', label: 'Confirm the outcome to the employee' },
    ],
  }
}
