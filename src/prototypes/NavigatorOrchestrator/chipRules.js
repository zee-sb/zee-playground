// Shared chip rules — single source for both the Employee chat launchpad and
// Studio's "Audience preview" right rail. Keep all role/time/capability logic
// here so the two surfaces never drift.

export const INITIAL_CHIPS = [
  { label: "PTO balance",         full: "What's my PTO balance?" },
  { label: "Open IT tickets",     full: "Do I have open IT tickets?" },
  { label: "Benefits & perks",    full: "What are the company benefits?" },
  { label: "Remote work policy",  full: "What's the remote work policy?" },
  { label: "Request GitHub",      full: "Request access to GitHub" },
  { label: "Who's my manager?",   full: "Who is my manager?" },
  { label: "Onboarding checklist",full: "What should I do today? (Onboarding)" },
];

// Onboarding-stage chips — only render if the Staffbase Onboarding Agent is
// connected. The chat detects stage automatically (see api/a2a.mjs:detectStage).
export const ONBOARDING_CHIPS = {
  day_one:     { label: 'Day One checklist',     full: 'What should I do on my first day at Staffbase?',  requires: ['staffbase_onboarding_agent'], kind: 'onboarding' },
  first_week:  { label: 'First Week checklist',  full: "What's on my first-week onboarding list?",         requires: ['staffbase_onboarding_agent'], kind: 'onboarding' },
  first_month: { label: 'First Month checklist', full: 'What do I need to finish in my first month?',       requires: ['staffbase_onboarding_agent'], kind: 'onboarding' },
};

export const COMMON_CHIPS = {
  pto_balance:        { label: 'PTO balance',         full: "What's my PTO balance?",                            requires: ['hr_portal'] },
  open_tickets:       { label: 'Open IT tickets',     full: 'Do I have any open IT tickets?',                    requires: ['it_helpdesk'] },
  team_org:           { label: 'Team org chart',      full: 'Show me the team org chart',                        requires: ['hr_portal'] },
  request_access:     { label: 'Request access',      full: 'Request access to the reporting dashboard',         requires: ['it_helpdesk'] },
  benefits:           { label: 'Benefits & perks',    full: 'What are the company benefits?',                    requires: ['hr_portal'] },
  remote_policy:      { label: 'Remote work policy',  full: "What's the remote work policy?",                    requires: ['hr_portal'] },
  request_github:     { label: 'Request GitHub',      full: 'Request access to GitHub',                          requires: ['it_helpdesk'] },
  macbook_pickup:     { label: 'MacBook pickup',      full: 'Where do I pick up my MacBook?',                    requires: ['staffbase_onboarding_agent'] },
  benefits_enroll:    { label: 'Benefits enrollment', full: 'How do I enroll in benefits?',                      requires: ['hr_portal'] },
  // Campsite intranet chips — vary the message so it doesn't feel canned.
  latest_leadership:  { label: 'Latest from ELT',     full: 'Show me the latest leadership post on Campsite',     requires: ['intranet'] },
  q_priorities:       { label: 'Quarter priorities',  full: 'What are this quarter\'s priorities from the ELT?',  requires: ['intranet'] },
  whats_new:          { label: "What's new",          full: "What's new on Campsite this week?",                  requires: ['intranet'] },
  team_wiki:          { label: 'My team wiki',        full: 'Open my team space on Campsite',                     requires: ['intranet'] },
};

// Per-group follow-up chip ordering. Groups come from the live Staffbase
// directory (workspace_blueprints.orgSignals). The keys here match common
// Staffbase department names; missing groups fall back to the generic
// `_default` set.
export const GROUP_FOLLOWUPS = {
  Engineering:        ['request_github', 'open_tickets', 'pto_balance', 'whats_new'],
  Design:             ['request_access', 'pto_balance', 'benefits', 'whats_new'],
  Product:            ['team_org', 'q_priorities', 'pto_balance', 'whats_new'],
  Marketing:          ['latest_leadership', 'pto_balance', 'team_org', 'whats_new'],
  Sales:              ['team_org', 'pto_balance', 'request_access', 'q_priorities'],
  'Customer Success': ['team_org', 'pto_balance', 'open_tickets', 'whats_new'],
  People:             ['benefits_enroll', 'team_org', 'pto_balance', 'latest_leadership'],
  _default:           ['pto_balance', 'benefits', 'request_github', 'whats_new'],
};

// Compute which onboarding stage to lead with based on days-since-hire.
// 0..1 → Day One; 2..7 → First Week; 8+ → First Month.
export function onboardingStageFor(daysSinceHire) {
  if (!Number.isFinite(daysSinceHire)) return null;
  if (daysSinceHire <= 1)  return 'day_one';
  if (daysSinceHire <= 7)  return 'first_week';
  if (daysSinceHire <= 31) return 'first_month';
  return null; // past first month: drop the onboarding chip.
}

// Build the chips for the empty-state launchpad. Combines:
// - group (which followups make sense)
// - onboarding stage (which checklist chip leads, if any)
// - available capabilities (drop chips routing to nothing)
// - active flows (suggested workflows appear as a separate group)
export function pickRoleChips({ role, group, daysSinceHire, capabilities, flows = [], now = new Date() }) {
  const day = now.getDay();
  const hour = now.getHours();
  const has = (id) => !id || capabilities.has(id);
  const canUse = (chip) => (chip.requires || []).every(has);

  const out = [];

  // 1) Leading onboarding chip — only if the Staffbase Onboarding Agent is
  // connected AND we know the user is still in their first month.
  const stage = onboardingStageFor(daysSinceHire);
  if (stage) {
    const onboardingChip = ONBOARDING_CHIPS[stage];
    if (canUse(onboardingChip)) out.push(onboardingChip);
  }

  // 2) Group-specific followups, capability-filtered. Falls back to `_default`
  // when the user has no matched group, or the group has no curated list.
  const ids = GROUP_FOLLOWUPS[group] || GROUP_FOLLOWUPS[role] || GROUP_FOLLOWUPS._default;
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

  // 3) Flow chips — every active flow appears as a chip in its own group.
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

// ── Back-compat aliases ──────────────────────────────────────────────────────
// Legacy consumers reference SHIFT_CHIPS / ROLE_FOLLOWUPS / shiftPhaseFor.
// Keep no-op or remapped exports so imports don't break until those callers
// are migrated to the group-based model.
export const SHIFT_CHIPS = {};
export const ROLE_FOLLOWUPS = GROUP_FOLLOWUPS;
export function shiftPhaseFor() { return 'opening'; }
