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
import { runOrchestratedTurn } from '../lib/orchestrator/index.mjs';
import { CONNECTORS } from '../lib/connector-registry.mjs';
import { loadStudio, materializeActiveScope, userToAudience } from '../lib/studio-config.mjs';
import { listConnectionsForUser } from '../lib/connections.mjs';
import { getVoiceProvider } from '../lib/voice/provider.mjs';
import { redactPII } from '../lib/voice/pii-redact.mjs';

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
    if (path === '/api/companion/hero')          return await hero(req, res);
    if (path === '/api/companion/transcribe')    return await transcribe(req, res);
    if (path === '/api/companion/tts')           return await tts(req, res);
    // DELETE /api/companion/conversations/:id — owner-only.
    const delMatch = path.match(/^\/api\/companion\/conversations\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') return await deleteConversation(req, res, delMatch[1]);
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

// ── DELETE /api/companion/conversations/:id ────────────────────────────
async function deleteConversation(req, res, conversationId) {
  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_not_configured' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  // Ownership gate — return the same 404 shape we use everywhere else so we
  // don't leak whether the conversation exists for someone else.
  const own = await sql`
    select id from conversations where id = ${conversationId} and user_id = ${session.userId}
  `;
  if (!own.length) {
    res.status(404).json({ error: 'conversation_not_found' });
    return;
  }
  // FK cascade on messages.conversation_id cleans up the message rows
  // automatically (per migration 002_multi_connector.sql).
  await sql`
    delete from conversations where id = ${conversationId} and user_id = ${session.userId}
  `;
  res.status(200).json({ ok: true });
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

  const { conversationId, message, formSubmission, confirmResponse, inputModality, lang } = req.body || {};
  if (!conversationId) {
    res.status(400).json({ error: 'conversationId is required' });
    return;
  }
  const hasFlowInput = (formSubmission && typeof formSubmission === 'object')
    || (confirmResponse && typeof confirmResponse === 'object');
  if (!hasFlowInput && (!message || typeof message !== 'string')) {
    res.status(400).json({ error: 'message or flow submission required' });
    return;
  }
  const modality = inputModality === 'voice' ? 'voice' : 'text';
  // Session language is per-conversation, sticky. Update it from the inbound
  // turn when the client tells us (voice detection or explicit pill switch)
  // and the value is a 2-letter ISO code.
  const inboundLang = typeof lang === 'string' && /^[a-z]{2}(-[a-zA-Z]{2,3})?$/.test(lang)
    ? lang.toLowerCase().slice(0, 2)
    : null;
  const flowSubmission = formSubmission
    ? { kind: 'form', flowId: formSubmission.flowId, stepId: formSubmission.stepId, values: formSubmission.values || {} }
    : confirmResponse
      ? { kind: 'confirm', flowId: confirmResponse.flowId, stepId: confirmResponse.stepId, accepted: !!confirmResponse.accepted, cancelTo: confirmResponse.cancelTo }
      : null;

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
    // Resolve the session language: client-provided wins, otherwise inherit
    // from the most recent assistant turn's stored session_lang.
    let sessionLang = inboundLang;
    if (!sessionLang) {
      const prior = await sql`
        select content from messages
        where conversation_id = ${conversationId}
          and content ? 'session_lang'
        order by created_at desc limit 1
      `;
      sessionLang = prior[0]?.content?.session_lang || null;
    }
    if (inboundLang) {
      // Record the language detection / switch on the session for audit.
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'system', ${JSON.stringify({ session_lang: inboundLang, source: modality === 'voice' ? 'voice_detect' : 'explicit' })}::jsonb)
      `;
    }

    if (message) {
      const userPayload = { text: message };
      if (modality === 'voice') userPayload.input_modality = 'voice';
      if (sessionLang) userPayload.stt_language = sessionLang;
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'user', ${JSON.stringify(userPayload)}::jsonb)
      `;
      if (modality === 'voice') {
        // Compliance row — modality + lang only; never the audio bytes.
        try {
          await sql`
            insert into voice_audit (conversation_id, user_id, modality, language, transcript_hash)
            values (${conversationId}, ${session.userId}, 'voice', ${sessionLang || null}, ${hashTranscript(message)})
          `;
        } catch (err) {
          // Migration may not be applied yet — log and continue, don't break the chat.
          if (!/relation .* does not exist/i.test(err.message)) {
            console.warn('[companion/chat] voice_audit insert failed:', err.message);
          }
        }
      }
    } else if (flowSubmission) {
      // Persist a synthetic user-facing record of the submission so the chat
      // history (and reload) shows what the user did, without bloating the
      // visible bubble stream. Stored as a system message.
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'system', ${JSON.stringify({ flowInput: flowSubmission })}::jsonb)
      `;
    }

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
    if (message && userMsgCount[0]?.n === 1 && (!currentTitle || currentTitle === 'New conversation')) {
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
    const onSystemMessage = async (content) => {
      await sql`
        insert into messages (conversation_id, role, content)
        values (${conversationId}, 'system', ${JSON.stringify(content)}::jsonb)
      `;
    };
    // Load Studio config + the user's OAuth connection list. Both feed into
    // the orchestrator: Studio decides admin-enabled connectors, connections
    // decide which provider-gated connectors the user can actually call.
    const [studio, connections] = await Promise.all([
      loadStudio({}).catch((err) => {
        console.warn('[companion/chat] loadStudio failed:', err.message);
        return null;
      }),
      listConnectionsForUser(session.userId).catch(() => []),
    ]);
    const userConnectionProviders = new Set((connections || []).map((c) => c.provider));

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
      onSystemMessage,
      studio,
      branchId: studio?.branchId || null,
      userConnections: userConnectionProviders,
      flowSubmission,
      sessionLang,
      inputModality: modality,
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

  // For Studio-driven flows, the write-confirm endpoint must also resolve
  // against admin-authored connectors — not just the legacy registry.
  const studio = await loadStudio({}).catch(() => null);
  const studioConnectors = studio?.config?.connectors || [];

  try {
    for (const tc of pending.toolCalls) {
      const connector =
        studioConnectors.find((c) => c.id === tc.connector)
        || CONNECTORS.find((c) => c.id === (tc.connector || 'atlassian'));
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

// ── GET /api/companion/hero ────────────────────────────────────────────
// Returns the user-filtered visible assistants + active flows so the Hero
// state can render dynamic launchpad chips driven by Studio config. Falls
// back to an empty payload when Studio is empty or unreachable — the UI
// already has its own legacy chip set in that case.
async function hero(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  let userProfile = null;
  let userConnections = new Set();
  try {
    if (dbConfigured()) {
      const session = await getUserFromReq(req);
      if (session) {
        const [userRows, connRows] = await Promise.all([
          sql`select email, display_name, department, title from users where id = ${session.userId} limit 1`,
          listConnectionsForUser(session.userId).catch(() => []),
        ]);
        if (userRows[0]) {
          userProfile = {
            email: userRows[0].email,
            name: userRows[0].display_name,
            department: userRows[0].department,
            title: userRows[0].title,
          };
        }
        userConnections = new Set((connRows || []).map((c) => c.provider));
      }
    }
  } catch (err) {
    console.warn('[companion/hero] user lookup failed:', err.message);
  }
  let studio = null;
  try { studio = await loadStudio({}); }
  catch (err) { console.warn('[companion/hero] loadStudio failed:', err.message); }

  if (!studio) {
    res.status(200).json({ assistants: [], flows: [], connectors: [], needsAuth: [], studioEmpty: true });
    return;
  }
  const scope = materializeActiveScope({
    config: studio.config,
    assistants: studio.assistants,
    user: userToAudience(userProfile),
    userConnections,
  });
  res.status(200).json({
    assistants: scope.assistants.map((a) => ({
      id: a.id, name: a.name, icon: a.icon || '✨', description: a.description || '',
    })),
    flows: scope.flows.map((f) => ({
      id: f.id, name: f.name, mode: f.mode || 'suggested', goal: f.goal || '',
    })),
    connectors: scope.connectors.map((c) => ({
      id: c.id, kind: c.kind, name: c.name, provider: c.provider || null, source: c.source || null,
    })),
    needsAuth: (scope.needsAuth || []).map((c) => ({
      id: c.id, kind: c.kind, name: c.name, provider: c.provider, description: c.description || '',
    })),
    tenant: { name: studio.config?.tenantOverrides?.name || 'Staffbase' },
    studioEmpty: false,
  });
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

// ── POST /api/companion/transcribe — voice → text via the active provider ──
//
// Body shape: JSON { audio: "<base64>", mimeType: "audio/webm", languageHint? }
// We chose base64 JSON over multipart so this works without adding a parser
// dep on the Vercel serverless runtime. Audio bytes are passed straight to
// the voice provider — never persisted.
async function transcribe(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const { audio, mimeType, languageHint } = req.body || {};
  if (!audio || typeof audio !== 'string') {
    res.status(400).json({ error: 'audio (base64 string) is required' });
    return;
  }
  // Strip an optional data: URL prefix so the client can send either form.
  const b64 = audio.includes(',') ? audio.split(',', 2)[1] : audio;
  let buf;
  try { buf = Buffer.from(b64, 'base64'); }
  catch { res.status(400).json({ error: 'invalid base64' }); return; }
  if (buf.length === 0) { res.status(400).json({ error: 'empty audio' }); return; }
  // 25MB hard cap (matches OpenAI whisper limits). Frontline clips are seconds.
  if (buf.length > 25 * 1024 * 1024) { res.status(413).json({ error: 'audio too large' }); return; }

  try {
    const provider = getVoiceProvider();
    const result = await provider.transcribe({
      audio: buf,
      mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
      languageHint: typeof languageHint === 'string' ? languageHint : undefined,
    });
    const { text: redactedText, redactions } = redactPII(result.text || '');
    res.status(200).json({
      text: redactedText,
      language: result.language || null,
      confidence: typeof result.confidence === 'number' ? result.confidence : null,
      redactions,
      provider: provider.name,
    });
  } catch (err) {
    console.error('[companion/transcribe]', err);
    res.status(500).json({ error: 'transcribe_failed', message: err.message || String(err) });
  }
}

// ── POST /api/companion/tts — text → spoken audio via the active provider ──
async function tts(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const session = await getUserFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'not_signed_in' });
    return;
  }
  const { text, voice, lang } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  // Cap input size to keep latency bounded and prevent abuse.
  const safe = text.slice(0, 2000);
  try {
    const provider = getVoiceProvider();
    const { audio, contentType } = await provider.synthesize({
      text: safe,
      voice: typeof voice === 'string' ? voice : undefined,
      lang: typeof lang === 'string' ? lang.toLowerCase().slice(0, 2) : undefined,
    });
    res.setHeader('Content-Type', contentType || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audio);
  } catch (err) {
    console.error('[companion/tts]', err);
    res.status(500).json({ error: 'tts_failed', message: err.message || String(err) });
  }
}

// FNV-1a 32-bit hash — cheap, dependency-free. Used for voice_audit linkage
// only: lets compliance correlate a transcript to its turn without storing
// the text itself.
function hashTranscript(text) {
  let h = 0x811c9dc5;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
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
