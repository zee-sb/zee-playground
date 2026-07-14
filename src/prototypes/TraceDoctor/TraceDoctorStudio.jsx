import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Stethoscope, Upload, Search, LogOut, RefreshCw, FileJson,
  AlertTriangle, X, ChevronLeft, Layers, Trash2,
  Cloud, Download, CheckSquare, Square, Loader2,
} from 'lucide-react';

// The static password is intentionally client-side (a convenience gate, not real
// security). It is stored in localStorage and echoed to the API as x-td-pass.
const STATIC_PASS = 'Staffbase2026!!';
const PASS_KEY = 'traceDoctorPass';

const STATUS_STYLE = {
  NEEDS_FIX:  'bg-red-100 text-red-700',
  MINOR:      'bg-amber-100 text-amber-700',
  HEALTHY:    'bg-emerald-100 text-emerald-700',
  UNSCORABLE: 'bg-zinc-200 text-zinc-600',
};
const SEV_STYLE = {
  high:   { card: 'border-red-200 bg-red-50',    dot: 'bg-red-500' },
  medium: { card: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500' },
  low:    { card: 'border-yellow-200 bg-yellow-50', dot: 'bg-yellow-400' },
};
const LAYER_LABEL = {
  prompt: 'Prompt engineering', query: 'Search query', results: 'Retrieval',
  tools: 'Tool calls', sources: 'Sources / grounding', eval: 'Eval pipeline',
};
const STATUSES = ['NEEDS_FIX', 'MINOR', 'HEALTHY', 'UNSCORABLE'];

function api(path, { method = 'GET', body } = {}) {
  const pass = (typeof window !== 'undefined' && localStorage.getItem(PASS_KEY)) || '';
  return fetch(`/api/trace-doctor${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-td-pass': pass },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || data.error || `HTTP ${r.status}`);
    return data;
  });
}

// ── Password gate ─────────────────────────────────────────────────────
function Gate({ onAuthed }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (val === STATIC_PASS) {
      localStorage.setItem(PASS_KEY, val);
      onAuthed();
    } else {
      setErr('Incorrect password.');
    }
  };
  return (
    <div className="min-h-screen bg-[#F5F5F7] grid place-items-center px-6">
      <form onSubmit={submit} className="bg-white border border-[#E4E4E7] rounded-2xl shadow-sm w-full max-w-sm p-8">
        <div className="w-11 h-11 rounded-xl bg-[#00C7B2] grid place-items-center mb-5">
          <Stethoscope size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-[#18181B]">Trace Doctor</h1>
        <p className="text-[14px] text-[#71717A] mt-1 mb-6">Enter the team password to continue.</p>
        <input
          type="password" value={val} autoFocus
          onChange={(e) => { setVal(e.target.value); setErr(''); }}
          placeholder="Password"
          className="w-full border border-[#E4E4E7] rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#00C7B2] focus:ring-2 focus:ring-[#00C7B2]/20"
        />
        {err && <p className="text-[13px] text-red-600 mt-2">{err}</p>}
        <button type="submit" className="mt-5 w-full bg-[#111827] text-white rounded-lg py-2.5 text-[14px] font-semibold hover:bg-black transition-colors">
          Unlock
        </button>
      </form>
    </div>
  );
}

// ── Findings + scores rendering ───────────────────────────────────────
function ScoreChips({ signals }) {
  const scores = signals?.scores || {};
  const parseFail = new Set(signals?.parse_fail_scores || []);
  const keys = ['resolution', 'hallucination', 'factual_accuracy', 'error_severity', 'friction',
    'repeated_question_count', 'Prompt_Injection_Resistance', 'language_switch_flag', 'sentiment'];
  const chips = keys.filter((k) => scores[k] && scores[k].mean != null);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((k) => (
        <span key={k} className={`text-[11px] px-2 py-1 rounded-md font-medium ${parseFail.has(k) ? 'bg-zinc-200 text-zinc-500 line-through' : 'bg-[#F1F5F9] text-[#475569]'}`}>
          {k}={scores[k].mean}{parseFail.has(k) ? ' ⚠' : ''}
        </span>
      ))}
    </div>
  );
}

function FindingCard({ f }) {
  const sev = SEV_STYLE[f.severity] || SEV_STYLE.low;
  return (
    <div className={`border rounded-xl p-4 ${sev.card}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{LAYER_LABEL[f.layer] || f.layer}</span>
        {f.source === 'llm' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-violet-100 text-violet-700">AI</span>
        )}
        <span className="text-[10px] text-[#94A3B8] ml-auto">{f.severity} · {f.confidence}</span>
      </div>
      <div className="text-[14px] font-semibold text-[#18181B] mb-2">{f.title}</div>
      <div className="text-[13px] text-[#475569] leading-relaxed mb-2"><b className="text-[#334155]">Evidence:</b> {f.evidence}</div>
      <div className="text-[13px] text-[#475569] leading-relaxed"><b className="text-[#334155]">Fix:</b> {f.recommended_fix}</div>
    </div>
  );
}

function AINarrative({ llm }) {
  if (!llm || !llm.narrative) return null;
  return (
    <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-violet-700 mb-1.5">
        {llm.error ? 'AI review unavailable' : 'Root cause (AI reasoning)'}
      </div>
      <div className="text-[13px] text-[#334155] leading-relaxed">{llm.narrative}</div>
    </div>
  );
}

function SystemPromptReview({ llm }) {
  const issues = llm?.system_prompt_review?.issues;
  if (!issues || !issues.length) return null;
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-2">System prompt review</div>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className="text-[13px] text-[#475569] leading-relaxed pl-3 border-l-2 border-violet-200">{issue}</li>
        ))}
      </ul>
    </div>
  );
}

// Deterministic tool & retrieval activity (from signals.tool_activity) — the
// concrete evidence behind the tool/retrieval/grounding findings.
function ToolActivity({ act }) {
  if (!act || !act.counts?.total) return null;
  const g = act.grounding || {};
  const Chip = ({ tone = 'zinc', children }) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${tone === 'red' ? 'bg-red-100 text-red-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : tone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>{children}</span>
  );
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-2">Tool &amp; retrieval</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip>{act.counts.search} search{act.counts.search === 1 ? '' : 'es'}</Chip>
        <Chip>{g.retrievedCount} retrieved</Chip>
        <Chip tone={act.counts.display ? 'green' : 'zinc'}>{act.counts.display} cited</Chip>
        {act.counts.selectAgent ? <Chip>{act.counts.selectAgent} selectAgent</Chip> : null}
        {g.citedNotRetrieved?.length ? <Chip tone="red">{g.citedNotRetrieved.length} cited not retrieved</Chip> : null}
        {act.failures?.length ? <Chip tone="red">{act.failures.length} tool failure{act.failures.length === 1 ? '' : 's'}</Chip> : null}
      </div>

      <div className="space-y-2">
        {act.searches.map((s, i) => (
          <div key={i} className="border border-[#E4E4E7] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Search size={13} className="text-[#94A3B8]" />
              <span className="text-[11px] font-semibold text-[#334155]">Search {i + 1}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${s.empty ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {s.resultCount == null ? '?' : s.resultCount} result{s.resultCount === 1 ? '' : 's'}{s.empty ? ' · empty' : ''}
              </span>
              {s.publishedAfter && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500">after {String(s.publishedAfter).slice(0, 10)}</span>}
            </div>
            {s.semanticQuery && <div className="text-[12px] text-[#71717A] font-mono mb-1 break-words">“{s.semanticQuery}”</div>}
            {s.keywordTerms?.length ? <div className="text-[11px] text-[#94A3B8] mb-1">keywords: {s.keywordTerms.join(', ')}</div> : null}
            {s.titles?.length ? (
              <ul className="mt-1 space-y-0.5">
                {s.titles.slice(0, 5).map((t, j) => <li key={j} className="text-[12px] text-[#475569] truncate">• {t}</li>)}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {act.displayed?.length ? (
        <div className="mt-2 border border-[#E4E4E7] rounded-lg p-3">
          <div className="text-[11px] font-semibold text-[#334155] mb-1.5">Cited sources ({act.displayed.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {act.displayed.map((d, i) => {
              const bad = (g.citedNotRetrieved || []).some((t) => (t || '').toLowerCase().trim() === (d.title || '').toLowerCase().trim());
              return (
                <span key={i} className={`text-[11px] px-2 py-0.5 rounded-md ${bad ? 'bg-red-100 text-red-700 line-through decoration-red-400' : 'bg-[#F1F5F9] text-[#475569]'}`} title={bad ? 'Not returned by any search — ungrounded citation' : ''}>
                  {String(d.title || '?').slice(0, 48)}
                </span>
              );
            })}
          </div>
          {g.citedNotRetrieved?.length ? (
            <div className="mt-2 text-[12px] text-red-600 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Struck-through sources were cited but never returned by a search — ungrounded citations.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchCallReview({ llm, searchCalls }) {
  const review = llm?.search_call_review;
  if (!review || !review.length) return null;
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-2">Search calls reviewed</div>
      <div className="space-y-2">
        {review.map((r, i) => {
          const call = searchCalls?.[r.index];
          return (
            <div key={i} className="border border-[#E4E4E7] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-[#334155]">Call {r.index + 1}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${r.query_quality === 'good' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.query_quality} query</span>
                {r.root_cause !== 'none' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600">root: {r.root_cause}</span>
                )}
              </div>
              {call?.query?.semanticQuery && (
                <div className="text-[12px] text-[#71717A] font-mono truncate mb-1">query: {call.query.semanticQuery}</div>
              )}
              <div className="text-[13px] text-[#475569]">{r.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TraceDetail({ id, onClose }) {
  const [trace, setTrace] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setTrace(null); setErr('');
    api(`?action=get&id=${encodeURIComponent(id)}`)
      .then((d) => live && setTrace(d.trace))
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [id]);

  if (err) return <div className="p-8 text-red-600 text-[14px]">Couldn’t load trace: {err}</div>;
  if (!trace) return <div className="p-8 text-[#71717A] text-[14px]">Loading…</div>;

  const findings = trace.findings || [];
  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E4E4E7] px-6 py-4 flex items-center gap-3">
        <button onClick={onClose} className="lg:hidden text-[#71717A] hover:text-black"><ChevronLeft size={20} /></button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-[#18181B]">{trace.environment || '—'}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${STATUS_STYLE[trace.status] || ''}`}>{trace.status}</span>
          </div>
          <div className="text-[12px] text-[#94A3B8] font-mono truncate">{trace.trace_id || trace.id}</div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1">Question</div>
          <div className="text-[14px] text-[#334155]">{trace.question || '—'}</div>
        </div>
        <AINarrative llm={trace.signals?.llm} />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-2">Eval scores</div>
          <ScoreChips signals={trace.signals} />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-2">
            Findings ({findings.length}) — most severe first
          </div>
          <div className="space-y-2.5">
            {findings.length ? findings.map((f, i) => <FindingCard key={i} f={f} />)
              : <div className="text-[14px] text-emerald-600">✅ No problems detected.</div>}
          </div>
        </div>
        <ToolActivity act={trace.signals?.tool_activity} />
        <SystemPromptReview llm={trace.signals?.llm} />
        <SearchCallReview llm={trace.signals?.llm} searchCalls={trace.signals?.llm?.search_calls} />
        <details className="border border-[#E4E4E7] rounded-xl">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-[#475569]">Full report (markdown)</summary>
          <div className="px-5 py-4 prose prose-sm max-w-none text-[13px] border-t border-[#F1F5F9]">
            <Markdown>{trace.report_md || ''}</Markdown>
          </div>
        </details>
      </div>
    </div>
  );
}

// ── Langfuse pull panel ───────────────────────────────────────────────
// The team identifies a conversation by its Langfuse SESSION id. This panel
// browses sessions (conversations) in a configured environment, or pulls one
// directly by session id, then analyzes + stores through the same pipeline as
// upload. A session is resolved server-side to its member traces.
function LangfusePanel({ onDone }) {
  const [envs, setEnvs] = useState(null);       // null = loading, [] = not configured
  const [env, setEnv] = useState('');
  const [tenant, setTenant] = useState('');     // Langfuse `environment` field = tenant slug
  const [sessionId, setSessionId] = useState(''); // paste to pull one conversation directly
  const [sessions, setSessions] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [browsing, setBrowsing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('?action=langfuse-envs')
      .then((d) => { setEnvs(d.environments || []); if (d.environments?.[0]) setEnv(d.environments[0].id); })
      .catch(() => setEnvs([]));
  }, []);

  const browse = async () => {
    if (!env) return;
    setBrowsing(true); setErr(''); setMsg(null); setSel(new Set());
    try {
      const params = new URLSearchParams({ action: 'langfuse-sessions', env, limit: '25' });
      if (tenant.trim()) params.set('environment', tenant.trim());
      const d = await api(`?${params.toString()}`);
      setSessions(d.sessions || []);
      if (!(d.sessions || []).length) setErr('No conversations found. Try a different tenant or environment.');
    } catch (e) { setErr(e.message); }
    finally { setBrowsing(false); }
  };

  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = sessions.length > 0 && sel.size === sessions.length;
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(sessions.map((s) => s.id)));

  const runPull = async (body, resetSel) => {
    setPulling(true); setErr(''); setMsg(null);
    try {
      const res = await api('?action=langfuse-pull', { method: 'POST', body: { env, ...body } });
      const brk = (res.results || []).reduce((a, r) => { if (r.status) a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
      setMsg({ ...res, brk });
      if (resetSel) setSel(new Set());
      onDone && onDone();
    } catch (e) { setErr(e.message); }
    finally { setPulling(false); }
  };

  const pullSelected = () => { if (sel.size) runPull({ sessionIds: [...sel] }, true); };
  const pullBySessionId = () => { const s = sessionId.trim(); if (s) runPull({ sessionId: s }, false); };

  if (envs === null) return null;                     // still loading — render nothing
  if (!envs.length) {
    return (
      <div className="border border-[#E4E4E7] rounded-2xl p-4 bg-white text-[12px] text-[#94A3B8] flex items-center gap-2">
        <Cloud size={15} /> Langfuse not configured on this deployment (set LANGFUSE_ENVIRONMENTS).
      </div>
    );
  }

  return (
    <div className="border border-[#E4E4E7] rounded-2xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Cloud size={17} className="text-[#00C7B2]" />
        <span className="text-[14px] font-semibold text-[#334155]">Pull from Langfuse</span>
        <span className="text-[11px] text-[#94A3B8] ml-auto">by conversation (session)</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={env} onChange={(e) => setEnv(e.target.value)}
          className="text-[12px] border border-[#E4E4E7] rounded-lg px-2 py-2 text-[#334155] outline-none focus:border-[#00C7B2]">
          {envs.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="tenant (e.g. fressnapf)"
          className="text-[12px] border border-[#E4E4E7] rounded-lg px-2 py-2 outline-none focus:border-[#00C7B2]" />
      </div>

      {/* Direct pull by session id — the team's conversation identifier. */}
      <div className="flex items-center gap-2 mb-3">
        <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="paste a session id (conversation)"
          onKeyDown={(e) => { if (e.key === 'Enter') pullBySessionId(); }}
          className="flex-1 text-[12px] font-mono border border-[#E4E4E7] rounded-lg px-2 py-2 outline-none focus:border-[#00C7B2]" />
        <button onClick={pullBySessionId} disabled={pulling || !env || !sessionId.trim()}
          className="bg-[#00C7B2] text-white rounded-lg px-3 py-2 text-[12px] font-semibold disabled:opacity-40 flex items-center gap-1.5">
          {pulling ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}Pull
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="h-px bg-[#F1F5F9] flex-1" />
        <span className="text-[10.5px] uppercase tracking-wide text-[#CBD5E1]">or browse recent conversations</span>
        <div className="h-px bg-[#F1F5F9] flex-1" />
      </div>
      <button onClick={browse} disabled={browsing || !env}
        className="w-full bg-[#111827] text-white rounded-lg px-3 py-2 text-[12px] font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5 mb-3">
        {browsing ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Browse recent conversations
      </button>

      {sessions.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <button onClick={toggleAll} className="text-[11px] text-[#64748B] flex items-center gap-1.5 hover:text-black">
              {allSelected ? <CheckSquare size={13} /> : <Square size={13} />} Select all ({sessions.length})
            </button>
            <span className="text-[11px] text-[#94A3B8]">{sel.size} selected</span>
          </div>
          <div className="max-h-[260px] overflow-y-auto space-y-1 mb-3 pr-1">
            {sessions.map((s) => {
              const on = sel.has(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 border flex items-start gap-2 ${on ? 'border-[#00C7B2] bg-[#F0FDFA]' : 'border-[#F1F5F9] bg-[#F8FAFC] hover:border-[#CBD5E1]'}`}>
                  {on ? <CheckSquare size={14} className="text-[#00C7B2] mt-0.5 shrink-0" /> : <Square size={14} className="text-[#CBD5E1] mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-[#334155] font-mono truncate">{s.id}</span>
                    <span className="block text-[10.5px] text-[#94A3B8] truncate">
                      {s.environment || '—'} · {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={pullSelected} disabled={pulling || !sel.size}
            className="w-full bg-[#00C7B2] text-white rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {pulling ? <><Loader2 size={14} className="animate-spin" />Pulling & analyzing…</> : <><Download size={14} />Pull & analyze {sel.size || ''} conversation{sel.size === 1 ? '' : 's'}</>}
          </button>
        </>
      )}

      {err && <div className="mt-3 text-[13px] text-red-600 flex items-start gap-1.5"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{err}</div>}
      {msg && (
        <div className="mt-3 text-[13px] text-[#334155] bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          Pulled <b>{msg.fetched}</b> trace{msg.fetched === 1 ? '' : 's'} from {msg.env} — <b>{msg.inserted}</b> new, <b>{msg.updated}</b> updated{msg.failed ? `, ${msg.failed} failed` : ''}.
          {' '}Breakdown: {Object.entries(msg.brk).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}.
          {(msg.sessionErrors?.length || msg.fetchErrors?.length) ? <span className="text-amber-600"> ({(msg.sessionErrors?.length || 0) + (msg.fetchErrors?.length || 0)} skipped)</span> : null}
        </div>
      )}
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────
function UploadPanel({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const analyze = async (traces) => {
    if (!traces.length) { setErr('No valid trace JSON found.'); return; }
    setBusy(true); setErr(''); setMsg(null);
    try {
      const res = await api('?action=analyze', { method: 'POST', body: { traces } });
      const brk = res.results.reduce((a, r) => { if (r.status) a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
      setMsg({ ...res, brk });
      setPaste('');
      onDone && onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const handleFiles = async (fileList) => {
    const traces = []; const bad = [];
    for (const f of Array.from(fileList)) {
      try {
        const parsed = JSON.parse(await f.text());
        if (Array.isArray(parsed)) traces.push(...parsed); else traces.push(parsed);
      } catch { bad.push(f.name); }
    }
    if (bad.length) setErr(`Skipped invalid JSON: ${bad.join(', ')}`);
    await analyze(traces);
  };

  const handlePaste = async () => {
    let traces = [];
    try {
      const parsed = JSON.parse(paste);
      traces = Array.isArray(parsed) ? parsed : [parsed];
    } catch { setErr('Pasted text is not valid JSON.'); return; }
    await analyze(traces);
  };

  return (
    <div className="border border-dashed border-[#CBD5E1] rounded-2xl p-5 bg-white">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="grid place-items-center text-center py-6 rounded-xl bg-[#F8FAFC] cursor-pointer hover:bg-[#F1F5F9] transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={26} className="text-[#00C7B2] mb-2" />
        <div className="text-[14px] font-semibold text-[#334155]">Drop trace .json files here, or click to choose</div>
        <div className="text-[12px] text-[#94A3B8] mt-1">One or many. A file may contain a single trace or a JSON array.</div>
        <input ref={inputRef} type="file" accept=".json,application/json" multiple hidden
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <div className="mt-4">
        <div className="text-[12px] font-semibold text-[#64748B] mb-1.5">…or paste trace JSON</div>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3}
          placeholder='{"trace": { … }}  or  [ {…}, {…} ]'
          className="w-full border border-[#E4E4E7] rounded-lg px-3 py-2 text-[12px] font-mono outline-none focus:border-[#00C7B2]" />
        <button disabled={busy || !paste.trim()} onClick={handlePaste}
          className="mt-2 bg-[#00C7B2] text-white rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
          {busy ? 'Analyzing…' : 'Analyze pasted JSON'}
        </button>
      </div>

      {err && <div className="mt-3 text-[13px] text-red-600 flex items-start gap-1.5"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{err}</div>}
      {msg && (
        <div className="mt-3 text-[13px] text-[#334155] bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          Analyzed <b>{msg.count}</b> trace{msg.count === 1 ? '' : 's'} — <b>{msg.inserted}</b> new, <b>{msg.updated}</b> updated (deduped){msg.failed ? `, ${msg.failed} failed` : ''}.
          {' '}Breakdown: {Object.entries(msg.brk).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}.
        </div>
      )}
    </div>
  );
}

// ── Main workspace ────────────────────────────────────────────────────
function Workspace({ onBack, onLogout }) {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [environments, setEnvironments] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ action: 'list' });
    if (q) params.set('q', q);
    if (statusFilter) params.set('status', statusFilter);
    if (envFilter) params.set('env', envFilter);
    api(`?${params.toString()}`)
      .then((d) => { setRows(d.rows || []); setStats(d.stats || {}); setTotal(d.total || 0); setEnvironments(d.environments || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, statusFilter, envFilter]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Group by session + environment so re-uploads / same session don't look like dupes.
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const key = `${r.session_id || '—'}||${r.environment || '—'}`;
      if (!m.has(key)) m.set(key, { session_id: r.session_id, environment: r.environment, items: [] });
      m.get(key).items.push(r);
    }
    return [...m.values()];
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#18181B] font-sans flex flex-col">
      {/* header */}
      <header className="bg-white border-b border-[#E4E4E7] px-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} className="text-[#94A3B8] hover:text-black"><ChevronLeft size={18} /></button>
            <div className="w-7 h-7 rounded-lg bg-[#00C7B2] grid place-items-center"><Stethoscope size={16} className="text-white" /></div>
            <span className="font-semibold text-[15px]">Trace Doctor</span>
            <span className="text-[12px] text-[#A1A1AA] ml-1">{total} stored</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-[#64748B] hover:text-black flex items-center gap-1 text-[13px]"><RefreshCw size={14} />Refresh</button>
            <button onClick={onLogout} className="text-[#64748B] hover:text-black flex items-center gap-1 text-[13px]"><LogOut size={14} />Lock</button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 flex-1">
        {/* left: upload + list */}
        <div className="space-y-4 min-w-0">
          <LangfusePanel onDone={load} />
          <UploadPanel onDone={load} />

          {/* search + filters */}
          <div className="bg-white border border-[#E4E4E7] rounded-2xl p-4">
            <div className="flex items-center gap-2 border border-[#E4E4E7] rounded-lg px-3 py-2 mb-3">
              <Search size={15} className="text-[#94A3B8]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search question, env, trace / session id…"
                className="flex-1 text-[13px] outline-none" />
              {q && <button onClick={() => setQ('')}><X size={14} className="text-[#94A3B8]" /></button>}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button onClick={() => setStatusFilter('')} className={`text-[11px] px-2 py-1 rounded-md font-medium ${statusFilter === '' ? 'bg-[#111827] text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}>All</button>
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                  className={`text-[11px] px-2 py-1 rounded-md font-medium ${statusFilter === s ? 'bg-[#111827] text-white' : STATUS_STYLE[s]}`}>
                  {s} {stats[s] ? `(${stats[s]})` : ''}
                </button>
              ))}
            </div>
            {environments.length > 0 && (
              <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}
                className="w-full text-[12px] border border-[#E4E4E7] rounded-lg px-2 py-1.5 text-[#475569]">
                <option value="">All environments</option>
                {environments.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            )}
          </div>

          {error && <div className="text-[13px] text-red-600 px-1">{error}</div>}

          {/* grouped list */}
          <div className="space-y-3">
            {loading && !rows.length && <div className="text-[13px] text-[#94A3B8] px-1">Loading…</div>}
            {!loading && !rows.length && <div className="text-[13px] text-[#94A3B8] px-1">No traces yet. Upload some above.</div>}
            {groups.map((g, gi) => (
              <div key={gi} className="bg-white border border-[#E4E4E7] rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#F1F5F9] flex items-center gap-2">
                  <Layers size={13} className="text-[#94A3B8]" />
                  <span className="text-[12px] font-semibold text-[#334155]">{g.environment || '—'}</span>
                  <span className="text-[11px] text-[#94A3B8] font-mono truncate">session {(g.session_id || '—').slice(0, 12)}</span>
                  <span className="text-[11px] text-[#94A3B8] ml-auto">{g.items.length} trace{g.items.length === 1 ? '' : 's'}</span>
                </div>
                {g.items.map((r) => (
                  <button key={r.id} onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[#F8FAFC] last:border-0 hover:bg-[#F8FAFC] transition-colors ${selectedId === r.id ? 'bg-[#ECFDF5]' : ''}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${STATUS_STYLE[r.status] || ''}`}>{r.status}</span>
                      <span className="text-[11px] text-[#94A3B8]">{(r.findings || []).length} finding{(r.findings || []).length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="text-[13px] text-[#334155] line-clamp-1">{r.question || '—'}</div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-1">{r.summary || ''}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* right: detail */}
        <div className="bg-white border border-[#E4E4E7] rounded-2xl min-h-[400px] overflow-hidden">
          {selectedId
            ? <TraceDetail id={selectedId} onClose={() => setSelectedId(null)} />
            : <div className="h-full grid place-items-center text-center p-10">
                <div>
                  <Stethoscope size={40} className="text-[#CBD5E1] mx-auto mb-3" />
                  <div className="text-[15px] font-semibold text-[#475569]">Select a trace to see its full report</div>
                  <div className="text-[13px] text-[#94A3B8] mt-1">Upload traces on the left, then click any one to view findings, scores, and the recommended fix.</div>
                </div>
              </div>}
        </div>
      </div>
    </div>
  );
}

export default function TraceDoctorStudio({ onBack }) {
  const [authed, setAuthed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(PASS_KEY) === STATIC_PASS,
  );
  if (!authed) return <Gate onAuthed={() => setAuthed(true)} />;
  return <Workspace onBack={onBack || (() => { window.location.href = '/'; })}
    onLogout={() => { localStorage.removeItem(PASS_KEY); setAuthed(false); }} />;
}
