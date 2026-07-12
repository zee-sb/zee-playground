// Memory writers.
//   syncProfileMemory        — deterministic, no LLM. Runs on early turns from
//                              the signed-in user's profile/org data.
//   extractConversationMemory — one cheap gpt-4o-mini pass over a finished
//                              conversation, extracting durable facts /
//                              preferences / open items.
// Both UPSERT into user_memory and never throw into the caller.

import { sql, dbConfigured } from '../db.mjs';
import { upsertMemories, resolveOpenItem } from './store.mjs';

// ── (a) Profile sync — deterministic ─────────────────────────────────────────
// Writes role/title, department/team, location, preferred language from the
// profile we already have. Zero LLM cost; makes Navigator "know" role/team on
// turn one. Safe to call every turn (idempotent UPSERT), but the caller gates
// it to early turns to avoid needless writes.
export async function syncProfileMemory({ userId, branchId, userProfile, preferredLanguage }) {
  if (!userId || !userProfile) return;
  const items = [];
  const push = (key, value, conf = 0.9) => {
    const v = (value == null ? '' : String(value)).trim();
    if (v) items.push({ kind: key.startsWith('pref:') ? 'preference' : 'profile', mem_key: key.replace(/^pref:/, ''), mem_value: v, source: 'staffbase', confidence: conf });
  };
  if (userProfile.title) push('role', `Role: ${userProfile.title}`);
  if (userProfile.department) push('team', `Team / department: ${userProfile.department}`);
  if (userProfile.location) push('location', `Location: ${userProfile.location}`);
  const lang = preferredLanguage || userProfile.preferred_language;
  if (lang) push('pref:preferred_language', `Prefers ${lang}`, 0.85);
  if (!items.length) return;
  await upsertMemories(userId, branchId, items);
}

// ── (b) Conversation extraction — one gpt-4o-mini pass ───────────────────────
const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { key: { type: 'string' }, value: { type: 'string' }, confidence: { type: 'number' } },
        required: ['key', 'value', 'confidence'],
      },
    },
    preferences: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { key: { type: 'string' }, value: { type: 'string' }, confidence: { type: 'number' } },
        required: ['key', 'value', 'confidence'],
      },
    },
    open_items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          key: { type: 'string' }, value: { type: 'string' },
          status: { type: 'string', enum: ['open', 'resolved'] },
          expires_in_days: { type: 'number' },
        },
        required: ['key', 'value', 'status'],
      },
    },
  },
  required: ['facts', 'preferences', 'open_items'],
};

const EXTRACT_SYSTEM = `You extract DURABLE memory about ONE employee from a chat with an internal assistant. Return only things worth remembering across future sessions.
- facts: stable, personal to this user (their team's tooling, their onboarding buddy, a recurring need). NOT generic policy facts anyone could look up.
- preferences: how they like the assistant to behave (language, brevity, format).
- open_items: unresolved requests/tickets/PTO with a short status. Use key like "open_ticket:<id>" or "pto:<month>". status "resolved" if the chat shows it was completed.
Be conservative: empty arrays are correct when nothing durable was said. Never invent. Keep values under 120 chars.`;

// Pull the freshly-computed conversation summary (if present) + last messages,
// run one extraction pass, UPSERT results. resolution auto-resolves matching
// open items. `openai` is the same chat client the orchestrator uses.
export async function extractConversationMemory({ openai, conversationId, userId, branchId }) {
  if (!openai || !userId || !conversationId || !dbConfigured()) return { skipped: true };
  try {
    const msgs = await sql`
      select role, content from messages
      where conversation_id = ${conversationId}
        and role in ('user','assistant')
      order by created_at desc limit 12`;
    if (msgs.length < 3) return { skipped: 'too_short' };
    const transcript = msgs.reverse().map((m) => {
      const c = m.content;
      const text = typeof c === 'string' ? c : (c?.text || c?.content || '');
      return `${m.role}: ${String(text).slice(0, 400)}`;
    }).filter((l) => l.length > 6).join('\n');
    if (!transcript.trim()) return { skipped: 'empty' };

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: `Conversation:\n${transcript}\n\nExtract durable memory as JSON.` },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'memory', strict: true, schema: EXTRACT_SCHEMA } },
    });
    const raw = resp?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { skipped: 'parse' }; }

    const items = [];
    for (const f of parsed.facts || []) {
      items.push({ kind: 'fact', mem_key: f.key, mem_value: f.value, source: 'conversation', source_ref: conversationId, confidence: clamp(f.confidence) });
    }
    for (const p of parsed.preferences || []) {
      items.push({ kind: 'preference', mem_key: p.key, mem_value: p.value, source: 'conversation', source_ref: conversationId, confidence: clamp(p.confidence) });
    }
    for (const o of parsed.open_items || []) {
      const expires_at = Number.isFinite(o.expires_in_days) && o.expires_in_days > 0
        ? new Date(Date.now() + o.expires_in_days * 86400000).toISOString() : null;
      items.push({ kind: 'open_item', mem_key: o.key, mem_value: o.value, status: o.status || 'open', source: 'conversation', source_ref: conversationId, confidence: 0.7, expires_at });
      if (o.status === 'resolved') await resolveOpenItem(userId, o.key);
    }
    await upsertMemories(userId, branchId, items);
    return { wrote: items.length };
  } catch (e) {
    console.warn('[memory] extractConversationMemory:', e.message);
    return { error: e.message };
  }
}

function clamp(n) { const x = Number(n); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.6; }
