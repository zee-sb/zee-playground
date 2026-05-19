// Navigator Analytics API.
//
//   GET /api/navigator-analytics?action=list      — filterable, paginated list
//   GET /api/navigator-analytics?action=detail&id — single conversation incl. messages, tool calls, scores
//   GET /api/navigator-analytics?action=overview  — aggregated KPIs, trends, score distributions
//   GET /api/navigator-analytics?action=insights  — clustered insights with recommended action types
//
// Tenant is resolved via ?branch= (or the fallback single-tenant lookup), mirroring
// every other Navigator endpoint in this repo. Scores fall back to lazy compute
// on read so a freshly-created conversation is visible without waiting for the
// next backfill pass.

import { sql, dbConfigured } from '../lib/db.mjs';
import { resolveBranchId } from '../lib/tenants.mjs';
import {
  ensureSummary,
  getSummary,
  getConversationMessages,
  getEvals,
  recomputeConversation,
  COMPUTED_VERSION,
} from '../lib/analytics/store.mjs';
import { FIRST_CLASS_DIMENSIONS } from '../lib/analytics/seed-evals.mjs';

const OVERVIEW_CACHE = new Map(); // key → { value, expiresAt }
const OVERVIEW_TTL_MS = 60 * 1000;
const INSIGHTS_CACHE = new Map();
const INSIGHTS_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!dbConfigured()) return res.status(503).json({ error: 'db_not_configured' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    if (action === 'list')     return await handleList(req, res, url);
    if (action === 'detail')   return await handleDetail(req, res, url);
    if (action === 'overview') return await handleOverview(req, res, url);
    if (action === 'insights') return await handleInsights(req, res, url);
    res.status(400).json({ error: 'unknown action — expected list | detail | overview | insights' });
  } catch (err) {
    console.error('[navigator-analytics]', req.url, err);
    res.status(500).json({ error: err.message || 'internal_error' });
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseBool(v) {
  return v === 'true' || v === '1';
}

function parseInt32(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function parseRange(url) {
  const { dateFrom: defFrom, dateTo: defTo } = defaultRange();
  return {
    dateFrom: url.searchParams.get('dateFrom') || defFrom,
    dateTo: url.searchParams.get('dateTo') || defTo,
  };
}

function evalsToScoreMap(evalRows) {
  const out = {};
  for (const row of evalRows) {
    if (!FIRST_CLASS_DIMENSIONS.includes(row.dimension)) continue;
    out[row.dimension] = {
      value: row.score_numeric,
      type: row.score_type,
    };
  }
  return out;
}

// ── list ───────────────────────────────────────────────────────────────────

async function handleList(req, res, url) {
  const branchId = await resolveBranchId(req);
  const { dateFrom, dateTo } = parseRange(url);
  const mode = url.searchParams.get('mode') || null;
  const device = url.searchParams.get('device') || null;
  const language = url.searchParams.get('language') || null;
  const reportedIssue = url.searchParams.get('reported_issue') || null;
  const topic = url.searchParams.get('topic') || null;
  const resolutionState = url.searchParams.get('resolution_state') || null;
  const lowScore = parseBool(url.searchParams.get('low_score'));
  const search = url.searchParams.get('search') || null;
  const page = Math.max(1, parseInt32(url.searchParams.get('page'), 1));
  const pageSize = Math.max(1, Math.min(100, parseInt32(url.searchParams.get('pageSize'), 25)));
  const offset = (page - 1) * pageSize;

  // Ensure summaries exist for the working set. To avoid a huge "ensure all"
  // pass on every request we compute lazily for conversations that fall in
  // the requested time window but have no summary yet — this is bounded by
  // the date range + branch filter.
  const missing = await sql`
    select c.id
    from conversations c
    left join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
      and (s.conversation_id is null or s.computed_version <> ${COMPUTED_VERSION})
    limit 200
  `;
  for (const m of missing) {
    try { await recomputeConversation(m.id); } catch { /* skip broken row */ }
  }

  const rows = await sql`
    select
      c.id, c.title, c.created_at,
      s.mode, s.device, s.language, s.primary_topic,
      s.message_count, s.tool_call_count,
      s.reported_issue, s.resolution_state, s.has_low_score,
      coalesce(
        jsonb_object_agg(
          e.dimension,
          jsonb_build_object('value', e.score_numeric, 'type', e.score_type)
        ) filter (where e.dimension in (
          'resolution','hallucination','factual_accuracy','friction','sentiment'
        )),
        '{}'::jsonb
      ) as scores
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    left join conversation_evals e on e.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
      and (${mode}::text is null            or s.mode = ${mode})
      and (${device}::text is null          or s.device = ${device})
      and (${language}::text is null        or s.language = ${language})
      and (${reportedIssue}::text is null   or s.reported_issue = ${reportedIssue})
      and (${topic}::text is null           or s.primary_topic = ${topic})
      and (${resolutionState}::text is null or s.resolution_state = ${resolutionState})
      and (${lowScore}::bool is not true    or s.has_low_score = true)
      and (${search}::text is null          or c.title ilike '%' || ${search} || '%')
    group by c.id, s.conversation_id
    order by c.created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const totalRows = await sql`
    select count(*)::int as n
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
      and (${mode}::text is null            or s.mode = ${mode})
      and (${device}::text is null          or s.device = ${device})
      and (${language}::text is null        or s.language = ${language})
      and (${reportedIssue}::text is null   or s.reported_issue = ${reportedIssue})
      and (${topic}::text is null           or s.primary_topic = ${topic})
      and (${resolutionState}::text is null or s.resolution_state = ${resolutionState})
      and (${lowScore}::bool is not true    or s.has_low_score = true)
      and (${search}::text is null          or c.title ilike '%' || ${search} || '%')
  `;

  res.status(200).json({
    page, pageSize,
    total: totalRows[0]?.n || 0,
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title || 'Untitled conversation',
      created_at: r.created_at,
      mode: r.mode,
      device: r.device,
      language: r.language,
      primary_topic: r.primary_topic,
      message_count: r.message_count,
      tool_call_count: r.tool_call_count,
      reported_issue: r.reported_issue,
      resolution_state: r.resolution_state,
      has_low_score: r.has_low_score,
      scores: r.scores || {},
    })),
  });
}

// ── detail ─────────────────────────────────────────────────────────────────

async function handleDetail(req, res, url) {
  const id = url.searchParams.get('id');
  if (!id) return res.status(400).json({ error: 'id required' });

  const convRows = await sql`select id, title, created_at, staffbase_branch_id from conversations where id = ${id}`;
  const conversation = convRows[0];
  if (!conversation) return res.status(404).json({ error: 'not_found' });

  await ensureSummary(id);
  const [summary, messages, evals] = await Promise.all([
    getSummary(id),
    getConversationMessages(id),
    getEvals(id),
  ]);

  const toolCalls = [];
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const c = m.content && typeof m.content === 'object' ? m.content : {};
    let parsedResult = c.content;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* keep string */ }
    }
    toolCalls.push({
      id: c.tool_call_id || m.id,
      name: c.name || null,
      result: parsedResult,
      ts: m.created_at,
    });
  }

  res.status(200).json({
    conversation,
    summary,
    messages,
    tool_calls: toolCalls,
    evals: evals.map((e) => ({
      dimension: e.dimension,
      type: e.score_type,
      score: e.score_numeric,
      label: e.score_label,
      flag: e.score_flag,
      reasoning: e.reasoning,
      evaluator: e.evaluator,
      source: e.source,
    })),
  });
}

// ── overview ───────────────────────────────────────────────────────────────

async function handleOverview(req, res, url) {
  const branchId = await resolveBranchId(req);
  const { dateFrom, dateTo } = parseRange(url);
  const cacheKey = `${branchId || ''}:${dateFrom}:${dateTo}`;
  const cached = OVERVIEW_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json(cached.value);
  }

  // Backfill any missing summaries in the window so KPIs reflect every visible
  // conversation. Bounded by the time filter + branch scope.
  const missing = await sql`
    select c.id
    from conversations c
    left join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
      and (s.conversation_id is null or s.computed_version <> ${COMPUTED_VERSION})
    limit 300
  `;
  for (const m of missing) {
    try { await recomputeConversation(m.id); } catch { /* skip */ }
  }

  const totalsRows = await sql`
    select
      count(*)::int                                as conversations,
      coalesce(sum(s.message_count), 0)::int       as messages,
      coalesce(sum(s.tool_call_count), 0)::int     as tool_calls
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
  `;
  const uniqueUsers = await sql`
    select count(distinct user_id)::int as n
    from conversations c
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
  `;

  const timeseries = await sql`
    select
      date_trunc('day', c.created_at) as day,
      count(*)::int                  as conversations,
      sum(case when s.resolution_state = 'resolved'  then 1 else 0 end)::int as resolved,
      sum(case when s.resolution_state = 'escalated' then 1 else 0 end)::int as escalated
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
    group by 1
    order by 1 asc
  `;

  const resolutionMix = await sql`
    select s.resolution_state, count(*)::int as n
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
    group by s.resolution_state
  `;

  const reportedIssues = await sql`
    select s.reported_issue, count(*)::int as n
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
    group by s.reported_issue
  `;

  const topTopics = await sql`
    select s.primary_topic as topic, count(*)::int as n
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
    group by s.primary_topic
    order by n desc
    limit 8
  `;

  const topUnanswered = await sql`
    select s.primary_topic as topic,
           count(*)::int as n,
           array_agg(c.id order by c.created_at desc) filter (where true) as sample_ids
    from conversations c
    join conversation_summary s on s.conversation_id = c.id
    left join conversation_evals e
      on e.conversation_id = c.id and e.dimension = 'resolution'
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
      and (s.resolution_state in ('unresolved','escalated') or e.score_numeric < 0.5)
    group by s.primary_topic
    order by n desc
    limit 5
  `;

  // Score distributions — p25/p50/p75 + tail %.
  const distRows = await sql`
    select
      dimension,
      percentile_cont(0.25) within group (order by score_numeric) as p25,
      percentile_cont(0.5)  within group (order by score_numeric) as p50,
      percentile_cont(0.75) within group (order by score_numeric) as p75,
      avg(case when dimension in ('resolution','factual_accuracy','sentiment') then case when score_numeric < 0.5 then 1.0 else 0.0 end
               when dimension in ('hallucination','friction')                  then case when score_numeric > 0.5 then 1.0 else 0.0 end
               else 0.0 end) as tail_pct
    from conversation_evals e
    join conversations c on c.id = e.conversation_id
    where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
      and c.created_at >= ${dateFrom}
      and c.created_at < ${dateTo}
      and e.dimension in ('resolution','hallucination','factual_accuracy','friction','sentiment')
      and e.score_numeric is not null
    group by dimension
  `;
  const scoreDistributions = {};
  for (const r of distRows) {
    const isInverted = r.dimension === 'hallucination' || r.dimension === 'friction';
    scoreDistributions[r.dimension] = {
      p25: r.p25, p50: r.p50, p75: r.p75,
      [isInverted ? 'high_pct' : 'low_pct']: r.tail_pct,
    };
  }

  // Normalise group-by rollups → percentages keyed by enum value.
  const total = totalsRows[0]?.conversations || 0;
  const normalize = (rows, field) => {
    const out = {};
    for (const r of rows) {
      out[r[field]] = total ? r.n / total : 0;
    }
    return out;
  };

  const value = {
    range: { dateFrom, dateTo },
    totals: {
      conversations: total,
      messages: totalsRows[0]?.messages || 0,
      tool_calls: totalsRows[0]?.tool_calls || 0,
      unique_users: uniqueUsers[0]?.n || 0,
    },
    timeseries: {
      granularity: 'day',
      points: timeseries.map((t) => ({
        date: t.day,
        conversations: t.conversations,
        resolved: t.resolved,
        escalated: t.escalated,
      })),
    },
    resolution_mix: normalize(resolutionMix, 'resolution_state'),
    reported_issues: normalize(reportedIssues, 'reported_issue'),
    top_topics: topTopics.map((t) => ({ topic: t.topic, count: t.n })),
    top_unanswered: topUnanswered.map((t) => ({
      topic: t.topic,
      count: t.n,
      sample_conversation_ids: (t.sample_ids || []).slice(0, 5),
    })),
    score_distributions: scoreDistributions,
  };

  OVERVIEW_CACHE.set(cacheKey, { value, expiresAt: Date.now() + OVERVIEW_TTL_MS });
  res.status(200).json(value);
}

// ── insights ───────────────────────────────────────────────────────────────

async function handleInsights(req, res, url) {
  const branchId = await resolveBranchId(req);
  const { dateFrom, dateTo } = parseRange(url);
  const cacheKey = `${branchId || ''}:${dateFrom}:${dateTo}`;
  const cached = INSIGHTS_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json(cached.value);
  }

  // connect_source: topic clusters with median resolution<0.5 AND most tool
  // calls returning empty arrays. Approximated here by joining resolution +
  // tool_call_count: a topic where avg resolution < 0.5 AND avg(tool_calls)>0.
  const connectSourceRows = await sql`
    with topic_stats as (
      select
        s.primary_topic as topic,
        count(*)::int as n,
        avg(coalesce(re.score_numeric, 0.5)) as avg_res,
        avg(s.tool_call_count) as avg_tools
      from conversations c
      join conversation_summary s on s.conversation_id = c.id
      left join conversation_evals re
        on re.conversation_id = c.id and re.dimension = 'resolution'
      where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
        and c.created_at >= ${dateFrom}
        and c.created_at < ${dateTo}
        and s.primary_topic <> 'Other'
      group by s.primary_topic
      having count(*) >= 5 and avg(coalesce(re.score_numeric, 0.5)) < 0.55
    )
    select topic, n, avg_res, avg_tools,
      (select array_agg(id) from (
         select c2.id from conversations c2
         join conversation_summary s2 on s2.conversation_id = c2.id
         where s2.primary_topic = topic_stats.topic
           and (${branchId}::text is null or c2.staffbase_branch_id = ${branchId})
           and c2.created_at >= ${dateFrom} and c2.created_at < ${dateTo}
         order by c2.created_at desc limit 5
       ) sample) as evidence_ids
    from topic_stats
    order by avg_res asc, n desc
    limit 3
  `;

  // edit_instructions: topics where friction is high or sentiment is low.
  const editInstructionsRows = await sql`
    with topic_stats as (
      select
        s.primary_topic as topic,
        count(*)::int as n,
        avg(coalesce(fr.score_numeric, 0)) as avg_friction,
        avg(coalesce(se.score_numeric, 0.6)) as avg_sentiment
      from conversations c
      join conversation_summary s on s.conversation_id = c.id
      left join conversation_evals fr on fr.conversation_id = c.id and fr.dimension = 'friction'
      left join conversation_evals se on se.conversation_id = c.id and se.dimension = 'sentiment'
      where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
        and c.created_at >= ${dateFrom}
        and c.created_at < ${dateTo}
        and s.primary_topic <> 'Other'
      group by s.primary_topic
      having count(*) >= 5
         and (avg(coalesce(fr.score_numeric, 0)) > 0.55 or avg(coalesce(se.score_numeric, 0.6)) < 0.45)
    )
    select topic, n, avg_friction, avg_sentiment,
      (select array_agg(id) from (
         select c2.id from conversations c2
         join conversation_summary s2 on s2.conversation_id = c2.id
         where s2.primary_topic = topic_stats.topic
           and (${branchId}::text is null or c2.staffbase_branch_id = ${branchId})
           and c2.created_at >= ${dateFrom} and c2.created_at < ${dateTo}
         order by c2.created_at desc limit 5
       ) sample) as evidence_ids
    from topic_stats
    order by avg_friction desc nulls last
    limit 3
  `;

  // draft_faq: same topic, recurring questions (short first-message bigram),
  // mostly resolved without tool calls — promote to FAQ.
  const draftFaqRows = await sql`
    with first_user_msg as (
      select distinct on (m.conversation_id)
        m.conversation_id,
        regexp_replace(lower(coalesce(m.content->>'text', m.content->>'content', '')), '[^a-z0-9 ]+', ' ', 'g') as norm
      from messages m
      where m.role = 'user'
      order by m.conversation_id, m.created_at asc
    ),
    bigrams as (
      select
        s.primary_topic as topic,
        split_part(fum.norm, ' ', 1) || ' ' || split_part(fum.norm, ' ', 2) as bigram,
        c.id as conv_id
      from conversations c
      join conversation_summary s on s.conversation_id = c.id
      join first_user_msg fum on fum.conversation_id = c.id
      where (${branchId}::text is null or c.staffbase_branch_id = ${branchId})
        and c.created_at >= ${dateFrom}
        and c.created_at < ${dateTo}
        and s.tool_call_count <= 1
        and s.resolution_state = 'resolved'
        and s.primary_topic <> 'Other'
    )
    select topic, bigram, count(*)::int as n,
           array_agg(conv_id) as evidence_ids
    from bigrams
    where length(trim(bigram)) > 3
    group by topic, bigram
    having count(*) >= 3
    order by n desc
    limit 3
  `;

  const insights = [];
  for (const r of connectSourceRows) {
    insights.push({
      id: `ins_connect_${r.topic.toLowerCase()}`,
      title: `${r.n} conversation${r.n === 1 ? '' : 's'} on ${r.topic} couldn't reach a confident answer`,
      severity: 'high',
      topic: r.topic,
      evidence_conversation_ids: r.evidence_ids || [],
      recommended_action: 'connect_source',
      action_payload: { topic: r.topic, suggested_source_kind: kindForTopic(r.topic) },
      rationale: `Median resolution score is ${Math.round((r.avg_res || 0) * 100)}/100 across ${r.n} conversations — connect a ${r.topic} source so the assistant has authoritative content to cite.`,
    });
  }
  for (const r of editInstructionsRows) {
    insights.push({
      id: `ins_friction_${r.topic.toLowerCase()}`,
      title: `Users hit friction on ${r.topic} (${r.n} conversation${r.n === 1 ? '' : 's'})`,
      severity: 'medium',
      topic: r.topic,
      evidence_conversation_ids: r.evidence_ids || [],
      recommended_action: 'edit_instructions',
      action_payload: { topic: r.topic },
      rationale: `Average friction ${Math.round((r.avg_friction || 0) * 100)}/100, sentiment ${Math.round((r.avg_sentiment || 0) * 100)}/100. Tightening the assistant's instructions for ${r.topic} should reduce back-and-forth.`,
    });
  }
  for (const r of draftFaqRows) {
    insights.push({
      id: `ins_faq_${r.topic.toLowerCase()}_${(r.bigram || '').replace(/\s+/g, '_')}`,
      title: `"${r.bigram}" recurred ${r.n}× — promote to FAQ`,
      severity: 'low',
      topic: r.topic,
      evidence_conversation_ids: r.evidence_ids || [],
      recommended_action: 'draft_faq',
      action_payload: { topic: r.topic, question_seed: r.bigram },
      rationale: `Same opener appeared ${r.n} times this period; all resolved without tool calls. A canonical FAQ skips the LLM round-trip.`,
    });
  }

  const value = { insights };
  INSIGHTS_CACHE.set(cacheKey, { value, expiresAt: Date.now() + INSIGHTS_TTL_MS });
  res.status(200).json(value);
}

function kindForTopic(topic) {
  switch (topic) {
    case 'HR': return 'hris';
    case 'Travel': return 'policy_doc';
    case 'IT': return 'itsm';
    case 'Compensation': return 'hris';
    case 'Events': return 'intranet_page';
    case 'Policy': return 'policy_doc';
    case 'Operations': return 'intranet_page';
    default: return 'generic';
  }
}
