// Staffbase Voices — MCP server.
//
// Tools exposed:
//   • submit_recognition  — publish a peer-recognition post to the Voices wall
//   • submit_pulse_feedback — submit a pulse-survey response (text + sentiment)
//   • list_recent_recognitions — read the latest entries from the wall
//
// Backed by an in-memory ring buffer so the demo state survives across calls
// in a single Vercel function instance. Persistence isn't the point — the
// goal is to give Navigator's photo flows a believable write tool to call.
//
// Wire format mirrors lib/mcp-servers/kb.mjs (hand-rolled JSON-RPC, no SDK).

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// ── Demo state ─────────────────────────────────────────────────────────────
const MAX_FEED = 50;
const RECOGNITIONS = [
  {
    id: 'rec_seed_1',
    nominee: 'Alice Chen',
    note: 'Stayed late on Thursday helping engineering unblock the migration. Whole release shipped because of it.',
    category: 'above_and_beyond',
    submittedBy: 'Bob Smith',
    submittedAt: '2026-05-14T16:21:00Z',
    hasPhoto: false,
  },
  {
    id: 'rec_seed_2',
    nominee: 'Carol Davis',
    note: 'Ran a workshop on the new design system that saved every PM at least a day this sprint.',
    category: 'craft',
    submittedBy: 'Dave Wilson',
    submittedAt: '2026-05-15T10:04:00Z',
    hasPhoto: true,
  },
];
const PULSE_RESPONSES = [];

function nextId(prefix, ring) {
  return `${prefix}_${Date.now().toString(36)}_${(ring.length + 1).toString(36)}`;
}
function pushRing(ring, item) {
  ring.push(item);
  if (ring.length > MAX_FEED) ring.shift();
  return item;
}

// ── Tool catalog ───────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'submit_recognition',
    description: 'Publish a peer-recognition post to the Staffbase Voices wall. Returns the post id and a permalink the chat can echo back.',
    inputSchema: {
      type: 'object',
      properties: {
        nominee:    { type: 'string', description: 'Name or email of the person being recognized.' },
        note:       { type: 'string', description: 'Short message explaining what they did.' },
        category:   {
          type: 'string',
          enum: ['above_and_beyond', 'craft', 'culture', 'customer_impact', 'collaboration'],
          description: 'Recognition category.',
        },
        moment_photo: { type: 'string', description: 'Optional data URL of a photo capturing the moment (validated upstream).' },
      },
      required: ['nominee', 'note'],
    },
  },
  {
    name: 'submit_pulse_feedback',
    description: 'Submit a pulse-survey response to Voices. Used by surveys that ask employees to share what is working / not working.',
    inputSchema: {
      type: 'object',
      properties: {
        topic:      { type: 'string', description: 'The pulse topic (e.g. "workspace", "wellbeing", "manager check-in").' },
        sentiment:  { type: 'string', enum: ['positive', 'neutral', 'negative'], description: 'Tone of the response.' },
        comment:    { type: 'string', description: 'Free-text comment from the employee.' },
        photo:      { type: 'string', description: 'Optional supporting photo as a data URL.' },
      },
      required: ['topic', 'comment'],
    },
  },
  {
    name: 'list_recent_recognitions',
    description: 'List the most recent peer-recognition posts on the Voices wall (newest first). Use to show the wall in chat.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Max posts to return (default 6).' },
      },
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────
function submitRecognition(args) {
  const nominee = String(args.nominee || '').trim();
  const note = String(args.note || '').trim();
  if (!nominee || !note) {
    return { error: 'nominee and note are required' };
  }
  const category = ['above_and_beyond', 'craft', 'culture', 'customer_impact', 'collaboration'].includes(args.category)
    ? args.category
    : 'culture';
  const entry = {
    id: nextId('rec', RECOGNITIONS),
    nominee,
    note,
    category,
    submittedBy: 'You',
    submittedAt: new Date().toISOString(),
    hasPhoto: typeof args.moment_photo === 'string' && args.moment_photo.startsWith('data:image/'),
  };
  pushRing(RECOGNITIONS, entry);
  return {
    status: 'posted',
    postId: entry.id,
    permalink: `campsite.staffbase.com/voices/recognitions/${entry.id}`,
    message: `Posted to the Voices wall — ${nominee} got a ${category.replace(/_/g, ' ')} shout-out.`,
    entry: {
      id: entry.id,
      nominee: entry.nominee,
      note: entry.note,
      category: entry.category,
      submittedAt: entry.submittedAt,
      hasPhoto: entry.hasPhoto,
    },
  };
}

function submitPulseFeedback(args) {
  const topic = String(args.topic || '').trim();
  const comment = String(args.comment || '').trim();
  if (!topic || !comment) return { error: 'topic and comment are required' };
  const sentiment = ['positive', 'neutral', 'negative'].includes(args.sentiment) ? args.sentiment : 'neutral';
  const entry = {
    id: nextId('pulse', PULSE_RESPONSES),
    topic, sentiment, comment,
    hasPhoto: typeof args.photo === 'string' && args.photo.startsWith('data:image/'),
    submittedAt: new Date().toISOString(),
  };
  pushRing(PULSE_RESPONSES, entry);
  return {
    status: 'recorded',
    responseId: entry.id,
    message: `Thanks — your pulse response on "${topic}" was recorded.`,
  };
}

function listRecentRecognitions(args) {
  const limit = Math.min(Math.max(parseInt(args.limit, 10) || 6, 1), 20);
  const slice = RECOGNITIONS.slice(-limit).reverse();
  return {
    count: slice.length,
    recognitions: slice,
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, X-Companion-User-Id');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { body = JSON.parse(raw); } catch { body = {}; }
  }

  const { id = 0, method, params } = body || {};

  try {
    if (method === 'tools/list') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(rpcResult(id, { tools: TOOLS }));
      return;
    }
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      let payload;
      if (toolName === 'submit_recognition') payload = submitRecognition(args);
      else if (toolName === 'submit_pulse_feedback') payload = submitPulseFeedback(args);
      else if (toolName === 'list_recent_recognitions') payload = listRecentRecognitions(args);
      else {
        res.status(200).json(rpcError(id, -32601, `Unknown tool: ${toolName}`));
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(rpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      }));
      return;
    }
    if (method === 'initialize') {
      res.status(200).json(rpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'staffbase-voices', version: '1.0.0' },
      }));
      return;
    }
    res.status(200).json(rpcError(id, -32601, `Method not found: ${method}`));
  } catch (err) {
    console.error('[voices-mcp]', err);
    res.status(500).json(rpcError(id, -32000, err.message || 'internal_error'));
  }
}
