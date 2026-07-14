// Trace Doctor — deterministic tool & retrieval analysis.
//
// The core engine (trace-doctor-engine.mjs) is kept byte-identical to the
// packaged Python skill and only COUNTS tool calls. Now that we pull full
// traces from Langfuse, the observations carry each tool call's structured
// input/output — enough to check retrieval and grounding directly, WITHOUT
// depending on LLM-as-a-judge eval scores (most pulled traces have none) and
// WITHOUT a model call. This module does that and emits extra findings that get
// merged alongside the rule-engine + LLM findings.
//
// Navigator's three tools (observed across prod traces):
//   searchKnowledgeBase — retrieval. input {searchType, semanticQuery,
//                         keywordTerms[], publishedAfter?}, output {entries[]}.
//   displaySource       — the sources the agent chose to cite. input {sources[]}.
//   selectAgent         — routing to a sub-agent.

const SLOW_TOOL_MS = 8000;

function norm(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/[ ]/g, ' ')      // non-breaking space
    .replace(/[“”„‟""'']/g, '')     // typographic + straight quotes → drop
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}
// Whether a cited title is grounded in the retrieved set. Retrieval "titles"
// often jam the whole doc body in and use &nbsp; / different quoting, while the
// cited title is the clean prefix — so match by containment (min 15 chars to
// avoid trivial overlaps), not exact equality.
function titleGrounded(citedNorm, retrievedNorms) {
  if (!citedNorm || citedNorm.length < 15) return true; // too short to judge — don't flag
  return retrievedNorms.some((r) =>
    r === citedNorm
    || (citedNorm.length >= 15 && r.includes(citedNorm))
    || (r.length >= 15 && citedNorm.includes(r)));
}
function ms(o) {
  const a = o?.startTime ? Date.parse(o.startTime) : NaN;
  const b = o?.endTime ? Date.parse(o.endTime) : NaN;
  return (Number.isFinite(a) && Number.isFinite(b)) ? (b - a) : null;
}
// A tool call "failed" if the runtime flagged it, or its output looks like an
// error rather than a payload. displaySource returns the string "SUCCESS".
function toolFailed(name, o) {
  if (o?.level === 'ERROR') return o.statusMessage || 'ERROR level';
  const out = o?.output;
  if (out == null) return null;
  if (typeof out === 'string') {
    const t = out.trim().toLowerCase();
    if (/^(error|failed|failure|exception|timeout)/.test(t)) return out.slice(0, 160);
    return null;
  }
  if (typeof out === 'object') {
    if (out.error || out.errorMessage || out.exception) return String(out.error || out.errorMessage || out.exception).slice(0, 160);
    if (out.success === false || out.ok === false) return 'tool reported success=false';
  }
  return null;
}

// Parse every tool-call observation into structured activity. Never throws.
export function extractToolActivity(raw) {
  const trace = (raw && raw.trace) ? raw.trace : (raw || {});
  const observations = (raw && raw.observations) || trace.observations || [];
  const searches = [];
  const displayed = [];       // flattened cited sources
  const agentSelections = [];
  const tools = [];           // every tool call, ordered
  const failures = [];
  const slow = [];

  const ordered = [...observations]
    .filter((o) => /^Tool Call:/.test(String(o?.name || '')))
    .sort((a, b) => (Date.parse(a.startTime || 0) || 0) - (Date.parse(b.startTime || 0) || 0));

  for (const o of ordered) {
    const toolName = String(o.name).replace('Tool Call:', '').trim();
    const latency = ms(o);
    const fail = toolFailed(toolName, o);
    tools.push({ name: toolName, ok: !fail, latency, error: fail || null });
    if (fail) failures.push({ name: toolName, reason: fail });
    if (latency != null && latency > SLOW_TOOL_MS) slow.push({ name: toolName, latency });

    if (toolName === 'searchKnowledgeBase' && o.input && typeof o.input === 'object') {
      const entries = Array.isArray(o.output?.entries) ? o.output.entries : (Array.isArray(o.output) ? o.output : null);
      searches.push({
        semanticQuery: o.input.semanticQuery || o.input.query || null,
        keywordTerms: Array.isArray(o.input.keywordTerms) ? o.input.keywordTerms : [],
        searchType: o.input.searchType || null,
        publishedAfter: o.input.publishedAfter || null,
        resultCount: entries ? entries.length : null,
        titles: entries ? entries.map((e) => e.title).filter(Boolean) : [],
        snippets: entries ? entries.map((e) => e.snippet).filter(Boolean) : [],
        empty: entries ? entries.length === 0 : false,
        latency,
      });
    } else if (toolName === 'displaySource' && o.input && typeof o.input === 'object') {
      const srcs = Array.isArray(o.input.sources) ? o.input.sources : [];
      for (const s of srcs) displayed.push({ title: s.title || null, type: s.type || null, link: s.link || null });
    } else if (toolName === 'selectAgent') {
      agentSelections.push({ input: o.input ?? null, output: o.output ?? null });
    }
  }

  // Grounding: did every cited source actually come back from a search?
  const retrievedTitles = new Set();
  for (const s of searches) for (const t of s.titles) retrievedTitles.add(norm(t));
  const retrievedNorms = [...retrievedTitles];
  const citedTitles = displayed.map((d) => d.title).filter(Boolean);
  const citedNotRetrieved = displayed.filter((d) => d.title && !titleGrounded(norm(d.title), retrievedNorms));
  const retrievedCount = retrievedTitles.size;

  // Ordering: was a source displayed before any search ran?
  const firstSearchIdx = tools.findIndex((t) => t.name === 'searchKnowledgeBase');
  const firstDisplayIdx = tools.findIndex((t) => t.name === 'displaySource');
  const displayedBeforeSearch = firstDisplayIdx >= 0 && (firstSearchIdx < 0 || firstDisplayIdx < firstSearchIdx);

  // Near-duplicate search queries (same normalized semanticQuery).
  const seen = new Map();
  const duplicateQueries = [];
  for (const s of searches) {
    const k = norm(s.semanticQuery);
    if (!k) continue;
    if (seen.has(k)) duplicateQueries.push(s.semanticQuery); else seen.set(k, true);
  }

  return {
    searches,
    displayed,
    agentSelections,
    tools,
    failures,
    slow,
    counts: {
      search: searches.length,
      display: displayed.length,
      selectAgent: agentSelections.length,
      total: tools.length,
    },
    grounding: {
      retrievedCount,
      citedCount: citedTitles.length,
      citedNotRetrieved: citedNotRetrieved.map((d) => d.title),
      retrievedButNoneCited: retrievedCount > 0 && citedTitles.length === 0,
    },
    displayedBeforeSearch,
    duplicateQueries,
  };
}

// Deterministic findings from the tool activity. Complements (does not
// duplicate) the rule engine, which already handles num_search==0 / >=4 and
// score-based hallucination.
export function analyzeToolActivity(act) {
  const findings = [];
  const add = (layer, severity, title, evidence, fix, confidence = 'high') =>
    findings.push({ layer, severity, title, evidence, recommended_fix: fix, confidence, source: 'tools' });

  // 1. A tool call errored.
  if (act.failures.length) {
    const detail = act.failures.map((f) => `${f.name}: ${f.reason}`).join('; ');
    add('tools', 'high',
      `Tool call failed (${act.failures.length})`,
      `Failing tool call(s): ${detail}.`,
      'Open the failing span in Langfuse; check the tool input schema and backend response, and add a retry/fallback so one tool failure does not sink the turn.');
  }

  // 2. Empty retrieval — search ran, zero results.
  const empties = act.searches.filter((s) => s.empty);
  if (empties.length) {
    const q = empties[0].semanticQuery || '(unknown query)';
    const filt = empties[0].publishedAfter ? ` A publishedAfter=${empties[0].publishedAfter} filter was applied and may be excluding valid docs.` : '';
    add('results', 'high',
      `Knowledge-base search returned zero results (${empties.length} empty search${empties.length === 1 ? '' : 'es'})`,
      `Query "${q}" returned no entries.${filt}`,
      'If the answer exists in the KB: loosen the date/type filters and tune recall (chunking, embeddings, top-k). If it does not: this is a content-coverage gap — the agent should abstain, not improvise.');
  }

  // 3. Cited a source retrieval never returned — deterministic grounding gap.
  if (act.grounding.citedNotRetrieved.length) {
    const list = act.grounding.citedNotRetrieved.slice(0, 3).map((t) => `"${String(t).slice(0, 60)}"`).join(', ');
    add('sources', 'high',
      `Displayed ${act.grounding.citedNotRetrieved.length} source(s) not returned by any search`,
      `displaySource cited ${list}${act.grounding.citedNotRetrieved.length > 3 ? ' …' : ''}, but no searchKnowledgeBase call returned those titles. The citation is not grounded in retrieved context.`,
      'Constrain displaySource to titles present in the retrieval results, and require the agent to cite only retrieved sources. A cited-but-not-retrieved source is a fabricated/mismatched citation.');
  }

  // 4. Retrieved sources but cited none (answer may ignore grounding).
  if (act.grounding.retrievedButNoneCited && act.counts.search >= 1) {
    add('sources', 'medium',
      'Retrieved knowledge-base results but cited no source',
      `${act.grounding.retrievedCount} source(s) came back from search, but displaySource was never called. The user got an answer with no visible provenance.`,
      'Require the agent to attribute factual claims to a retrieved source (displaySource) whenever search returned results; otherwise the answer is unverifiable.',
      'medium');
  }

  // 5. Cited before searching.
  if (act.displayedBeforeSearch && act.counts.search >= 1) {
    add('sources', 'medium',
      'Source displayed before any knowledge-base search',
      'A displaySource call precedes the first searchKnowledgeBase call in this turn — the citation could not have come from retrieval.',
      'Order the tool flow so retrieval happens before citation, and only cite what the search returned.',
      'medium');
  }

  // 6. Duplicate search queries.
  if (act.duplicateQueries.length) {
    add('query', 'low',
      `Repeated near-identical search quer${act.duplicateQueries.length === 1 ? 'y' : 'ies'}`,
      `The same semantic query was issued more than once: "${String(act.duplicateQueries[0]).slice(0, 80)}". Re-issuing an identical query rarely yields new results.`,
      'Deduplicate queries; if the first result set was insufficient, reformulate (different entities/synonyms) rather than repeat.',
      'medium');
  }

  // 7. Slow tool.
  if (act.slow.length) {
    const s = act.slow.sort((a, b) => b.latency - a.latency)[0];
    add('tools', 'low',
      `Slow tool call — ${s.name} took ${(s.latency / 1000).toFixed(1)}s`,
      `${act.slow.length} tool call(s) exceeded ${(SLOW_TOOL_MS / 1000)}s; slowest was ${s.name} at ${(s.latency / 1000).toFixed(1)}s.`,
      'Check the tool backend latency; a slow retrieval/tool adds directly to time-to-answer and hurts perceived responsiveness.',
      'low');
  }

  return findings;
}
