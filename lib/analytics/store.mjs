// Navigator Analytics — shared store layer used by both the backfill script
// and the read API. Keeps the SQL in one place so write/read shapes stay
// in sync.

import { sql } from '../db.mjs';
import { computeForConversation } from './seed-evals.mjs';

const COMPUTED_VERSION = 'v1';
const EVALUATOR = 'seed_v1';
const EVALUATOR_VERSION = '1';

// ── reads ──────────────────────────────────────────────────────────────────

export async function getConversationMessages(conversationId) {
  return await sql`
    select id, role, content, created_at
    from messages
    where conversation_id = ${conversationId}
    order by created_at asc
  `;
}

export async function getSummary(conversationId) {
  const rows = await sql`
    select * from conversation_summary where conversation_id = ${conversationId}
  `;
  return rows[0] || null;
}

export async function getEvals(conversationId) {
  return await sql`
    select dimension, score_type, score_numeric, score_label, score_flag,
           reasoning, evaluator, evaluator_version, source, created_at
    from conversation_evals
    where conversation_id = ${conversationId}
    order by dimension asc
  `;
}

// ── writes ─────────────────────────────────────────────────────────────────

export async function upsertSummary(conversationId, summary) {
  await sql`
    insert into conversation_summary (
      conversation_id, summary, primary_topic, resolution_state, reported_issue,
      device, mode, language, intent_in_scope, intent_reasoning,
      message_count, tool_call_count, has_low_score, computed_version, computed_at
    ) values (
      ${conversationId},
      ${summary.summary},
      ${summary.primary_topic},
      ${summary.resolution_state},
      ${summary.reported_issue},
      ${summary.device},
      ${summary.mode},
      ${summary.language},
      ${summary.intent_in_scope},
      ${summary.intent_reasoning},
      ${summary.message_count},
      ${summary.tool_call_count},
      ${summary.has_low_score},
      ${summary.computed_version || COMPUTED_VERSION},
      now()
    )
    on conflict (conversation_id) do update set
      summary          = excluded.summary,
      primary_topic    = excluded.primary_topic,
      resolution_state = excluded.resolution_state,
      reported_issue   = excluded.reported_issue,
      device           = excluded.device,
      mode             = excluded.mode,
      language         = excluded.language,
      intent_in_scope  = excluded.intent_in_scope,
      intent_reasoning = excluded.intent_reasoning,
      message_count    = excluded.message_count,
      tool_call_count  = excluded.tool_call_count,
      has_low_score    = excluded.has_low_score,
      computed_version = excluded.computed_version,
      computed_at      = now()
  `;
}

export async function upsertEvals(conversationId, evals) {
  // One row at a time keeps the parameterised query simple and works under
  // Neon's serverless driver, which doesn't support multi-row inserts via
  // tagged templates as cleanly as a libpq client would.
  for (const e of evals) {
    await sql`
      insert into conversation_evals (
        conversation_id, dimension, score_type,
        score_numeric, score_label, score_flag, reasoning,
        evaluator, evaluator_version, source
      ) values (
        ${conversationId},
        ${e.dimension},
        ${e.score_type},
        ${e.score_numeric},
        ${e.score_label},
        ${e.score_flag},
        ${e.reasoning},
        ${EVALUATOR},
        ${EVALUATOR_VERSION},
        'seed'
      )
      on conflict (conversation_id, dimension, evaluator, evaluator_version) do update set
        score_type    = excluded.score_type,
        score_numeric = excluded.score_numeric,
        score_label   = excluded.score_label,
        score_flag    = excluded.score_flag,
        reasoning     = excluded.reasoning,
        created_at    = now()
    `;
  }
}

// ── compute on demand ──────────────────────────────────────────────────────

// Idempotent. Computes summary + evals for one conversation and writes both
// tables. Returns the summary row that was written.
export async function recomputeConversation(conversationId) {
  const messages = await getConversationMessages(conversationId);
  const { summary, evals } = computeForConversation({ conversationId, messages });
  await upsertSummary(conversationId, summary);
  await upsertEvals(conversationId, evals);
  return summary;
}

// Returns the summary row, computing it lazily if missing or stale. Used by
// the API list/detail handlers so a freshly-created conversation is visible
// without waiting for the next backfill pass.
export async function ensureSummary(conversationId) {
  const existing = await getSummary(conversationId);
  if (existing && existing.computed_version === COMPUTED_VERSION) return existing;
  await recomputeConversation(conversationId);
  return await getSummary(conversationId);
}

export { COMPUTED_VERSION, EVALUATOR, EVALUATOR_VERSION };
