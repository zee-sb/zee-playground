// POST /api/companion/confirm { conversationId, decision: 'confirm' | 'cancel' }
// Resumes a paused turn whose write tool needs explicit user approval. Writes
// go through our internal Atlassian MCP wrapper (REST-direct) just like reads.

import OpenAI from 'openai';
import { getUserFromReq } from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';
import { CONNECTORS } from '../lib/connector-registry.mjs';

function baseUrlOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
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

export default async function handler(req, res) {
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

    // Wrap up with a brief LLM round (no tools) so the model can confirm what
    // happened to the user in plain language.
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
