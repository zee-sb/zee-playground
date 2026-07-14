// Trace Doctor — in-app route backend.
//
//   POST /api/trace-doctor?action=analyze   body { traces: [...] } or { trace: ... }
//        → analyze each trace, UPSERT (dedupe by trace id), return per-trace
//          results + an aggregate batch report.
//   GET  /api/trace-doctor?action=list&q=&status=&env=&limit=
//        → search / browse stored traces (newest first) + stats + env list.
//   GET  /api/trace-doctor?action=get&id=<uuid>
//        → one stored trace with its full markdown report + signals.
//   POST /api/trace-doctor?action=delete  body { id }
//        → remove one stored trace.
//
// Auth: a light shared-password gate. The frontend sends the static password
// (also held in localStorage) as the `x-td-pass` header. Override the expected
// value with the TRACE_DOCTOR_PASS env var; defaults to the agreed static one so
// it works out of the box.

import crypto from 'node:crypto';
import { sql, dbConfigured } from '../db.mjs';
import { batchReport } from '../trace-doctor-engine.mjs';
import { analyzeOneDeep } from '../trace-doctor-llm.mjs';
import { listEnvironments, listTraces, getTrace, listSessions, getSession, checkHealth, isConfigured as langfuseConfigured } from '../langfuse.mjs';

const STATIC_PASS = process.env.TRACE_DOCTOR_PASS || 'Staffbase2026!!';

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (typeof req.body === 'string' && !raw) raw = req.body;
  return raw ? JSON.parse(raw) : {};
}

function dedupeKey(sig, raw) {
  if (sig.trace_id) return String(sig.trace_id);
  const hash = crypto.createHash('sha1').update(JSON.stringify(raw)).digest('hex').slice(0, 12);
  return `${sig.session_id || 'nosession'}:${sig.environment || 'noenv'}:${hash}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-td-pass');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // Password gate (soft — it's a prototype convenience, not real security).
  const pass = req.headers['x-td-pass'] || '';
  if (pass !== STATIC_PASS) {
    res.status(401).json({ error: 'unauthorized', message: 'Bad or missing password.' });
    return;
  }

  if (!dbConfigured()) {
    res.status(503).json({ error: 'db_unconfigured', message: 'DATABASE_URL is not set on this deployment, so traces cannot be stored or searched.' });
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action') || (req.method === 'GET' ? 'list' : 'analyze');

    if (action === 'analyze') return await handleAnalyze(req, res);
    if (action === 'list')    return await handleList(req, res, url);
    if (action === 'get')     return await handleGet(req, res, url);
    if (action === 'delete')  return await handleDelete(req, res);
    // Langfuse — pull traces directly from a configured environment.
    if (action === 'langfuse-envs') return await handleLangfuseEnvs(req, res);
    if (action === 'langfuse-sessions') return await handleLangfuseSessions(req, res, url);
    if (action === 'langfuse-list') return await handleLangfuseList(req, res, url);
    if (action === 'langfuse-pull') return await handleLangfusePull(req, res);
    res.status(400).json({ error: 'unknown_action', message: 'expected analyze | list | get | delete | langfuse-envs | langfuse-sessions | langfuse-list | langfuse-pull' });
  } catch (err) {
    console.error('[trace-doctor]', req.url, err);
    res.status(500).json({ error: 'internal_error', message: err.message || String(err) });
  }
}

// --------------------------------------------------------------------------- //
async function handleAnalyze(req, res) {
  const body = await readJsonBody(req);
  let traces = body.traces;
  if (!traces && body.trace != null) traces = [body.trace];
  if (typeof traces === 'string') { try { traces = JSON.parse(traces); } catch { /* leave */ } }
  if (!Array.isArray(traces)) {
    res.status(400).json({ error: 'bad_input', message: 'Provide { traces: [...] } or { trace: {...} }.' });
    return;
  }
  const uploadedBy = String(body.uploadedBy || '').slice(0, 120) || null;
  const payload = await analyzeAndStoreTraces(traces, uploadedBy);
  res.status(200).json(payload);
}

// Shared analyze + upsert pipeline. Used by both the manual upload path
// (handleAnalyze) and the Langfuse pull path (handleLangfusePull).
async function analyzeAndStoreTraces(traces, uploadedBy) {
  // Each trace does its own LLM round-trip + DB upsert, so process the batch
  // concurrently rather than one-at-a-time — sequential would multiply the
  // per-trace LLM latency by the batch size and risk the function timeout.
  const perTrace = async (raw) => {
    let parsed = raw;
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { /* engine will cope */ } }
    const { sig, findings, status, summary, report_md } = await analyzeOneDeep(parsed);
    const key = dedupeKey(sig, parsed);
    const traceTs = sig.timestamp ? new Date(sig.timestamp) : null;

    const upserted = await sql`
      insert into trace_doctor_traces
        (dedupe_key, trace_id, session_id, environment, user_id, question, trace_ts,
         status, summary, findings, signals, report_md, raw_trace, uploaded_by, updated_at)
      values
        (${key}, ${sig.trace_id || null}, ${sig.session_id || null}, ${sig.environment || null},
         ${sig.user_id || null}, ${sig.input || null}, ${traceTs},
         ${status}, ${summary}, ${JSON.stringify(findings)}::jsonb, ${JSON.stringify(sig)}::jsonb,
         ${report_md}, ${JSON.stringify(parsed)}::jsonb, ${uploadedBy}, now())
      on conflict (dedupe_key) do update set
        trace_id    = excluded.trace_id,
        session_id  = excluded.session_id,
        environment = excluded.environment,
        user_id     = excluded.user_id,
        question    = excluded.question,
        trace_ts    = excluded.trace_ts,
        status      = excluded.status,
        summary     = excluded.summary,
        findings    = excluded.findings,
        signals     = excluded.signals,
        report_md   = excluded.report_md,
        raw_trace   = excluded.raw_trace,
        updated_at  = now()
      returning id, (xmax = 0) as was_inserted
    `;
    const row = upserted[0];
    return {
      sig, findings, status,
      inserted: !!row?.was_inserted,
      result: {
        id: row?.id, dedupe_key: key, deduped: !row?.was_inserted,
        trace_id: sig.trace_id, session_id: sig.session_id, environment: sig.environment,
        question: sig.input, status, summary, findings, report_md,
      },
    };
  };

  const settled = await Promise.allSettled(traces.map(perTrace));

  const results = [];
  const rowsForBatch = [];
  let inserted = 0, updated = 0, failed = 0;
  for (const s of settled) {
    if (s.status === 'rejected') {
      failed += 1;
      results.push({ error: `analysis_failed: ${s.reason?.message || String(s.reason)}` });
      continue;
    }
    const { sig, findings, status, inserted: wasInserted, result } = s.value;
    rowsForBatch.push({ sig, findings, status });
    if (wasInserted) inserted += 1; else updated += 1;
    results.push(result);
  }

  const batch_report_md = rowsForBatch.length > 1 ? batchReport(rowsForBatch) : null;
  return { count: results.length, inserted, updated, failed, results, batch_report_md };
}

// --------------------------------------------------------------------------- //
// Langfuse: list configured environments (metadata only — no keys).
async function handleLangfuseEnvs(req, res) {
  res.status(200).json({ configured: langfuseConfigured(), environments: listEnvironments() });
}

// Langfuse: browse SESSIONS (the team's "conversations") in one environment.
async function handleLangfuseSessions(req, res, url) {
  const env = (url.searchParams.get('env') || '').trim();
  if (!env) { res.status(400).json({ error: 'missing_env' }); return; }
  const opts = {
    limit: parseInt(url.searchParams.get('limit'), 10) || 25,
    page: parseInt(url.searchParams.get('page'), 10) || 1,
  };
  const tenant = url.searchParams.get('environment');
  if (tenant) opts.environment = tenant;
  const fromTimestamp = url.searchParams.get('fromTimestamp');
  if (fromTimestamp) opts.fromTimestamp = fromTimestamp;
  try {
    const { data, meta } = await listSessions(env, opts);
    res.status(200).json({ env, sessions: data, meta });
  } catch (err) {
    res.status(502).json({ error: 'langfuse_error', message: err.message, status: err.status || null });
  }
}

// Langfuse: browse traces in one environment (metadata + preview) with filters.
async function handleLangfuseList(req, res, url) {
  const env = (url.searchParams.get('env') || '').trim();
  if (!env) { res.status(400).json({ error: 'missing_env' }); return; }
  const opts = {
    limit: parseInt(url.searchParams.get('limit'), 10) || 25,
    page: parseInt(url.searchParams.get('page'), 10) || 1,
  };
  for (const k of ['name', 'environment', 'sessionId', 'userId', 'fromTimestamp', 'toTimestamp']) {
    const v = url.searchParams.get(k);
    if (v) opts[k] = v;
  }
  const tags = url.searchParams.getAll('tags');
  if (tags.length) opts.tags = tags;
  try {
    const { data, meta } = await listTraces(env, opts);
    res.status(200).json({ env, traces: data, meta });
  } catch (err) {
    res.status(502).json({ error: 'langfuse_error', message: err.message, status: err.status || null });
  }
}

// Langfuse: fetch full traces by id from an environment, then analyze + store
// through the same pipeline the upload path uses. Also accepts { health: true }
// to probe connectivity for one env.
async function handleLangfusePull(req, res) {
  const body = await readJsonBody(req);
  const env = String(body.env || '').trim();
  if (!env) { res.status(400).json({ error: 'missing_env' }); return; }
  if (body.health) { res.status(200).json({ env, ...(await checkHealth(env)) }); return; }

  // Two ways to identify what to pull:
  //   { sessionId } — a whole conversation (resolve to its member trace ids), OR
  //   { sessionIds: [...] } — several conversations, OR
  //   { ids: [...] } — explicit trace ids.
  let ids = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
  const sessionIds = body.sessionId ? [body.sessionId]
    : (Array.isArray(body.sessionIds) ? body.sessionIds.slice(0, 25) : []);
  const sessionErrors = [];
  if (sessionIds.length) {
    const resolved = await Promise.allSettled(sessionIds.map((sid) => getSession(env, sid)));
    for (let i = 0; i < resolved.length; i++) {
      if (resolved[i].status === 'fulfilled') ids.push(...(resolved[i].value.traceIds || []));
      else sessionErrors.push({ sessionId: sessionIds[i], error: resolved[i].reason?.message || 'session_fetch_failed' });
    }
    ids = [...new Set(ids)].slice(0, 100);
  }
  if (!ids.length) {
    res.status(400).json({ error: 'no_ids', message: 'Provide { env, sessionId } or { env, ids: [...] }.', sessionErrors });
    return;
  }

  // Fetch full traces (with observations) concurrently; skip any that fail.
  const fetched = await Promise.allSettled(ids.map((id) => getTrace(env, id)));
  const traces = [];
  const fetchErrors = [];
  for (let i = 0; i < fetched.length; i++) {
    if (fetched[i].status === 'fulfilled' && fetched[i].value) traces.push(fetched[i].value);
    else fetchErrors.push({ id: ids[i], error: fetched[i].reason?.message || 'fetch_failed' });
  }
  if (!traces.length) {
    res.status(502).json({ error: 'langfuse_fetch_failed', fetchErrors });
    return;
  }
  const payload = await analyzeAndStoreTraces(traces, `langfuse:${env}`);
  res.status(200).json({ env, fetched: traces.length, fetchErrors, sessionErrors, ...payload });
}

// --------------------------------------------------------------------------- //
async function handleList(req, res, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const env = (url.searchParams.get('env') || '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 300, 1), 1000);
  const like = `%${q}%`;

  const rows = await sql`
    select id, trace_id, session_id, environment, user_id, question, status, summary,
           findings, trace_ts, created_at, updated_at
    from trace_doctor_traces
    where (${q} = '' OR question ILIKE ${like} OR coalesce(environment,'') ILIKE ${like}
           OR coalesce(trace_id,'') ILIKE ${like} OR coalesce(session_id,'') ILIKE ${like}
           OR coalesce(summary,'') ILIKE ${like})
      AND (${status} = '' OR status = ${status})
      AND (${env} = '' OR environment = ${env})
    order by created_at desc
    limit ${limit}
  `;
  const statsRows = await sql`select status, count(*)::int as n from trace_doctor_traces group by status`;
  const envRows = await sql`select distinct environment from trace_doctor_traces where environment is not null order by 1`;
  const totalRow = await sql`select count(*)::int as n from trace_doctor_traces`;

  const stats = {};
  for (const r of statsRows) stats[r.status] = r.n;
  res.status(200).json({
    rows,
    total: totalRow[0]?.n || 0,
    stats,
    environments: envRows.map((r) => r.environment),
  });
}

// --------------------------------------------------------------------------- //
async function handleGet(req, res, url) {
  const id = url.searchParams.get('id');
  if (!id) { res.status(400).json({ error: 'missing_id' }); return; }
  const rows = await sql`
    select id, trace_id, session_id, environment, user_id, question, status, summary,
           findings, signals, report_md, trace_ts, created_at, updated_at
    from trace_doctor_traces where id = ${id}
  `;
  if (!rows.length) { res.status(404).json({ error: 'not_found' }); return; }
  res.status(200).json({ trace: rows[0] });
}

// --------------------------------------------------------------------------- //
async function handleDelete(req, res) {
  const body = await readJsonBody(req);
  const id = body.id;
  if (!id) { res.status(400).json({ error: 'missing_id' }); return; }
  await sql`delete from trace_doctor_traces where id = ${id}`;
  res.status(200).json({ ok: true });
}
