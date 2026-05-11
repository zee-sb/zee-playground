// POST /api/companion/chat { conversationId, message }
// Streams NDJSON events. See api/lib/orchestrator.mjs for the protocol.

import OpenAI from 'openai';
import { getUserFromReq } from '../lib/session.mjs';
import { sql, dbConfigured } from '../lib/db.mjs';
import { runOrchestratedTurn } from '../lib/orchestrator.mjs';

function baseUrlOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
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
    select c.id, u.staffbase_user_id from conversations c
    join users u on u.id = c.user_id
    where c.id = ${conversationId} and c.user_id = ${session.userId}
  `;
  if (!own.length) {
    res.status(404).json({ error: 'conversation_not_found' });
    return;
  }
  const staffbaseUserId = own[0].staffbase_user_id;

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const emit = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    // Persist user message
    await sql`
      insert into messages (conversation_id, role, content)
      values (${conversationId}, 'user', ${JSON.stringify({ text: message })}::jsonb)
    `;
    await sql`update conversations set updated_at = now() where id = ${conversationId}`;

    // Load history
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
