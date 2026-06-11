import { useCallback, useEffect, useState } from 'react'

/**
 * useV2Store — state for the Navigator V2 target-concept prototypes
 * (NavigatorV2 Studio + NavigatorV2Chat).
 *
 * Follows the useConfigStore pattern: hydrate synchronously from
 * localStorage so the UI paints immediately, write through on every
 * mutation, cross-tab sync via the `storage` event.
 *
 * Server seam: `fetchServerV2` / `pushServerV2` are intentional no-op
 * stubs. When a `/api/navigator-v2-config` endpoint exists, implement the
 * two transports below and the rest of the hook works unchanged (the
 * background-fetch + debounced-push effects are already wired to them).
 */

export const V2_STORAGE_KEY = 'navigatorV2Config'
export const V2_VERSION = 4

// ── Server seam (intentionally inert) ───────────────────────────────────────
// GET  /api/navigator-v2-config?action=load   → { config, revision }
// POST /api/navigator-v2-config?action=save   ← { config, baseRevision }
async function fetchServerV2() { return null }
async function pushServerV2(_payload) { return null }

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

// ── Seed ─────────────────────────────────────────────────────────────────────

export function buildV2Seed() {
  return {
    version: V2_VERSION,

    // ── Sources & Actions — one card per SYSTEM, never per protocol ────────
    sources: [
      {
        id: 'staffbase', name: 'Staffbase Intranet', color: '#00C7B2',
        health: 'connected',
        identity: 'service', identityOptions: ['service'],
        engineRoom: 'engine room: native API · campsite.staffbase.com · content + directory scopes',
        capabilities: [
          { id: 'sb-answer',  label: 'Answer questions from news, pages & policies', write: false, tier: 'assist' },
          { id: 'sb-people',  label: 'Look up people in the directory',              write: false, tier: 'assist' },
          { id: 'sb-comment', label: 'Post a comment or reply on your behalf',       write: true,  tier: 'trigger' },
        ],
      },
      {
        id: 'sharepoint', name: 'SharePoint', color: '#0EA5E9',
        health: 'degraded',
        healthNote: 'Auth token expired 2h ago — retrieval paused. Employees are told: “I can’t verify SharePoint content right now.” No stale answers are served.',
        identity: 'employee', identityOptions: ['employee', 'service'],
        engineRoom: 'engine room: MCP · sharepoint-mcp v1.4 · Graph delegated scopes',
        capabilities: [
          { id: 'sp-search', label: 'Search policy & procedure documents', write: false, tier: 'assist' },
          { id: 'sp-meta',   label: 'Check document owner & freshness',    write: false, tier: 'assist' },
        ],
      },
      {
        id: 'workday', name: 'Workday', color: '#F59E0B',
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
      {
        id: 'servicenow', name: 'ServiceNow', color: '#10B981',
        health: 'connected',
        identity: 'employee', identityOptions: ['employee', 'service'],
        engineRoom: 'engine room: REST API · now-bridge v3 · ITSM + HRSD tables',
        capabilities: [
          { id: 'sn-status', label: 'Check the status of your tickets',          write: false, tier: 'assist' },
          { id: 'sn-create', label: 'Open an IT ticket on your behalf',          write: true,  tier: 'trigger' },
          { id: 'sn-reset',  label: 'Reset your password after verification',    write: true,  tier: 'execute' },
        ],
      },
      {
        id: 'personio', name: 'Personio', color: '#7C3AED',
        health: 'connected',
        identity: 'employee', identityOptions: ['employee'],
        engineRoom: 'engine room: MCP · personio-mcp v0.9 · read + absence scopes',
        capabilities: [
          { id: 'pe-contract', label: 'Look up your contract & tariff details', write: false, tier: 'assist' },
          { id: 'pe-bank',     label: 'Update your bank details',               write: true,  tier: 'trigger' },
        ],
      },
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
        legal:   { type: 'team',    target: 'Works Council Office' },
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

    // ── Packs ───────────────────────────────────────────────────────────────
    installedPacks: {}, // packId → { installedAt, answers, priorPolicies }

    escalations: [
      { id: 'esc-seed-1', topic: 'Works council agreement — remote work', to: 'HR Direct', via: 'chat', when: 'Tue 14:12', status: 'open' },
    ],
  }
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

// ── localStorage adapters ────────────────────────────────────────────────────

export function loadV2Config() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(V2_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== V2_VERSION) return null // hard cutover, prototype-only
    return parsed
  } catch {
    return null
  }
}

export function saveV2Config(config) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(config))
  } catch { /* quota / private mode — non-fatal for a demo */ }
}

export function clearV2Config() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(V2_STORAGE_KEY) } catch { /* noop */ }
}

/**
 * Called by the V2 chat when a question gets routed to a human, so the
 * escalation shows up in the Studio question log (the loop closing in both
 * directions is the demo's point). Works without the Studio being open.
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

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useV2Store() {
  const [config, setConfigState] = useState(() => {
    const loaded = loadV2Config()
    if (loaded) return loaded
    const seeded = buildV2Seed()
    saveV2Config(seeded)
    return seeded
  })

  // Write-through persistence.
  useEffect(() => { saveV2Config(config) }, [config])

  // Cross-tab sync (Studio + Chat open side by side).
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onStorage(e) {
      if (e.key !== V2_STORAGE_KEY) return
      const next = loadV2Config()
      if (next) setConfigState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Server seam: background fetch on mount + debounced push on change.
  // Both transports are no-op stubs today (see top of file).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const payload = await fetchServerV2().catch(() => null)
      if (!cancelled && payload?.config) setConfigState(payload.config)
    })()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const t = setTimeout(() => { pushServerV2({ config }) }, 400)
    return () => clearTimeout(t)
  }, [config])

  const update = useCallback((updater) => {
    setConfigState((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

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
    update((prev) => {
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
            ...pack.contents.bundles.map((b) => ({ ...b, fromPack: pack.id, origin: 'pack' })),
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
          [packId]: { installedAt: Date.now(), answers, priorPolicies },
        },
      }
    })
  }, [update])

  const uninstallPack = useCallback((packId) => {
    const pack = PACKS_CATALOG.find((p) => p.id === packId)
    if (!pack) return
    update((prev) => {
      const record = prev.installedPacks[packId]
      const nextPolicies = { ...prev.behaviors.answerPolicies }
      const nextOrigins = { ...prev.behaviors.policyOrigins }
      if (record?.priorPolicies) {
        for (const [domain, prior] of Object.entries(record.priorPolicies)) {
          if (prior) nextPolicies[domain] = prior
          delete nextOrigins[domain]
        }
      }
      const nextInstalled = { ...prev.installedPacks }
      delete nextInstalled[packId]
      return {
        ...prev,
        behaviors: {
          ...prev.behaviors,
          answerPolicies: nextPolicies,
          policyOrigins: nextOrigins,
          bundles: prev.behaviors.bundles.filter((b) => b.fromPack !== packId),
          processes: prev.behaviors.processes.filter((p) => p.fromPack !== packId),
          terminology: prev.behaviors.terminology.filter((t) => t.fromPack !== packId),
        },
        installedPacks: nextInstalled,
      }
    })
  }, [update])

  const resetV2 = useCallback(() => {
    clearV2Config()
    const seeded = buildV2Seed()
    saveV2Config(seeded)
    setConfigState(seeded)
  }, [])

  return {
    config,
    update,
    setCapabilityTier,
    setIdentityMode,
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
