// Staffbase Onboarding Agent — A2A Protocol Server
//
// Context-aware: decodes the Bearer token to identify the new hire (email),
// optionally enriches the profile from the live Staffbase Directory (real
// title/department/avatar via lib/staffbase.mjs#findUserByEmail when
// STAFFBASE_API_TOKEN is set), then composes a stage-appropriate checklist
// that's personalised by department, office, manager, buddy, primary tools,
// and team Slack channels.
//
// GET  /api/a2a          → Agent Card (discovery)
// POST /api/a2a          → JSON-RPC 2.0
//   tasks/send           → synchronous: return full checklist
//   tasks/sendSubscribe  → streaming SSE: stream tasks one by one

import { findUserByEmail } from '../lib/staffbase.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Fictional Staffbase team fixture ─────────────────────────────────────────
// Rich profiles per known email. The agent layers REAL Staffbase API data on
// top (when STAFFBASE_API_TOKEN is set) — title, department, avatar come from
// the live directory if available, but `manager`, `buddy`, `slackChannels`,
// `primaryTools` always come from this fixture (or department-derived
// defaults) since the prototype doesn't have a real org-graph lookup.
const STAFFBASE_TEAM_FIXTURE = {
  'zee@staffbase.com': {
    name: 'Zee Sherif', department: 'Product', office: 'NYC', title: 'Senior Product Manager',
    manager: { name: 'Lina Marek',   title: 'VP Product',                slack: '@lina'   },
    buddy:   { name: 'Yuki Tanaka',  title: 'Product Manager II',        slack: '@yuki'   },
  },
  'mira@staffbase.com': {
    name: 'Mira Okafor', department: 'Engineering', office: 'Chemnitz HQ', title: 'Software Engineer',
    manager: { name: 'Dan Reichelt', title: 'Engineering Manager',       slack: '@danr'   },
    buddy:   { name: 'Priya Shah',   title: 'Senior Software Engineer',  slack: '@priya'  },
  },
  'jonas@staffbase.com': {
    name: 'Jonas Becker', department: 'Design', office: 'Berlin', title: 'Product Designer',
    manager: { name: 'Eva Lindgren', title: 'Design Director',           slack: '@eva'    },
    buddy:   { name: 'Marcus Chen',  title: 'Senior Product Designer',   slack: '@marcus' },
  },
  'sara@staffbase.com': {
    name: 'Sara Lindqvist', department: 'Customer Success', office: 'Cologne', title: 'Customer Success Manager',
    manager: { name: 'Olu Adeyemi',  title: 'Head of Customer Success',  slack: '@olu'    },
    buddy:   { name: 'Thomas Wagner',title: 'Senior CSM',                slack: '@thomas' },
  },
  'newhire@staffbase.com': {
    name: 'Robin Ortega', department: 'People', office: 'Chemnitz HQ', title: 'People Operations Specialist',
    manager: { name: 'Helena Krüger',title: 'Head of People Operations', slack: '@helena' },
    buddy:   { name: 'Felix Bauer',  title: 'People Partner',            slack: '@felix'  },
  },
};

// Department-derived defaults — used both as the fallback when an email isn't
// in the fixture AND to overlay primary tools / Slack channels (which the
// fixture above doesn't carry).
const DEPARTMENT_DEFAULTS = {
  Engineering: {
    primaryTools: ['GitHub', 'AWS', 'PagerDuty', 'Sentry', 'Linear'],
    slackChannels: ['#eng-all-hands', '#eng-onboarding', '#dev-platform', '#oncall'],
    firstWin: 'Open your first pull request — even a docs typo counts',
    qGoalHint: 'Ship 1 feature, complete 1 oncall rotation, contribute to 1 RFC',
  },
  Design: {
    primaryTools: ['Figma', 'FigJam', 'Notion', 'Maze', 'Loom'],
    slackChannels: ['#design-team', '#design-crit', '#design-system', '#research'],
    firstWin: 'Run your first design critique with the team',
    qGoalHint: 'Ship 2 features, run 1 critique session, contribute 3 design-system additions',
  },
  Product: {
    primaryTools: ['Linear', 'Productboard', 'Mixpanel', 'Maze', 'Notion'],
    slackChannels: ['#product-team', '#pm-craft', '#roadmap', '#customer-feedback'],
    firstWin: 'Talk to 3 customers + write your first PRD',
    qGoalHint: 'Ship 1 feature, run 5 customer interviews, draft 1 strategy doc',
  },
  Sales: {
    primaryTools: ['Salesforce', 'Outreach', 'Gong', 'LinkedIn Sales Nav'],
    slackChannels: ['#sales-team', '#pipeline', '#wins', '#sales-enablement'],
    firstWin: 'Shadow 3 demos + own your first discovery call',
    qGoalHint: 'Close $X pipeline, run 20 discovery calls, complete sales bootcamp',
  },
  'Customer Success': {
    primaryTools: ['Salesforce', 'Gainsight', 'Zendesk', 'Loom'],
    slackChannels: ['#cs-team', '#escalations', '#renewals', '#customer-wins'],
    firstWin: 'Shadow 3 customer reviews + co-host your first office hour',
    qGoalHint: 'Achieve 95% retention, run 10 EBRs, ship 1 customer playbook',
  },
  Marketing: {
    primaryTools: ['HubSpot', 'Brandfolder', 'Mailchimp', 'Webflow'],
    slackChannels: ['#marketing', '#content', '#brand-assets', '#campaigns'],
    firstWin: 'Publish your first piece of content',
    qGoalHint: 'Ship 2 campaigns, publish 4 articles, hit MQL target',
  },
  People: {
    primaryTools: ['Workday', 'Greenhouse', 'Lattice', 'Donut'],
    slackChannels: ['#people-team', '#new-hires', '#recruiting', '#culture'],
    firstWin: 'Run your first new-hire intro session',
    qGoalHint: 'Onboard X new hires, ship 1 People program, run 4 manager trainings',
  },
  Staffbase: {
    primaryTools: ['Campsite', 'Slack', 'Google Workspace'],
    slackChannels: ['#new-hires', '#all-staffbase', '#campsite-tips'],
    firstWin: 'Make 3 introductions across teams',
    qGoalHint: 'Ship 1 measurable outcome aligned to your manager\'s goals',
  },
};

const OFFICE_DETAILS = {
  'Chemnitz HQ': { city: 'Chemnitz',  pickupLocation: 'Chemnitz HQ reception (Annaberger Str. 73)', shipping: false, lunchSpot: 'the canteen on the 2nd floor' },
  'Berlin':       { city: 'Berlin',     pickupLocation: 'Berlin office (Schlesische Str. 27)',        shipping: false, lunchSpot: 'the rooftop kitchen'         },
  'Cologne':      { city: 'Cologne',    pickupLocation: 'Cologne office (Im Mediapark 8a)',           shipping: false, lunchSpot: 'the Mediapark cafe'          },
  'NYC':          { city: 'New York',   pickupLocation: 'NYC office (SoHo, 75 Broad St)',             shipping: false, lunchSpot: 'a coffee chat near the office'},
  'Remote':       { city: 'remote',     pickupLocation: 'tracked DHL delivery to your home address',  shipping: true,  lunchSpot: 'a virtual coffee chat'       },
};
function officeDetails(office) {
  return OFFICE_DETAILS[office] || OFFICE_DETAILS['Remote'];
}

function inferDepartment(email) {
  const local = (email || '').split('@')[0].toLowerCase();
  if (/^(zee|zyad)/.test(local))                  return 'Product';
  if (/(eng|dev|sre|infra|^mira$)/.test(local))   return 'Engineering';
  if (/(des|design|ux|ui|^jonas$)/.test(local))   return 'Design';
  if (/(marketing|mkt|growth|comms)/.test(local)) return 'Marketing';
  if (/(sales|ae|account)/.test(local))           return 'Sales';
  if (/(cs|success|support|^sara$)/.test(local))  return 'Customer Success';
  if (/(people|hr|recruit|^newhire$|^robin$)/.test(local)) return 'People';
  return 'Staffbase';
}

function prettyName(email) {
  const local = (email || '').split('@')[0];
  if (!local) return 'New Joiner';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

// Resolve the rich user context. Layers:
//   1. Email parsed from the Bearer token.
//   2. Fixture lookup by email (rich fictional Staffbase team).
//   3. Best-effort real Staffbase API enrichment (overrides title/department/
//      avatar when present).
//   4. Department defaults for primaryTools/slackChannels/firstWin/qGoalHint.
async function getUserContext(token) {
  let email = 'newhire@staffbase.com';
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    email = decoded.split(':')[0] || email;
  } catch { /* keep default */ }

  const fixture = STAFFBASE_TEAM_FIXTURE[email] || null;
  const baseName = fixture?.name || prettyName(email);
  const baseDepartment = fixture?.department || inferDepartment(email);
  const baseTitle = fixture?.title || `${baseDepartment} new hire`;
  const baseOffice = fixture?.office || 'Chemnitz HQ';

  // Best-effort real lookup (no-op when token not set).
  let real = null;
  try { real = await findUserByEmail(email); } catch { real = null; }

  const department = real?.department || baseDepartment;
  const deptDefaults = DEPARTMENT_DEFAULTS[department] || DEPARTMENT_DEFAULTS.Staffbase;

  return {
    email,
    name: real?.displayName || baseName,
    title: real?.title || baseTitle,
    department,
    office: baseOffice,
    avatarUrl: real?.avatar || null,
    manager: fixture?.manager || { name: 'your manager',  title: 'Manager',         slack: '@manager' },
    buddy:   fixture?.buddy   || { name: 'your buddy',    title: 'Onboarding Buddy',slack: '@buddy'   },
    primaryTools: deptDefaults.primaryTools,
    slackChannels: deptDefaults.slackChannels,
    firstWin: deptDefaults.firstWin,
    qGoalHint: deptDefaults.qGoalHint,
    realProfileLoaded: !!real,
  };
}

// ── Intent + stage detection ─────────────────────────────────────────────────

function isCompleteStageSubmission(text) {
  const t = (text || '').toLowerCase();
  if (/all .* tasks complete|all tasks complete/.test(t)) return true;
  if (/(submit|finish|complete|mark|sign[- ]?off) (the )?(my )?(day one|first week|first month|onboarding|stage|checklist)/.test(t)) return true;
  if (/i'?m done with (my )?(onboarding|checklist|day one|first week|first month)/.test(t)) return true;
  return false;
}

function detectStage(text, daysSinceHire) {
  const t = (text || '').toLowerCase();
  if (/first month|month one|30 days|month 1|q-?goals|benefits enrollment/.test(t)) return 'first_month';
  if (/first week|week one|second week|week 1|standup|sprint review|onboarding playlist/.test(t)) return 'first_week';
  if (/day one|first day|day 1|today|laptop|macbook|first day at staffbase/.test(t)) return 'day_one';
  const days = Number.isFinite(daysSinceHire) ? daysSinceHire : 0;
  if (days <= 1)  return 'day_one';
  if (days <= 7)  return 'first_week';
  return 'first_month';
}

function getClientDaysSinceHire(params) {
  const n = params?.metadata?.daysSinceHire;
  return Number.isFinite(n) ? n : 0;
}

const STAGE_LABELS = { day_one: 'Day One', first_week: 'First Week', first_month: 'First Month' };
const STAGE_EMOJI  = { day_one: '🚀',       first_week: '📅',          first_month: '🌱'         };

// ── Personalised checklist builder ───────────────────────────────────────────
//
// Each stage starts from a base template list, layered with department-
// specific extras and office-aware substitutions. Task text supports
// placeholders rendered against the user context:
//   {office.pickupLocation}, {manager.name}, {buddy.name}, {primaryTools[0]},
//   {slackChannels[0..]} (joined with ", "), {department}, {firstWin}, etc.

function render(template, ctx) {
  if (typeof template !== 'string') return template;
  return template
    .replace(/\{office\.pickupLocation\}/g, ctx._office.pickupLocation)
    .replace(/\{office\.lunchSpot\}/g, ctx._office.lunchSpot)
    .replace(/\{office\.city\}/g, ctx._office.city)
    .replace(/\{manager\.name\}/g, ctx.manager.name)
    .replace(/\{manager\.title\}/g, ctx.manager.title || 'Manager')
    .replace(/\{manager\.slack\}/g, ctx.manager.slack)
    .replace(/\{buddy\.name\}/g, ctx.buddy.name)
    .replace(/\{buddy\.title\}/g, ctx.buddy.title || 'Buddy')
    .replace(/\{buddy\.slack\}/g, ctx.buddy.slack)
    .replace(/\{department\}/g, ctx.department)
    .replace(/\{firstWin\}/g, ctx.firstWin)
    .replace(/\{qGoalHint\}/g, ctx.qGoalHint)
    .replace(/\{primaryTools\[0\]\}/g, ctx.primaryTools[0] || 'your primary tool')
    .replace(/\{primaryTools\.join\}/g, ctx.primaryTools.slice(0, 3).join(', '))
    .replace(/\{slackChannels\.join\}/g, ctx.slackChannels.slice(0, 3).join(', '))
    .replace(/\{name\.first\}/g, (ctx.name || '').split(' ')[0] || 'there')
    .replace(/\{email\}/g, ctx.email || '')
    .replace(/\{managerTitle\}/g, ctx.manager.title || 'Manager');
}

function buildPersonalisedTasks(stage, ctx) {
  const _office = officeDetails(ctx.office);
  const enrich = { ...ctx, _office };

  const dayOneBase = [
    { title: render('Pick up your MacBook', enrich),
      desc:  render(_office.shipping
        ? 'Track your MacBook via {office.pickupLocation}. IT shipped it ahead of your start date.'
        : 'Pick up at {office.pickupLocation}. Your badge will be ready at the same desk.', enrich),
      photo: true, critical: true },
    { title: 'Sign in to Google Workspace & Slack',
      desc:  render('Use your {email} identity. SAML SSO will sign you in to Campsite, Confluence, and Jira automatically.', { ...enrich, email: ctx.email }),
      photo: false, critical: true },
    { title: 'Complete your HR profile in Campsite',
      desc:  'Emergency contact, address, banking info, T-shirt size, and your photo (your buddy will help take a good one).',
      photo: false, critical: true },
    { title: 'Read the Staffbase mission & values',
      desc:  'Pinned on Campsite under "Welcome to Staffbase". 8-minute read.',
      photo: false, critical: false },
    { title: render('Lunch with {manager.name}', enrich),
      desc:  render('Calendar invite already sent — {manager.name} ({manager.slack}), {department} {manager.title}. Meet at {office.lunchSpot}.', enrich),
      photo: false, critical: false },
    { title: render('Say hi in {slackChannels.join}', enrich),
      desc:  render('Your {department} cohort is waiting. Tag {buddy.name} ({buddy.slack}), your onboarding buddy.', enrich),
      photo: false, critical: false },
  ];

  const firstWeekBase = [
    { title: render('Get access to {primaryTools[0]}', enrich),
      desc:  render('Open IT ticket if not auto-provisioned. Primary {department} tools: {primaryTools.join}.', enrich),
      photo: false, critical: true },
    { title: 'Complete the "Campsite Basics" playlist',
      desc:  'Posts, Channels, Spaces, Search, and Chat — ~45 min total in the Learning hub.',
      photo: false, critical: true },
    { title: render('Schedule 1:1 with {buddy.name}', enrich),
      desc:  render('Your onboarding buddy. 30-min weekly recurring. Ask anything — including dumb questions.', enrich),
      photo: false, critical: false },
    { title: 'Schedule 3 cross-functional 1:1s',
      desc:  render('Your buddy {buddy.name} will suggest names from {department} adjacencies.', enrich),
      photo: false, critical: false },
    { title: render('Your first win — {firstWin}', enrich),
      desc:  render('This is the unofficial "{department} bar" for week one. Low stakes, high signal.', enrich),
      photo: false, critical: false },
    { title: 'Attend the weekly all-hands',
      desc:  'Friday 4pm CET. Recording goes to Campsite if you miss it.',
      photo: false, critical: false },
  ];

  const firstMonthBase = [
    { title: 'Complete benefits enrollment',
      desc:  'Open enrollment closes day 30. Health, dental, pension, T-shirt size. Workday link in #people-announcements.',
      photo: false, critical: true },
    { title: render('Set Q-goals with {manager.name}', enrich),
      desc:  render('Lattice → Goals. Aim for 3 outcomes. {department} guidance: {qGoalHint}.', enrich),
      photo: false, critical: true },
    { title: 'Complete security & compliance training',
      desc:  'Mandatory — GDPR + ISO27001 + phishing simulation modules in the Learning hub.',
      photo: false, critical: true },
    { title: render('Introduce yourself at the next {department} all-hands', enrich),
      desc:  render('Your manager {manager.name} will queue you for the intro slot. 60-second intro.', enrich),
      photo: false, critical: false },
    { title: render('Attend your first {department} retro', enrich),
      desc:  render('Observe the team rhythm. Bring 1 question + 1 observation. {buddy.name} can pre-brief you.', enrich),
      photo: false, critical: false },
    { title: 'Submit 30-day feedback to People',
      desc:  'Form on Campsite under "Your First 30 Days at Staffbase". Confidential — read by People Ops only.',
      photo: false, critical: false },
  ];

  const base = { day_one: dayOneBase, first_week: firstWeekBase, first_month: firstMonthBase }[stage] || dayOneBase;
  return base.map((t) => ({ ...t, title: render(t.title, enrich), desc: render(t.desc, enrich) }));
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function buildAgentCard(baseUrl) {
  return {
    name: 'Staffbase Onboarding Agent',
    description: 'Context-aware onboarding agent for new Staffbase hires. Identifies the new joiner from their auth token, optionally enriches from the live Staffbase Directory, and streams a fully personalised checklist for their onboarding stage — Day One, First Week, or First Month — branched by department, office, manager, and primary tools.',
    url: `${baseUrl}/api/a2a`,
    version: '1.1.0',
    provider: { organization: 'Staffbase', url: baseUrl },
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: false },
    authentication: { schemes: ['Bearer'] },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text', 'data'],
    skills: [
      {
        id: 'get_onboarding_checklist',
        name: 'Get Onboarding Checklist',
        description: 'Returns the stage-appropriate, fully personalised onboarding checklist for the requesting new hire. Branches by department, office, manager name, onboarding buddy, primary tools, and team Slack channels.',
        tags: ['onboarding', 'new hire', 'first day', 'first week', 'first month', 'checklist', 'personalised'],
        examples: [
          'What should I do today? (Day One)',
          'Show me my first-week checklist',
          'What\'s left to finish before my first month is up?',
          'Start my Staffbase onboarding',
          'What\'s on my onboarding list this week?',
        ],
        inputModes: ['text'],
        outputModes: ['text', 'data'],
      },
    ],
  };
}

// ── Task status helpers ───────────────────────────────────────────────────────

function makeTaskStatus(state, label) {
  return {
    state,
    message: { role: 'agent', parts: [{ type: 'text', text: label }] },
  };
}

// ── Task enrichment ──────────────────────────────────────────────────────────

function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function deriveInputType(task) {
  if (task.photo) return 'photo';
  const t = (task.title + ' ' + (task.desc || '')).toLowerCase();
  if (/count|number of|first \d+ pr/.test(t)) return 'count';
  return 'check';
}

const INPUT_INSTRUCTIONS = {
  check: 'Render a checkbox row. User taps once to mark complete.',
  photo: 'Render a checkbox row plus a "📷 Capture photo" button. Both must be completed before marking done.',
  count: 'Render a checkbox row plus an inline number input. Capture the count before marking done.',
};

function enrichTasks(rawTasks) {
  const seen = new Set();
  return rawTasks.map((t, i) => {
    let id = slug(t.title) || `task-${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    const inputType = deriveInputType(t);
    return {
      id,
      title: t.title,
      desc: t.desc,
      photo: !!t.photo,
      critical: !!t.critical,
      inputType,
      uiInstruction: INPUT_INSTRUCTIONS[inputType],
    };
  });
}

// ── Streaming task loader ─────────────────────────────────────────────────────

async function runOnboardingTasks(userCtx, stage, onStep) {
  const delay = () => new Promise(r => setTimeout(r, 300));
  const tasks = enrichTasks(buildPersonalisedTasks(stage, userCtx));
  const total = tasks.length + 1;

  await onStep(1, total, `Loading ${STAGE_LABELS[stage]} onboarding checklist for ${userCtx.name} (${userCtx.department}) at ${userCtx.office}…`, {
    kind: 'context',
    instruction: `Render the Onboarding Checklist header for ${userCtx.name} — ${userCtx.department}, ${userCtx.office}, ${STAGE_LABELS[stage]}. ${tasks.length} tasks, ${tasks.filter(t => t.critical).length} critical. Manager: ${userCtx.manager.name}. Buddy: ${userCtx.buddy.name}.`,
  });

  for (let i = 0; i < tasks.length; i++) {
    await delay();
    const t = tasks[i];
    const flags = [t.critical ? '⚠ Required' : null, t.photo ? '📷 Photo needed' : null].filter(Boolean).join(' · ');
    await onStep(i + 2, total, `${t.title}${flags ? ` — ${flags}` : ''}`, {
      kind: 'task',
      taskId: t.id,
      inputType: t.inputType,
      critical: t.critical,
      awaitsInput: t.inputType !== 'check',
      instruction: t.uiInstruction,
    });
  }

  return tasks;
}

function buildArtifact(userCtx, stage, tasks) {
  const critical = tasks.filter(t => t.critical).length;
  const photos = tasks.filter(t => t.photo).length;
  const counts = tasks.filter(t => t.inputType === 'count').length;
  return [{
    name: `${STAGE_EMOJI[stage]} ${STAGE_LABELS[stage]} Onboarding Checklist`,
    description: `${tasks.length} tasks for ${userCtx.name} — ${userCtx.department}, ${userCtx.office}`,
    parts: [{
      type: 'data',
      data: {
        user: {
          email: userCtx.email, name: userCtx.name, department: userCtx.department,
          title: userCtx.title, office: userCtx.office, avatarUrl: userCtx.avatarUrl,
        },
        team: {
          manager: userCtx.manager,
          buddy: userCtx.buddy,
          primaryTools: userCtx.primaryTools,
          slackChannels: userCtx.slackChannels,
        },
        stage,
        tasks,
        summary: { total: tasks.length, critical, photos, counts },
        directives: {
          render: 'interactive_checklist',
          completionPolicy: 'user_confirms_each_task',
          submitWhen: 'all_critical_tasks_complete',
          submitLabel: `Mark ${STAGE_LABELS[stage]} as complete`,
          submitPrompt: `All ${STAGE_LABELS[stage]} tasks complete — submit progress for ${userCtx.name}`,
        },
        provenance: {
          realProfileLoaded: userCtx.realProfileLoaded,
          source: userCtx.realProfileLoaded ? 'staffbase_directory+fixture' : 'fixture',
        },
        generatedAt: new Date().toISOString(),
      },
    }],
  }];
}

// ── tasks/send (synchronous) ──────────────────────────────────────────────────

async function handleTaskSend(params, token) {
  const taskId = params.id || `task-${Date.now()}`;
  const text = params.message?.parts?.find(p => p.type === 'text')?.text || '';
  const userCtx = await getUserContext(token);
  const days = getClientDaysSinceHire(params);
  const stage = detectStage(text, days);
  if (isCompleteStageSubmission(text)) {
    return {
      id: taskId,
      status: makeTaskStatus('completed', `${STAGE_LABELS[stage]} stage marked complete for ${userCtx.name}.`),
      artifacts: buildCompletionReceipt(userCtx, stage, params?.metadata?.clientTime),
      metadata: { kind: 'stage_completion_receipt', user: userCtx, stage },
      final: true,
    };
  }
  const tasks = await runOnboardingTasks(userCtx, stage, () => {});
  const summary = `${STAGE_EMOJI[stage]} ${tasks.length} ${STAGE_LABELS[stage]} tasks loaded for ${userCtx.name} (${userCtx.department}).`;

  return {
    id: taskId,
    status: makeTaskStatus('completed', summary),
    artifacts: buildArtifact(userCtx, stage, tasks),
    metadata: { user: userCtx, stage, taskCount: tasks.length },
    final: true,
  };
}

// ── tasks/sendSubscribe (streaming SSE) ──────────────────────────────────────

function buildCompletionReceipt(userCtx, stage, clientIso) {
  const generatedAt = clientIso || new Date().toISOString();
  return [{
    name: `✅ ${STAGE_LABELS[stage]} — Stage Complete`,
    description: `Onboarding stage acknowledged for ${userCtx.name} (${userCtx.department})`,
    parts: [{
      type: 'data',
      data: {
        kind: 'stage_completion_receipt',
        user: { email: userCtx.email, name: userCtx.name, department: userCtx.department, title: userCtx.title },
        office: userCtx.office,
        stage,
        generatedAt,
        receiptId: `OBD-${Date.now().toString(36).toUpperCase()}`,
        message: `Welcome to Staffbase, ${(userCtx.name || '').split(' ')[0] || 'there'}! ${STAGE_LABELS[stage]} marked complete. ${userCtx.manager.name} will be notified.`,
      },
    }],
  }];
}

async function handleTaskSubscribe(params, token, rpcId, res) {
  const taskId = params.id || `task-${Date.now()}`;
  const text = params.message?.parts?.find(p => p.type === 'text')?.text || '';
  const userCtx = await getUserContext(token);
  const days = getClientDaysSinceHire(params);
  const stage = detectStage(text, days);

  const sendEvent = (taskStatus, extra = {}) => {
    res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: rpcId, result: { id: taskId, status: taskStatus, ...extra } })}\n\n`);
  };

  if (isCompleteStageSubmission(text)) {
    sendEvent(makeTaskStatus('working', `Marking ${STAGE_LABELS[stage]} as complete for ${userCtx.name}…`),
      { metadata: { step: 1, totalSteps: 2, directive: { kind: 'stage_completion_ack', instruction: 'Render a stage-completion-receipt card.' } } });
    const summary = `✅ ${STAGE_LABELS[stage]} stage marked complete for ${userCtx.name}.`;
    res.write(`data: ${JSON.stringify({
      jsonrpc: '2.0', id: rpcId,
      result: {
        id: taskId,
        status: makeTaskStatus('completed', summary),
        artifacts: buildCompletionReceipt(userCtx, stage, params?.metadata?.clientTime),
        metadata: { step: 2, totalSteps: 2, kind: 'stage_completion_receipt', user: userCtx, stage },
        final: true,
      },
    })}\n\n`);
    res.end();
    return;
  }

  sendEvent(makeTaskStatus('working', `Identifying onboarding stage for ${userCtx.name}…`));

  const tasks = await runOnboardingTasks(userCtx, stage, (step, total, label, directive) => {
    sendEvent(makeTaskStatus('working', label), { metadata: { step, totalSteps: total, directive } });
  });

  const summary = `${STAGE_EMOJI[stage]} ${tasks.length} ${STAGE_LABELS[stage]} tasks ready for ${userCtx.name} (${userCtx.department}).`;
  res.write(`data: ${JSON.stringify({
    jsonrpc: '2.0', id: rpcId,
    result: {
      id: taskId,
      status: makeTaskStatus('completed', summary),
      artifacts: buildArtifact(userCtx, stage, tasks),
      metadata: { step: tasks.length + 1, totalSteps: tasks.length + 1, user: userCtx, stage },
      final: true,
    },
  })}\n\n`);
  res.end();
}

// ── Vercel handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${req.headers.host}`;

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(buildAgentCard(baseUrl));
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { id: rpcId, method, params } = req.body || {};
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (params?.metadata?.token || Buffer.from(`newhire@staffbase.com:${Date.now()}`).toString('base64'));

  try {
    if (method === 'tasks/send') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ jsonrpc: '2.0', id: rpcId, result: await handleTaskSend(params || {}, token) });
    } else if (method === 'tasks/sendSubscribe') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      await handleTaskSubscribe(params || {}, token, rpcId, res);
    } else {
      res.status(400).json({ jsonrpc: '2.0', id: rpcId, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (err) {
    if (!res.writableEnded) res.status(500).json({ jsonrpc: '2.0', id: rpcId, error: { code: -32000, message: err.message } });
  }
}
