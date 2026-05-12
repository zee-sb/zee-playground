// Single Vercel function handling all /api/companion/* routes. Consolidated
// to stay under the Hobby plan's 12-function-per-deployment ceiling.
//
//   GET  /api/companion/conversations              → list user conversations
//   POST /api/companion/conversations              → create conversation
//   GET  /api/companion/messages?conversationId=…  → list messages
//   POST /api/companion/chat                       → NDJSON orchestrator stream
//   POST /api/companion/confirm                    → resume paused write-tool turn

import OpenAI from 'openai';
import { getUserFromReq } from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';
import { runOrchestratedTurn } from '../lib/orchestrator.mjs';
import { CONNECTORS } from '../lib/connector-registry.mjs';

function baseUrlOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function pathOf(req) {
  if (req.query?._path) return String(req.query._path);
  return (req.url || '').split('?')[0];
}

// Derive a snappy conversation title from the user's first message. Takes
// the first sentence (or first ~60 chars), trims, drops a single trailing
// punctuation mark, and capitalises the first letter. Empty/whitespace-only
// inputs yield null so we fall back to the original placeholder.
function deriveTitle(rawMessage) {
  const s = String(rawMessage || '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const sentenceMatch = s.match(/^[^.!?\n]{3,120}[.!?]/);
  let candidate = sentenceMatch ? sentenceMatch[0] : s;
  candidate = candidate.slice(0, 60).trim();
  // Drop a single trailing . , ; : but keep '?' so questions read as questions.
  candidate = candidate.replace(/[.,;:]\s*$/, '');
  if (!candidate) return null;
  if (s.length > 60 && !/[.!?]$/.test(candidate)) candidate += '…';
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

export default async function handler(req, res) {
  const path = pathOf(req);
  try {
    if (path === '/api/companion/conversations') return await conversations(req, res);
    if (path === '/api/companion/messages')      return await messages(req, res);
    if (path === '/api/companion/chat')          return await chat(req, res);
    if (path === '/api/companion/confirm')       return await confirm(req, res);
    res.status(404).json({ error: 'not_found', path });
  } catch (err) {
    console.error('[companion router]', path, err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  }
}

// ── /api/companion/conversations ───────────────────────────────────────
async function conversations(req, res) {
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  if (req.method === 'GET') {
    const rows = await sql`
      select id, title, created_at, updated_at
      from conversations
      where user_id = ${session.userId}
      order by updated_at desc
      limit 50
    `;
    res.status(200).json({ conversations: rows });
    return;
  }
  if (req.method === 'POST') {
    const title = (req.body && typeof req.body.title === 'string') ? req.body.title.slice(0, 200) : null;
    const rows = await sql`
      insert into conversations (user_id, title)
      values (${session.userId}, ${title})
      returning id, title, created_at, updated_at
    `;
    res.status(201).json({ conversation: rows[0] });
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
}

// ── GET /api/companion/messages?conversationId=… ───────────────────────
async function messages(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const url = new URL(req.url, 'http://x');
  const conversationId = url.searchParams.get('conversationId');
  if (!conversationId) {
    res.status(400).json({ error: 'conversationId is required' });
    return;
  }
  const own = await sql`select id from conversations where id = ${conversationId} and user_id = ${session.userId}`;
  if (!own.length) {
    res.status(404).json({ error: 'conversation_not_found' });
    return;
  }
  const rows = await sql`
    select id, role, content, created_at
    from messages
    where conversation_id = ${conversationId}
    order by created_at asc
  `;
  res.status(200).json({ messages: rows });
}

// ── POST /api/companion/chat — streams NDJSON orchestrator events ──────
async function chat(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }

  const { conversationId, message } = req.body || {};
  if (!conversationId || !message || typeof message !== 'string') {
    res.status(400).json({ error: 'conversationId and message are required' });
    return;
  }

  const own = await sql`
    select c.id, u.staffbase_user_id, u.email, u.display_name, u.department, u.title from conversations c
    join users u on u.id = c.user_id
    where c.id = ${conversationId} and c.user_id = ${session.userId}
  `;
  if (!own.length) {
    res.status(404).json({ error: 'conversation_not_found' });
    return;
  }
  const staffbaseUserId = own[0].staffbase_user_id;
  const userProfile = {
    id: staffbaseUserId,
    email: own[0].email,
    name: own[0].display_name,
    department: own[0].department,
    title: own[0].title,
  };

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const emit = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    await sql`
      insert into messages (conversation_id, role, content)
      values (${conversationId}, 'user', ${JSON.stringify({ text: message })}::jsonb)
    `;

    // First user message in this conversation? Auto-name it from the message
    // so the sidebar stops showing "New conversation" everywhere. We DO NOT
    // overwrite a title the user (or a previous auto-naming pass) already set.
    const titleRows = await sql`
      select title from conversations where id = ${conversationId} and user_id = ${session.userId}
    `;
    const currentTitle = titleRows[0]?.title || null;
    const userMsgCount = await sql`
      select count(*)::int as n from messages where conversation_id = ${conversationId} and role = 'user'
    `;
    if (userMsgCount[0]?.n === 1 && (!currentTitle || currentTitle === 'New conversation')) {
      const derived = deriveTitle(message);
      if (derived) {
        await sql`update conversations set title = ${derived} where id = ${conversationId} and user_id = ${session.userId}`;
        emit({ type: 'conversation_renamed', conversationId, title: derived });
      }
    }

    await sql`update conversations set updated_at = now() where id = ${conversationId}`;
    const rows = await sql`
      select role, content from messages
      where conversation_id = ${conversationId}
      order by created_at asc
    `;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const onAssistantMessage = async (msg) => {
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'assistant', ${JSON.stringify(msg)}::jsonb)
      `;
    };
    const onToolResult = async (toolMsg) => {
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'tool', ${JSON.stringify(toolMsg)}::jsonb)
      `;
    };
    const result = await runOrchestratedTurn({
      openai,
      userId: session.userId,
      staffbaseUserId,
      userProfile,
      baseUrl: baseUrlOf(req),
      history: rows,
      emit,
      onAssistantMessage,
      onToolResult,
    });
    if (result.status === 'await_confirm') {
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'system', ${JSON.stringify({ pendingConfirmation: true, toolCalls: result.toolCalls })}::jsonb)
      `;
      emit({ type: 'done', awaitingConfirmation: true });
    }
  } catch (err) {
    console.error('[companion/chat]', err);
    emit({ type: 'error', message: err.message || String(err) });
  } finally {
    res.end();
  }
}

// ── POST /api/companion/confirm ────────────────────────────────────────
async function confirm(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }

  const { conversationId, decision } = req.body || {};
  if (!conversationId || !['confirm', 'cancel'].includes(decision)) {
    res.status(400).json({ error: 'conversationId and decision required' });
    return;
  }

  const own = await sql`select id from conversations where id = ${conversationId} and user_id = ${session.userId}`;
  if (!own.length) {
    res.status(404).json({ error: 'conversation_not_found' });
    return;
  }

  const pendingRows = await sql`
    select id, content from messages
    where conversation_id = ${conversationId} and role = 'system'
    order by created_at desc limit 1
  `;
  const pending = pendingRows[0]?.content;
  if (!pending?.pendingConfirmation || !Array.isArray(pending.toolCalls)) {
    res.status(409).json({ error: 'no_pending_confirmation' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  const emit = (obj) => res.write(JSON.stringify(obj) + '\n');

  const base = baseUrlOf(req);

  try {
    for (const tc of pending.toolCalls) {
      const connector = CONNECTORS.find((c) => c.id === (tc.connector || 'atlassian'));
      const endpoint = connector?.endpoint;
      let result;
      if (decision === 'confirm') {
        emit({ type: 'tool_start', toolCallId: tc.id, name: tc.name, connector: connector?.id, args: tc.args, confirmed: true });
        try {
          result = await rpc(base, endpoint, 'tools/call', { name: tc.name, arguments: tc.args }, session.userId);
          if (result?.content) {
            const text = result.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
            try { result = JSON.parse(text); } catch { result = text; }
          }
        } catch (err) {
          result = { error: err.message || String(err) };
        }
      } else {
        result = { cancelled: true, reason: 'User declined to run this write action.' };
      }
      emit({ type: 'tool_result', toolCallId: tc.id, name: tc.name, connector: connector?.id, result });

      const toolMsg = {
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.namespacedName || `${connector?.id}__${tc.name}`,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      };
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'tool', ${JSON.stringify(toolMsg)}::jsonb)
      `;
    }

    await sql`delete from messages where id = ${pendingRows[0].id}`;

    const historyRows = await sql`
      select role, content from messages
      where conversation_id = ${conversationId} and role != 'system'
      order by created_at asc
    `;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: 'Briefly confirm what just happened, citing IDs/URLs from the tool result. One or two sentences. Then end with a <suggestions>["...","...","..."]</suggestions> block.' },
        ...historyRows.map(rowToOpenAi).filter(Boolean),
      ],
    });
    let finalText = '';
    for await (const chunk of stream) {
      const d = chunk.choices[0]?.delta;
      if (d?.content) { finalText += d.content; emit({ type: 'delta', content: d.content }); }
    }

    await sql`
      insert into messages (conversation_id, role, content)
      values (${conversationId}, 'assistant', ${JSON.stringify({ role: 'assistant', content: finalText })}::jsonb)
    `;
    await sql`update conversations set updated_at = now() where id = ${conversationId}`;
    emit({ type: 'done', final: finalText });
  } catch (err) {
    console.error('[companion/confirm]', err);
    emit({ type: 'error', message: err.message || String(err) });
  } finally {
    res.end();
  }
}

async function rpc(baseUrl, endpoint, method, params, userId) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer companion-confirm',
      ...(userId ? { 'X-Companion-User-Id': userId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await res.text();
  for (const line of text.trim().split('\n').filter(Boolean)) {
    const payload = line.startsWith('data: ') ? line.slice(6) : line;
    try {
      const obj = JSON.parse(payload);
      if (obj.result !== undefined) return obj.result;
      if (obj.error) throw new Error(obj.error.message || JSON.stringify(obj.error));
    } catch { /* skip non-JSON */ }
  }
  return null;
}

function rowToOpenAi(row) {
  if (row.role === 'user') return { role: 'user', content: typeof row.content === 'string' ? row.content : (row.content?.text || '') };
  if (row.role === 'assistant') {
    const c = row.content || {};
    const m = { role: 'assistant', content: c.content ?? null };
    if (c.tool_calls?.length) m.tool_calls = c.tool_calls;
    return m;
  }
  if (row.role === 'tool') {
    const c = row.content || {};
    return { role: 'tool', tool_call_id: c.tool_call_id, content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content) };
  }
  return null;
}
