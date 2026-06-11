/**
 * Scripted demo engine for Navigator V2 — Employee Chat.
 *
 * Determinism over realism: each seeded question maps to a scripted
 * multi-part response (with typing/streaming delays handled by the runner
 * in NavigatorV2Chat.jsx). The suggested-question chips send these exact
 * strings, so demoing is foolproof. Unscripted input gets a graceful
 * generic fallback.
 *
 * Step shapes the runner understands:
 *   { delay, part }                         — append a message part
 *   { delay, part: { type:'progress' } }    — self-animating step narrative
 *   { effect: 'recordEscalation', payload } — side effect (Studio question log)
 * Part types are rendered by NavigatorV2Chat.jsx.
 */

export const PERSONAS = [
  {
    id: 'maria',
    name: 'Maria Santos',
    short: 'Maria — Cabin Crew, A320, Hamburg, tariff',
    avatar: 'MS', color: '#00A593',
    contractLine: 'cabin crew · A320 · Hamburg · tariff',
    contract: [
      { label: 'Role',     value: 'Cabin crew',                 source: 'Workday' },
      { label: 'Fleet',    value: 'A320 family',                source: 'Crew qualification (Staffbase profile)' },
      { label: 'Base',     value: 'Hamburg (HAM)',              source: 'Workday' },
      { label: 'Contract', value: 'Tariff (MTV Kabine)',        source: 'Personio' },
      { label: 'Language', value: 'English (Deutsch verfügbar)', source: 'App setting' },
    ],
    greeting: 'Hi Maria — ask me anything about work. I answer from connected sources with citations, and I always show you exactly what I’d do before doing it.',
    chips: [
      'Request next Friday off',
      'What’s the cabin crew de-icing check before departure?',
      'I’m pregnant — what leave am I entitled to and who do I tell?',
    ],
  },
  {
    id: 'jonas',
    name: 'Jonas Weber',
    short: 'Jonas — HR Partner, Berlin office',
    avatar: 'JW', color: '#7C3AED',
    contractLine: 'HR partner · Berlin office · full-time',
    contract: [
      { label: 'Role',     value: 'HR Partner',         source: 'Workday' },
      { label: 'Office',   value: 'Berlin',             source: 'Workday' },
      { label: 'Contract', value: 'Full-time, exempt',  source: 'Personio' },
      { label: 'Language', value: 'English',            source: 'App setting' },
    ],
    greeting: 'Hi Jonas — ask me anything about work. I answer from connected sources with citations, and I’m honest when I can’t verify something.',
    chips: [
      'What changed in the works council agreement on remote work?',
      'Where is the latest salary bands document?',
      'How do I order a laptop for a new intern?',
    ],
  },
]

// ── Continuations — run after the user approves / acts on a card ────────────

export const CONTINUATIONS = {
  'timeoff-approved': [
    { delay: 300, part: { type: 'progress', stepDelay: 900, steps: [
      { label: 'Submitting the request to Workday, acting as you' },
      { label: 'Workday accepted it — your manager is notified' },
    ] } },
    { delay: 400, part: { type: 'receipt', title: 'Leave request submitted', system: 'Workday', reference: 'WD-2026-48211',
      lines: [
        { label: 'Type', value: 'Vacation (tariff)' },
        { label: 'Date', value: 'Fri, 19 Jun 2026 · 1 day' },
        { label: 'Balance after', value: '11.5 days' },
        { label: 'Approver', value: 'D. Krüger (notified)' },
      ],
      undo: true,
    } },
    { delay: 500, part: { type: 'trust', trustKey: 'timeOffUnder3', label: 'Don’t ask again for time-off requests (under 3 days)' } },
    { delay: 200, part: { type: 'engineRoom', lines: [
      'intent: time_off.request (classifier, conf 0.97)',
      'bundle: cabin-crew-ham → policy: trigger (writes)',
      'tool: workday.submit_leave_request(date=2026-06-19, days=1)',
      'identity: employee JIT token · maria.santos@…',
    ] } },
  ],
  'parental-process-approved': [
    { delay: 300, part: { type: 'progress', stepDelay: 900, steps: [
      { label: 'Filing the notification in Workday' },
      { label: 'Notifying your HR partner (confidentially)' },
    ] } },
    { delay: 400, part: { type: 'receipt', title: 'Parental-leave notification filed', system: 'Workday', reference: 'PL-2026-0107',
      lines: [
        { label: 'Expected date', value: 'March 2027 (you can refine later)' },
        { label: 'HR partner', value: 'Notified — will contact you this week' },
        { label: 'Next step', value: 'Mutterschutz dates auto-calculated once confirmed' },
      ],
      undo: true,
    } },
    { delay: 400, part: { type: 'text', text: 'Nothing was shared with your manager or crew planning — only HR sees this until you decide otherwise.' } },
  ],
  'laptop-ticket-approved': [
    { delay: 300, part: { type: 'progress', stepDelay: 900, steps: [
      { label: 'Opening the ticket in ServiceNow, acting as you' },
      { label: 'Routing to IT procurement' },
    ] } },
    { delay: 400, part: { type: 'receipt', title: 'IT ticket created', system: 'ServiceNow', reference: 'SN-77412',
      lines: [
        { label: 'Item', value: 'Standard intern laptop (ThinkPad L14)' },
        { label: 'Cost center', value: '4711 — People (Berlin)' },
        { label: 'Expected delivery', value: '3–5 working days' },
      ],
      undo: true,
    } },
  ],
}

// ── Scripts ──────────────────────────────────────────────────────────────────

function timeOffScript(ctx) {
  // Trust ladder: after the employee opts in, identical requests are
  // auto-approved with a compact notice instead of the full preview.
  if (ctx.trust.timeOffUnder3) {
    return [
      { delay: 600, part: { type: 'autoApproved', text: 'Auto-approved under your rule “time-off requests under 3 days” — submitted to Workday, acting as you.' } },
      { delay: 700, part: { type: 'receipt', compact: true, title: 'Leave request submitted', system: 'Workday', reference: 'WD-2026-48306',
        lines: [
          { label: 'Date', value: 'Fri, 19 Jun 2026 · 1 day' },
          { label: 'Balance after', value: '10.5 days' },
        ],
        undo: true,
      } },
      { delay: 300, part: { type: 'reviewAutoApprovals' } },
    ]
  }
  return [
    { delay: 500, part: { type: 'progress', stepDelay: 1000, steps: [
      { label: 'Checked your leave balance — 12.5 days available' },
      { label: 'Checked the crew roster — no conflict on Friday' },
      { label: 'Drafting the request…' },
      { label: 'Waiting for your confirmation' },
    ] } },
    { delay: 400, part: { type: 'preview', continuation: 'timeoff-approved',
      system: 'Workday', title: 'Here’s exactly what I’ll submit to Workday, acting as you:',
      fields: [
        { label: 'Request type', value: 'Vacation (tariff)' },
        { label: 'Date', value: 'Friday, 19 Jun 2026', editable: true },
        { label: 'Duration', value: '1 day' },
        { label: 'Balance after', value: '11.5 of 12.5 days' },
        { label: 'Approver', value: 'D. Krüger (your duty manager)' },
      ],
    } },
  ]
}

const STRICT_SCRIPT = [
  { delay: 700, part: { type: 'policyBadge', label: 'Strict: cite-or-refuse', detail: 'Safety-critical domain — I quote the manual verbatim and never paraphrase.' } },
  { delay: 900, part: { type: 'quote',
    text: '“Prior to departure in icing conditions, cabin crew shall confirm with the senior cabin crew member that the de-icing/anti-icing procedure has been announced, secure the cabin for possible holdover-time re-treatment, and report any visible ice accretion on cabin window frames or wing upper surfaces to the flight crew immediately.”',
    source: 'A320 Cabin Crew Operations Manual, §4.2.1 “Winter Operations”',
  } },
  { delay: 500, part: { type: 'citations', items: [
    { source: 'SharePoint · Flight Ops corpus', title: 'A320 CCOM §4.2.1 — Winter Operations', freshness: 'updated 5 weeks ago' },
  ] } },
  { delay: 500, part: { type: 'text', text: 'That’s the verbatim procedure. I won’t summarize or rephrase safety content — if you need interpretation, the Flight Ops Duty Office is the escalation route for this domain.' } },
  { delay: 200, part: { type: 'engineRoom', lines: [
    'intent: procedure.lookup (classifier, conf 0.94)',
    'context filter: fleet=A320, role=cabin_crew',
    'policy: cite-or-refuse (domain: medical/flight-ops)',
    'retrieval: ACL-trimmed, 1 passage, verbatim mode',
  ] } },
]

const PREGNANCY_SCRIPT = [
  { delay: 700, part: { type: 'text', text: 'Congratulations, Maria. Here’s the full picture across HR, your roster, and IT — you don’t need to know which department owns what.' } },
  { delay: 900, part: { type: 'text', heading: 'Your leave entitlements', text: 'Under your tariff contract: Mutterschutz starts 6 weeks before the expected date (14 weeks total, fully paid). After that you can take up to 3 years of Elternzeit; Elterngeld covers 65–67% of net pay for up to 14 months shared. As cabin crew, you’ll also be moved to ground duties as soon as you notify — flying restrictions apply from day one of a declared pregnancy.' } },
  { delay: 500, part: { type: 'citations', items: [
    { source: 'Staffbase · HR Policy Hub', title: 'Parental leave & Mutterschutz (DE)', freshness: 'updated 3 weeks ago' },
    { source: 'Personio · your contract', title: 'MTV Kabine §18 — pregnancy & ground duty', freshness: 'updated 2 months ago' },
  ] } },
  { delay: 700, part: { type: 'text', heading: 'Who to tell', text: 'Only HR needs to know to start the clock — your HR partner handles the roster change confidentially. You don’t have to tell your crew or duty manager yourself.' } },
  { delay: 600, part: { type: 'text', heading: 'One IT step', text: 'Your crew tablet needs the ground-duty roster app once you switch — I can open that ServiceNow request when you’re ready.' } },
  { delay: 500, part: { type: 'offers', buttons: [
    { label: 'Start the parental-leave notification', send: 'Start the parental-leave notification' },
  ] } },
  { delay: 200, part: { type: 'engineRoom', lines: [
    'intent: multi_domain (hr.leave + roster + it.request)',
    'composed: hr-policy-hub + personio.contract + servicenow.catalog',
    'no expert boundary crossed — single Navigator, 3 sources',
  ] } },
]

const PARENTAL_PROCESS_SCRIPT = [
  { delay: 500, part: { type: 'progress', stepDelay: 1000, steps: [
    { label: 'Starting the “Parental-leave notification” process' },
    { label: 'Collecting what’s needed — just one field for now' },
    { label: 'Waiting for your confirmation' },
  ] } },
  { delay: 400, part: { type: 'preview', continuation: 'parental-process-approved',
    system: 'Workday', title: 'Here’s the notification I’ll file — HR only, nothing goes to your manager:',
    fields: [
      { label: 'Process', value: 'Parental-leave notification (auditable)' },
      { label: 'Expected date', value: 'March 2027 (estimate is fine)', editable: true },
      { label: 'Visibility', value: 'HR partner only' },
    ],
  } },
]

const WORKS_COUNCIL_SCRIPT = [
  { delay: 800, part: { type: 'text', text: 'I can’t verify this right now. Works-council matters are set to “deflect to human” — and the remote-work agreement was updated last week, so I won’t risk quoting a stale version.' } },
  { effect: 'recordEscalation', payload: { topic: 'Works council agreement — remote work', to: 'HR Direct' } },
  { delay: 700, part: { type: 'escalation', to: 'HR Direct', reference: 'HRD-3382', eta: '1 business day',
    text: 'I’ve routed your question to HR Direct with the context attached. You’ll get the answer here in chat.' } },
  { delay: 400, part: { type: 'note', text: 'This escalation is now visible in the Studio question log — repeated ones become a proposal for the admin.' } },
  { delay: 200, part: { type: 'engineRoom', lines: [
    'intent: policy.lookup (domain: legal/works-council)',
    'policy: deflect-to-human → escalation route: HR Direct (queue)',
    'question logged: cluster “Works council agreement — remote work”',
  ] } },
]

const SALARY_BANDS_SCRIPT = [
  { delay: 800, part: { type: 'text', text: 'I can’t reach SharePoint right now — its connection has been degraded since 09:40, and the salary bands document lives there. I’d rather tell you that than answer from a cached copy I can’t verify.' } },
  { delay: 600, part: { type: 'escalation', to: 'HR Direct', reference: 'HRD-3391', eta: '1 business day',
    text: 'I’ve routed your request to HR Direct — they can send the current document directly. I’ll also retry automatically once SharePoint is back.' } },
  { delay: 200, part: { type: 'engineRoom', lines: [
    'source health: sharepoint = degraded (token expired)',
    'runtime enforcement: retrieval blocked, no stale answer served',
    'fallback: escalation route (hr → HR Direct)',
  ] } },
]

const LAPTOP_SCRIPT = [
  { delay: 700, part: { type: 'text', text: 'Interns get the standard loaner package: a ThinkPad L14, charged to your department’s cost center, ordered through ServiceNow. Manager approval isn’t needed for the standard package — it’s pre-approved for HR-hosted interns.' } },
  { delay: 500, part: { type: 'citations', items: [
    { source: 'Staffbase · IT knowledge base', title: 'Equipment for interns & working students', freshness: 'updated 3 weeks ago' },
  ] } },
  { delay: 500, part: { type: 'offers', buttons: [
    { label: 'Order the intern laptop now', send: 'Order the intern laptop now' },
  ] } },
]

const LAPTOP_ORDER_SCRIPT = [
  { delay: 500, part: { type: 'progress', stepDelay: 900, steps: [
    { label: 'Pulling the standard intern package from ServiceNow' },
    { label: 'Pre-filling your cost center from Workday' },
    { label: 'Waiting for your confirmation' },
  ] } },
  { delay: 400, part: { type: 'preview', continuation: 'laptop-ticket-approved',
    system: 'ServiceNow', title: 'Here’s the ticket I’ll open in ServiceNow, acting as you:',
    fields: [
      { label: 'Item', value: 'Standard intern laptop (ThinkPad L14)' },
      { label: 'Cost center', value: '4711 — People (Berlin)', editable: true },
      { label: 'Needed by', value: 'Next Monday' },
    ],
  } },
]

// ── Matching ─────────────────────────────────────────────────────────────────

const SCRIPTS = [
  { id: 'timeoff',          keywords: ['friday off', 'request next friday', 'day off', 'time off', 'request leave'], persona: 'maria', run: timeOffScript },
  { id: 'strict',           keywords: ['de-icing', 'deicing', 'de icing', 'winter procedure'],                       persona: 'maria', steps: STRICT_SCRIPT },
  { id: 'pregnancy',        keywords: ['pregnant', 'pregnancy', 'schwanger'],                                        persona: 'maria', steps: PREGNANCY_SCRIPT },
  { id: 'parental-process', keywords: ['start the parental-leave notification', 'parental-leave notification'],      persona: 'maria', steps: PARENTAL_PROCESS_SCRIPT },
  { id: 'works-council',    keywords: ['works council', 'betriebsrat', 'betriebsvereinbarung'],                      persona: 'jonas', steps: WORKS_COUNCIL_SCRIPT },
  { id: 'salary-bands',     keywords: ['salary band', 'salary bands', 'compensation bands'],                         persona: 'jonas', steps: SALARY_BANDS_SCRIPT },
  { id: 'laptop',           keywords: ['laptop for a new intern', 'laptop for an intern', 'order a laptop'],         persona: 'jonas', steps: LAPTOP_SCRIPT },
  { id: 'laptop-order',     keywords: ['order the intern laptop now'],                                               persona: 'jonas', steps: LAPTOP_ORDER_SCRIPT },
]

export function matchScript(text, persona, ctx) {
  const q = (text || '').toLowerCase()
  for (const s of SCRIPTS) {
    if (s.keywords.some((k) => q.includes(k))) {
      // Scripts are persona-flavored but shouldn't dead-end if the demo
      // driver asks them as the other persona.
      return typeof s.run === 'function' ? s.run(ctx) : s.steps
    }
  }
  return null
}

export function fallbackScript(personaName) {
  return [
    { delay: 700, part: { type: 'text', text: `Good question — in this concept demo I only have a handful of scripted answers, so I’ll be honest instead of improvising. In the full build this routes through the orchestrator: classifier resolves the intent, your context (${personaName ? 'as shown in the chip below' : 'profile-derived'}) filters retrieval, and the answer comes back cited or escalated.` } },
    { delay: 400, part: { type: 'note', text: 'Try one of the suggested questions below — they show the whole loop.' } },
  ]
}
