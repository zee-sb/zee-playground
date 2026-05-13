// Shared chip rules — single source for both the Employee chat launchpad and
// Studio's "Audience preview" right rail. Keep all role/time/capability logic
// here so the two surfaces never drift.

export const INITIAL_CHIPS = [
  { label: "PTO balance",        full: "What's my PTO balance?" },
  { label: "Open IT tickets",    full: "Do I have open IT tickets?" },
  { label: "Benefits & perks",   full: "What are the company benefits?" },
  { label: "Remote work policy", full: "What's the remote work policy?" },
  { label: "Request GitHub",     full: "Request access to GitHub" },
  { label: "Who's my manager?",  full: "Who is my manager?" },
  { label: "My opening tasks",   full: "What are my opening tasks for today?" },
];

export const SHIFT_CHIPS = {
  opening:  { label: 'My opening tasks',  full: 'What are my opening tasks for today?',  requires: ['store_ops_agent'], kind: 'shift' },
  midshift: { label: 'Mid-shift tasks',   full: "What's on my mid-shift list?",           requires: ['store_ops_agent'], kind: 'shift' },
  closing:  { label: 'My closing tasks',  full: 'What are my closing tasks for tonight?', requires: ['store_ops_agent'], kind: 'shift' },
};

export const COMMON_CHIPS = {
  pto_balance:        { label: 'PTO balance',         full: "What's my PTO balance?",                            requires: ['hr_portal'] },
  open_tickets:       { label: 'Open IT tickets',     full: 'Do I have any open IT tickets?',                    requires: ['it_helpdesk'] },
  food_safety:        { label: 'Food safety policy',  full: "What's the food safety policy?",                    requires: ['hr_portal'] },
  team_attendance:    { label: 'Team attendance',     full: 'Who is on shift today and who is absent?',          requires: ['hr_portal'] },
  team_org:           { label: 'Team org chart',      full: 'Show me the team org chart',                        requires: ['hr_portal'] },
  request_access:     { label: 'Request access',      full: 'Request access to the reporting dashboard',         requires: ['it_helpdesk'] },
  supply_request:     { label: 'Supply request',      full: 'I need to submit a cleaning supplies request',      requires: ['it_helpdesk'] },
  safety_policy:      { label: 'Safety policy',       full: "What's the workplace health and safety policy?",    requires: ['hr_portal'] },
  report_equipment:   { label: 'Report equipment',    full: 'I need to report a fryer equipment issue',          requires: ['it_helpdesk'] },
  benefits:           { label: 'Benefits & perks',    full: 'What are the company benefits?',                    requires: ['hr_portal'] },
  remote_policy:      { label: 'Remote work policy',  full: "What's the remote work policy?",                    requires: ['hr_portal'] },
  request_github:     { label: 'Request GitHub',      full: 'Request access to GitHub',                          requires: ['it_helpdesk'] },
  // Intranet chips — vary the message per day of week so it doesn't feel canned.
  latest_leadership:  { label: 'Latest leadership',   full: 'Show me the latest leadership post',                requires: ['intranet'] },
  q2_priorities:      { label: 'Q2 priorities',       full: 'What are the Q2 priorities from the CEO?',          requires: ['intranet'] },
  whats_new:          { label: "What's new",          full: "What's new on the company intranet this week?",      requires: ['intranet'] },
  team_wiki:          { label: 'My team wiki',        full: 'Open my team wiki',                                  requires: ['intranet'] },
};

// Per-role follow-up chip ordering. Office Worker is the HQ persona — no shift
// chips, leans on PTO, benefits, intranet, and access requests.
export const ROLE_FOLLOWUPS = {
  'Branch Manager':   ['team_attendance', 'pto_balance', 'open_tickets',      'whats_new'],
  'Line Cook':        ['food_safety',     'report_equipment', 'pto_balance',  'latest_leadership'],
  'Shift Supervisor': ['team_org',        'request_access',   'pto_balance',  'whats_new'],
  'Cleaning Staff':   ['safety_policy',   'supply_request',   'pto_balance',  'latest_leadership'],
  'Office Worker':    ['pto_balance',     'benefits',         'request_github', 'whats_new'],
};

export function shiftPhaseFor(now = new Date()) {
  const h = now.getHours();
  if (h >= 18 || h < 5) return 'closing';
  if (h >= 12) return 'midshift';
  return 'opening';
}

// Build the chips for the empty-state launchpad. Combines:
// - role (which followups make sense)
// - time of day (which shift phase chip leads)
// - available capabilities (drop chips routing to nothing)
// - day of week (swap one chip on Mon/Tue mornings)
// - active flows (suggested workflows appear as a separate group)
export function pickRoleChips({ role, capabilities, flows = [], now = new Date() }) {
  const phase = shiftPhaseFor(now);
  const day = now.getDay();           // 0 Sun … 6 Sat
  const hour = now.getHours();
  const has = (id) => !id || capabilities.has(id);
  const canUse = (chip) => (chip.requires || []).every(has);

  const out = [];
  // 1) leading shift chip — only if Store Ops is connected.
  const shiftChip = SHIFT_CHIPS[phase];
  if (canUse(shiftChip)) out.push(shiftChip);

  // 2) role-specific followups, capability-filtered, deduped. Cap this group
  // at ~4 chips so flow chips below stay visible.
  const ids = ROLE_FOLLOWUPS[role] || ROLE_FOLLOWUPS['Branch Manager'];
  // Monday/Tuesday morning bias toward leadership news.
  const biased = (day === 1 || day === 2) && hour < 12 ? ['latest_leadership', ...ids] : ids;
  let roleAdded = 0;
  for (const id of biased) {
    const chip = COMMON_CHIPS[id];
    if (chip && canUse(chip) && !out.includes(chip)) {
      out.push(chip);
      roleAdded += 1;
    }
    if (roleAdded >= 4) break;
  }

  // 3) flow chips — every active flow appears as a chip in its own group
  // below the role chips, so we don't count them against the cap above.
  // Required-mode flows still render so the employee can opt in explicitly.
  for (const f of flows || []) {
    if (!f || f.status !== 'active') continue;
    out.push({
      label: f.name,
      full: f.trigger || f.name,
      kind: 'flow',
      flowId: f.id,
      mode: f.mode,
    });
  }

  return out;
}
