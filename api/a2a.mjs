// Acme Store Operations Agent — A2A Protocol Server
//
// Context-aware: decodes the Bearer token to identify the user,
// then returns their role-specific shift checklist.
//
// GET  /api/a2a          → Agent Card (discovery)
// POST /api/a2a          → JSON-RPC 2.0
//   tasks/send           → synchronous: return full checklist
//   tasks/sendSubscribe  → streaming SSE: stream tasks one by one

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── User context (mirrors Navigator demo users) ───────────────────────────────

const USER_CONTEXT = {
  alice: { role: 'manager',    name: 'Alice Chen',  location: 'Acme Store — Downtown',        title: 'Branch Manager'   },
  bob:   { role: 'cook',       name: 'Bob Smith',   location: 'Acme Store — Airport Terminal', title: 'Line Cook'        },
  carol: { role: 'supervisor', name: 'Carol Davis', location: 'Acme Store — Downtown',         title: 'Shift Supervisor' },
  dave:  { role: 'cleaner',    name: 'Dave Wilson', location: 'Acme Store — Westfield Mall',   title: 'Cleaning Staff'   },
};

function getUserContext(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const emailPrefix = decoded.split(':')[0].split('@')[0].toLowerCase();
    return USER_CONTEXT[emailPrefix] ?? USER_CONTEXT.alice;
  } catch {
    return USER_CONTEXT.alice;
  }
}

// ── Shift phase detection ─────────────────────────────────────────────────────

function detectPhase(text) {
  const t = text.toLowerCase();
  if (/closing|close|end of day|night|evening/.test(t)) return 'closing';
  if (/mid[- ]?shift|midday|afternoon|lunch/.test(t)) return 'midshift';
  if (/opening|open|morning|start of day|first thing/.test(t)) return 'opening';
  // Default by server time
  const hour = new Date().getHours();
  if (hour >= 18) return 'closing';
  if (hour >= 12) return 'midshift';
  return 'opening';
}

const PHASE_LABELS = { opening: 'Opening', midshift: 'Mid-Shift', closing: 'Closing' };
const PHASE_EMOJI  = { opening: '🌅',      midshift: '☀️',         closing: '🌙'      };

// ── Store task data (matches FrontlineOps prototype) ─────────────────────────

const STORE_TASKS = {
  manager: {
    opening: [
      { title: 'Review overnight sales report',   desc: 'Check daily totals vs. target',              photo: false, critical: false },
      { title: 'Verify all staff are present',    desc: 'Cross-check schedule vs. clock-ins',         photo: false, critical: true  },
      { title: 'Inspect front-of-house area',     desc: 'Tables, floor, entrance — all clean?',       photo: true,  critical: false },
      { title: 'Check cold storage temperatures', desc: 'Fridge ≤4°C · Freezer ≤−18°C',              photo: true,  critical: true  },
      { title: 'Confirm cash register float',     desc: 'Match opening float to paper log',           photo: false, critical: false },
    ],
    midshift: [
      { title: 'Midday team check-in',            desc: 'Brief standup — performance vs. target',     photo: false, critical: false },
      { title: 'Review order queue & wait times', desc: 'Target: under 5 minutes average',            photo: false, critical: false },
      { title: 'Spot-check food quality',         desc: 'Sample from line for taste & presentation',  photo: false, critical: false },
      { title: 'Restock review',                  desc: 'Flag any shortages to supplier',             photo: false, critical: false },
    ],
    closing: [
      { title: 'Count end-of-day till',           desc: 'Reconcile with POS totals',                  photo: false, critical: true  },
      { title: 'Lock up & set alarm',             desc: 'Check all entry points are secured',         photo: true,  critical: true  },
      { title: 'Complete incident log',           desc: 'Note any issues from the shift',             photo: false, critical: false },
    ],
  },
  supervisor: {
    opening: [
      { title: 'Brief morning team',              desc: '5-min standup, share daily targets',         photo: false, critical: false },
      { title: 'Assign stations to staff',        desc: 'Match skills to busiest positions',          photo: false, critical: false },
      { title: 'Walk-the-line station check',     desc: 'All stations stocked before doors open?',   photo: true,  critical: true  },
      { title: 'Confirm food safety log complete',desc: 'Verify temps logged by cook',                photo: false, critical: true  },
    ],
    midshift: [
      { title: 'Monitor customer wait times',     desc: 'Flag if consistently over 5 min',           photo: false, critical: false },
      { title: 'Manage break schedule',           desc: 'No station left unmanned during breaks',     photo: false, critical: false },
      { title: 'Log any customer complaints',     desc: 'Record in the incident log',                photo: false, critical: false },
    ],
    closing: [
      { title: 'Sign off all task completions',   desc: 'Verify cleaner & cook closing tasks done',  photo: false, critical: true  },
      { title: 'Prepare shift handover report',   desc: 'Incidents, stock notes, team performance',  photo: false, critical: true  },
      { title: 'Lock POS terminals',              desc: 'Sign out all staff from registers',         photo: true,  critical: false },
    ],
  },
  cook: {
    opening: [
      { title: 'Sanitize all prep surfaces',      desc: 'Use approved food-safe solution',           photo: true,  critical: true  },
      { title: 'Check stock & date labels',       desc: 'FIFO rotation — discard expired items',     photo: false, critical: true  },
      { title: 'Preheat grills & fryers',         desc: 'Grill 180°C · Fryer 175°C',                photo: false, critical: false },
      { title: 'Set up morning prep station',     desc: 'Patties, buns, sauces ready at station',   photo: false, critical: false },
    ],
    midshift: [
      { title: 'Restock station from walk-in',    desc: 'Top up supplies before the lunch rush',     photo: false, critical: false },
      { title: 'Clean fryer baskets mid-shift',   desc: 'Remove buildup between service periods',    photo: true,  critical: false },
      { title: 'Log fryer temperatures',          desc: 'Record in paper log and app — required',    photo: false, critical: true  },
    ],
    closing: [
      { title: 'Deep clean grill surface',        desc: 'Scrape, degrease, re-season',               photo: true,  critical: true  },
      { title: 'Label & store all prepped food',  desc: 'Date/time label on every container',        photo: false, critical: true  },
      { title: 'Sanitize full prep area',         desc: 'Walls, floors, and all surfaces',           photo: true,  critical: true  },
      { title: 'Turn off all equipment safely',   desc: 'Fryers, grills, heat lamps, ventilation',   photo: false, critical: false },
    ],
  },
  cleaner: {
    opening: [
      { title: 'Mop all dining area floors',      desc: 'Bleach solution · post wet floor signs',   photo: true,  critical: false },
      { title: 'Clean & restock restrooms',       desc: 'Soap, paper towels, sanitize surfaces',     photo: true,  critical: true  },
      { title: 'Wipe all tables & chairs',        desc: 'Approved surface sanitiser on all seating', photo: false, critical: false },
      { title: 'Empty & reline all bins',         desc: 'Use correct bag size for each bin',         photo: false, critical: false },
    ],
    midshift: [
      { title: 'Hourly restroom check',           desc: 'Log time on the door chart',                photo: false, critical: false },
      { title: 'Spot-clean dining area',          desc: 'Tables, chairs, floor spills',              photo: false, critical: false },
      { title: 'Clear exterior & entrance',       desc: 'Sweep + remove litter outside',             photo: true,  critical: false },
    ],
    closing: [
      { title: 'Deep clean all restrooms',        desc: 'Toilets, sinks, drains, tiles',             photo: true,  critical: true  },
      { title: 'Full floor mop (all areas)',       desc: 'Include behind counters & kitchen entry',   photo: true,  critical: true  },
      { title: 'Clean entrance & mat area',       desc: 'External mat, door handles, glass panels',  photo: false, critical: false },
      { title: 'Final bin collection',            desc: 'All interior + exterior bins emptied',       photo: false, critical: false },
    ],
  },
};

// ── Agent Card ────────────────────────────────────────────────────────────────

function buildAgentCard(baseUrl) {
  return {
    name: 'Acme Store Operations Agent',
    description: 'Context-aware shift procedure agent for Acme store locations. Identifies each employee\'s role and store from their auth token and delivers the right checklist for their shift phase.',
    url: `${baseUrl}/api/a2a`,
    version: '1.0.0',
    provider: { organization: 'Acme Corp', url: baseUrl },
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: false },
    authentication: { schemes: ['Bearer'] },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text', 'data'],
    skills: [
      {
        id: 'get_shift_checklist',
        name: 'Get Shift Checklist',
        description: 'Returns the role-appropriate task checklist for the requested shift phase. Automatically identifies the employee\'s role and store location from their Bearer token.',
        tags: ['shift', 'checklist', 'store ops', 'procedures', 'tasks'],
        examples: [
          'What are my opening tasks?',
          'Show me my closing checklist',
          'What do I need to do today?',
          'Start my morning shift',
          'What\'s on my mid-shift list?',
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

// ── Streaming task loader ─────────────────────────────────────────────────────

async function runShiftTasks(userCtx, phase, onStep) {
  const delay = () => new Promise(r => setTimeout(r, 300));
  const tasks = STORE_TASKS[userCtx.role]?.[phase] ?? STORE_TASKS.cook.opening;
  const total = tasks.length + 1; // +1 for the initial context step

  await onStep(1, total, `Loading ${PHASE_LABELS[phase]} shift checklist for ${userCtx.title} at ${userCtx.location}…`);

  for (let i = 0; i < tasks.length; i++) {
    await delay();
    const t = tasks[i];
    const flags = [t.critical ? '⚠ Required' : null, t.photo ? '📷 Photo needed' : null].filter(Boolean).join(' · ');
    await onStep(i + 2, total, `${t.title}${flags ? ` — ${flags}` : ''}`);
  }

  return tasks;
}

function buildArtifact(userCtx, phase, tasks) {
  const critical = tasks.filter(t => t.critical).length;
  const photos = tasks.filter(t => t.photo).length;
  return [{
    name: `${PHASE_EMOJI[phase]} ${PHASE_LABELS[phase]} Shift Checklist`,
    description: `${tasks.length} tasks for ${userCtx.title} at ${userCtx.location}`,
    parts: [{
      type: 'data',
      data: {
        user: { name: userCtx.name, role: userCtx.role, title: userCtx.title },
        location: userCtx.location,
        phase,
        tasks,
        summary: { total: tasks.length, critical, photos },
        generatedAt: new Date().toISOString(),
      },
    }],
  }];
}

// ── tasks/send (synchronous) ──────────────────────────────────────────────────

async function handleTaskSend(params, token) {
  const taskId = params.id || `task-${Date.now()}`;
  const text = params.message?.parts?.find(p => p.type === 'text')?.text || '';
  const userCtx = getUserContext(token);
  const phase = detectPhase(text);
  const tasks = await runShiftTasks(userCtx, phase, () => {});
  const summary = `${PHASE_EMOJI[phase]} ${tasks.length} ${PHASE_LABELS[phase]} tasks loaded for ${userCtx.title} at ${userCtx.location}.`;

  return {
    id: taskId,
    status: makeTaskStatus('completed', summary),
    artifacts: buildArtifact(userCtx, phase, tasks),
    metadata: { user: userCtx, phase, taskCount: tasks.length },
    final: true,
  };
}

// ── tasks/sendSubscribe (streaming SSE) ──────────────────────────────────────

async function handleTaskSubscribe(params, token, rpcId, res) {
  const taskId = params.id || `task-${Date.now()}`;
  const text = params.message?.parts?.find(p => p.type === 'text')?.text || '';
  const userCtx = getUserContext(token);
  const phase = detectPhase(text);

  const sendEvent = (taskStatus, extra = {}) => {
    res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: rpcId, result: { id: taskId, status: taskStatus, ...extra } })}\n\n`);
  };

  sendEvent(makeTaskStatus('working', `Identifying context for ${userCtx.name}…`));

  const tasks = await runShiftTasks(userCtx, phase, (step, total, label) => {
    sendEvent(makeTaskStatus('working', label), { metadata: { step, totalSteps: total } });
  });

  const summary = `${PHASE_EMOJI[phase]} ${tasks.length} ${PHASE_LABELS[phase]} tasks ready for ${userCtx.title} at ${userCtx.location}.`;
  res.write(`data: ${JSON.stringify({
    jsonrpc: '2.0', id: rpcId,
    result: {
      id: taskId,
      status: makeTaskStatus('completed', summary),
      artifacts: buildArtifact(userCtx, phase, tasks),
      metadata: { step: tasks.length + 1, totalSteps: tasks.length + 1, user: userCtx, phase },
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
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (params?.metadata?.token || Buffer.from(`alice:${Date.now()}`).toString('base64'));

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
