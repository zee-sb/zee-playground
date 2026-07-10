// Trace Doctor — deterministic analysis engine (shared source of truth).
//
// Consumed by:
//   - lib/mcp-servers/trace-doctor.mjs  (Claude in Slack connector, JSON-RPC)
//   - api/trace-doctor.mjs              (the in-app Trace Doctor route)
// and kept byte-identical to scripts/analyze_trace.py from the trace-doctor skill.
//
// Reads eval scores + judge comments and execution observations, runs a rule
// engine, and classifies every problem into the fix layer that owns it:
//   prompt / query / results / tools / sources  (+ an eval-pipeline meta layer).

// --------------------------------------------------------------------------- //
// Rule metadata (directions confirmed against real judge comments)
// --------------------------------------------------------------------------- //
const SCORE_META = {
  resolution:                  { direction: 'higher_better', bad_at: 0.7 },
  hallucination:               { direction: 'lower_better',  bad_at: 0.5 },
  factual_accuracy:            { direction: 'higher_better', bad_at: 0.7 },
  Factual_accuracy:            { direction: 'higher_better', bad_at: 0.7 },
  error_severity:              { direction: 'lower_better',  bad_at: 0.4 },
  friction:                    { direction: 'lower_better',  bad_at: 0.4 },
  repeated_question_count:     { direction: 'count',         bad_at: 1 },
  Prompt_Injection_Resistance: { direction: 'higher_better', bad_at: 1.0 },
  language_switch_flag:        { direction: 'lower_better',  bad_at: 1 },
  sentiment:                   { direction: 'signed',        bad_at: -0.2 },
};

const EVAL_PARSE_FAIL_PATTERNS = [
  /type==?"?message"?/i,
  /lack(?:ed|s)? (?:the )?required ['"]?type['"]?/i,
  /no (?:items|messages) (?:were )?(?:present|recognized|extracted)/i,
  /could(?:n'?t| not) be extracted/i,
  /schema parsing error/i,
];

const NOT_FOUND_PATTERNS = [
  /could(?:n'?t| not) find/i, /couldn'?t locate/i,
  /no (?:results|information|documents?) (?:found|available)/i,
  /unable to find/i, /did(?:n'?t| not) find/i, /nichts? gefunden/i,
  /keine? (?:ergebnisse|informationen|angaben)/i, /konnte .* nicht finden/i,
  /não (?:consegui|encontrei)/i, /não .* encontr/i, /sem resultados/i,
];

const CLARIFY_PATTERNS = [
  /\bwould you like\b/i, /\bdo you want\b/i, /\bshould i\b/i, /\bcan i (?:search|look)\b/i,
  /how (?:would|do) you (?:like|want) me to/i, /möchten sie/i, /soll ich/i, /wie möchten sie/i,
  /quer que eu/i, /como prefere/i, /posso (?:procurar|buscar|pesquisar)/i,
];

const SPECIFIC_CLAIM_PATTERNS = [
  /\+?\d[\d\s().-]{6,}\d/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /\b\d{1,3}(?:[.,]\d{3})+\b/,
  /\b\d+\s?%/,
  /€\s?\d|\$\s?\d|\bEUR\b|\bUSD\b/,
];

const LANG_STOPWORDS = {
  en: new Set(['the','you','i','is','are','can','how','what','where','when','who','why','please','and','for','to','do','a','of','our','we','my','me','this','that','with','have','need','want','your','it','in','on','just','there','about']),
  de: new Set(['der','die','das','und','ist','sie','ich','wie','was','wann','wo','kann','bitte','für','nicht','wer','mein','unsere','unser','mit','haben','ein','eine','auf','von','zum','zur','gibt','es','wird','startet']),
  pt: new Set(['o','a','os','as','que','não','como','onde','quando','por','para','nossa','nosso','posso','você','de','da','do','em','uma','um','com','meu','minha','está','sobre','qual']),
  fr: new Set(['le','la','les','et','est','vous','je','comment','où','quand','pour','ne','pas','notre','mon','une','un','avec','sur','de','des','quel','quelle']),
  es: new Set(['el','la','los','las','que','no','cómo','dónde','cuándo','por','para','nuestra','nuestro','puedo','usted','una','un','con','mi','sobre','cuál']),
};

export const LAYER_LABEL = {
  prompt: 'Prompt engineering / behavior',
  query: 'Search query generation',
  results: 'Search results / retrieval',
  tools: 'Tool calls',
  sources: 'Sources / grounding',
  eval: 'Eval pipeline (meta)',
};
const SEV_ICON = { high: '🔴', medium: '🟠', low: '🟡' };

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //
function anyMatch(patterns, text) {
  if (!text) return false;
  return patterns.some((p) => p.test(text));
}

export function safeJson(val) {
  let v = val;
  let seen = 0;
  while (typeof v === 'string' && seen < 3) {
    const s = v.trim();
    if (!(s.startsWith('{') || s.startsWith('['))) break;
    try { v = JSON.parse(s); } catch { break; }
    seen += 1;
  }
  return v;
}

function guessLang(text) {
  if (!text) return null;
  const words = (text.toLowerCase().match(/[a-záàâäéèêëíìîïóòôöõúùûüçãõñß]+/g)) || [];
  if (words.length < 3) return null;
  let best = null, bestCount = -1;
  for (const [lang, sw] of Object.entries(LANG_STOPWORDS)) {
    let c = 0;
    for (const w of words) if (sw.has(w)) c += 1;
    if (c > bestCount) { bestCount = c; best = lang; }
  }
  return bestCount >= 2 ? best : null;
}

// --------------------------------------------------------------------------- //
// Extraction
// --------------------------------------------------------------------------- //

// Shared by extract() and the LLM review layer (lib/trace-doctor-llm.mjs) so both
// see the identical ordered USER/AGENT transcript.
export function getTranscript(raw) {
  const trace = (raw && raw.trace) ? raw.trace : (raw || {});
  let meta = safeJson(trace.metadata) || {};
  let transcript = (meta && typeof meta === 'object') ? meta.transcript : null;
  if (!transcript) transcript = safeJson(trace.output) || [];
  if (transcript && !Array.isArray(transcript) && typeof transcript === 'object') {
    transcript = transcript.transcript || [];
  }
  if (!Array.isArray(transcript)) transcript = [];
  return transcript;
}

export function extract(raw) {
  const trace = (raw && raw.trace) ? raw.trace : (raw || {});
  const observations = (raw && raw.observations) || trace.observations || [];

  const transcript = getTranscript(raw);

  const roleTexts = (role) => transcript
    .filter((m) => m && typeof m === 'object' && String(m.role || '').toUpperCase() === role)
    .map((m) => String(m.text || ''));

  const userTexts = roleTexts('USER');
  const agentTexts = roleTexts('AGENT');
  const allAgent = agentTexts.join('\n');

  const userLang = userTexts.length ? guessLang(userTexts[0]) : null;
  const agentLang = agentTexts.length ? guessLang(agentTexts[0]) : null;

  // scores aggregated by name
  const raw_scores = {};
  for (const s of (trace.scores || [])) {
    const name = s && s.name;
    if (name == null) continue;
    let v = s.value;
    if (v == null && s.stringValue != null) v = s.stringValue;
    (raw_scores[name] = raw_scores[name] || { values: [], comments: [] });
    raw_scores[name].values.push(v);
    if (s.comment) raw_scores[name].comments.push(String(s.comment));
  }
  const scores = {};
  for (const [name, d] of Object.entries(raw_scores)) {
    const nums = d.values.filter((v) => typeof v === 'number');
    const mean = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000 : null;
    scores[name] = { mean, n: d.values.length, comments: d.comments };
  }

  // observations
  const obsCounts = {};
  const toolCalls = {};
  const errors = [];
  for (const o of observations) {
    const name = String((o && o.name) || '');
    const otype = (o && o.type) || '';
    obsCounts[otype] = (obsCounts[otype] || 0) + 1;
    if (name.startsWith('Tool Call:')) {
      const t = name.replace('Tool Call:', '').trim();
      toolCalls[t] = (toolCalls[t] || 0) + 1;
    }
    if ((o && o.level === 'ERROR') || name.startsWith('Error')) {
      errors.push({ name, status: o && o.statusMessage, level: o && o.level });
    }
  }

  const parseFail = [];
  for (const [name, d] of Object.entries(scores)) {
    if (d.comments.some((c) => anyMatch(EVAL_PARSE_FAIL_PATTERNS, c))) parseFail.push(name);
  }

  return {
    trace_id: trace.id,
    environment: trace.environment,
    session_id: trace.sessionId,
    user_id: trace.userId,
    timestamp: trace.timestamp,
    input: trace.input,
    num_user_turns: userTexts.length,
    num_agent_turns: agentTexts.length,
    user_lang: userLang,
    agent_lang: agentLang,
    scores,
    num_search: toolCalls.searchKnowledgeBase || 0,
    num_display_source: toolCalls.displaySource || 0,
    errors,
    parse_fail_scores: [...new Set(parseFail)].sort(),
    agent_said_not_found: anyMatch(NOT_FOUND_PATTERNS, allAgent),
    agent_asked_clarifying: anyMatch(CLARIFY_PATTERNS, allAgent),
    agent_makes_specific_claims: anyMatch(SPECIFIC_CLAIM_PATTERNS, allAgent),
  };
}

// --------------------------------------------------------------------------- //
// Rule engine
// --------------------------------------------------------------------------- //
export const SEV_RANK = { high: 3, medium: 2, low: 1 };
// Format numbers the way the Python engine does (whole floats keep one decimal).
const nf = (x) => (typeof x === 'number' && Number.isInteger(x)) ? x.toFixed(1) : String(x);
const scoreMean = (sig, name) => (sig.scores[name] ? sig.scores[name].mean : null);
const firstComment = (sig, name) => (sig.scores[name] && sig.scores[name].comments.length ? sig.scores[name].comments[0] : null);

export function runRules(sig) {
  const findings = [];
  const add = (layer, severity, title, evidence, fix, confidence = 'medium') =>
    findings.push({ layer, severity, title, evidence, recommended_fix: fix, confidence });

  const res = scoreMean(sig, 'resolution');
  const hall = scoreMean(sig, 'hallucination');
  const fact = scoreMean(sig, 'factual_accuracy') ?? scoreMean(sig, 'Factual_accuracy');
  const errsev = scoreMean(sig, 'error_severity');
  const fric = scoreMean(sig, 'friction');
  const reps = scoreMean(sig, 'repeated_question_count');
  const pir = scoreMean(sig, 'Prompt_Injection_Resistance');
  const langsw = scoreMean(sig, 'language_switch_flag');
  const senti = scoreMean(sig, 'sentiment');

  const parseFail = sig.parse_fail_scores;
  const trustworthy = (name) => !parseFail.includes(name);

  if (parseFail.length) {
    add('eval', 'high',
      'Eval scoring pipeline failed to parse this trace',
      `Judge comments on ${parseFail.join(', ')} say the transcript items lacked a \`type\` field so no messages could be extracted. Any score derived from that parse (e.g. error_severity, repeated_question_count) is an artifact of the scorer, not the agent.`,
      'Fix the trace-logging schema so conversation items carry the required `type: "message"` field before they reach the eval jobs; then re-run the affected evals. Do not action these specific scores until re-scored.',
      'high');
  }

  if (sig.errors.length) {
    const names = [...new Set(sig.errors.map((e) => e.name))].sort().join(', ');
    add('tools', 'high',
      'Internal / tool-call error during the conversation',
      `${sig.errors.length} error observation(s): ${names}.`,
      "Pull the failing tool-call span in Langfuse, check the tool's input schema and the backend response; add a retry/fallback so a single tool failure doesn't sink the turn.",
      'high');
  }
  if (errsev != null && errsev >= SCORE_META.error_severity.bad_at && trustworthy('error_severity')) {
    add('tools', errsev < 0.7 ? 'medium' : 'high',
      `Elevated error_severity (${nf(errsev)})`,
      `Judge: ${firstComment(sig, 'error_severity')}`,
      "Trace the error the judge described to its span; if it's a formatting/parse issue on the agent side, tighten the tool output contract.");
  }

  if (hall != null && hall >= SCORE_META.hallucination.bad_at && trustworthy('hallucination')) {
    const sev = (hall >= 0.7 || (res || 0) >= 0.9) ? 'high' : 'medium';
    const extra = (res || 0) >= 0.9 ? ' The answer was also scored as resolved, so the agent sounded confident while unsupported — the worst failure mode for trust.' : '';
    const claim = sig.agent_makes_specific_claims ? ' Agent output contains specific claims (numbers/names/contacts), raising the stakes.' : '';
    add('sources', sev,
      `Possible ungrounded answer (hallucination ${nf(hall)})`,
      `Judge: ${firstComment(sig, 'hallucination')}${extra}${claim} searchKnowledgeBase calls: ${sig.num_search}, displaySource calls: ${sig.num_display_source}.`,
      'Compare the cited/displayed sources against the specific claims. If claims exceed what the retrieved snippets support, strengthen the grounding instruction (answer only from retrieved context; abstain otherwise) and require source attribution for every factual claim.');
  }
  if (fact != null && fact < SCORE_META.factual_accuracy.bad_at && trustworthy('factual_accuracy')) {
    add('sources', 'medium',
      `Low factual accuracy (${nf(fact)})`,
      `Judge: ${firstComment(sig, 'factual_accuracy') || firstComment(sig, 'Factual_accuracy')}`,
      'Verify the claims against source-of-truth docs; if wrong, this is a grounding or retrieval-precision problem, not phrasing.');
  }

  if (sig.num_search === 0 && (res != null && res < SCORE_META.resolution.bad_at)) {
    add('query', 'high',
      'Agent did not search the knowledge base on an unresolved knowledge request',
      `searchKnowledgeBase was never called yet resolution is ${nf(res)}. Agent asked a clarifying question: ${sig.agent_asked_clarifying}.`,
      'Check routing + the system prompt: for knowledge-lookup intents the agent should search first rather than punt with a clarifying question. Tune the tool-choice instruction / intent classifier.');
  } else if (sig.num_search >= 4) {
    add('query', 'medium',
      `Query thrash — ${sig.num_search} knowledge-base searches in the conversation`,
      `A high search count often means the first queries were poorly formed and the agent kept reformulating. resolution=${nf(res)}.`,
      'Inspect the query strings per searchKnowledgeBase span. If they are near-duplicates or off-topic, improve query generation (entity extraction, query rewriting) or KB coverage for this topic.',
      'low');
  }

  if (sig.num_search >= 1 && (sig.agent_said_not_found || (res != null && res < SCORE_META.resolution.bad_at))) {
    const why = sig.agent_said_not_found ? "the agent told the user it couldn't find the information" : `resolution stayed low (${nf(res)})`;
    add('results', 'high',
      "Searched but retrieval didn't surface a usable answer",
      `${sig.num_search} search(es) ran, but ${why}. This points at retrieval recall / KB content rather than the query wording.`,
      "Pull the returned snippets for each search span. If the answer exists in the KB but wasn't retrieved: tune ranking/recall (chunking, embeddings, top-k, filters). If it isn't in the KB at all: it's a content-coverage gap, not a search bug.");
  }

  if (res != null && res < SCORE_META.resolution.bad_at && sig.agent_asked_clarifying && sig.num_search === 0) {
    add('prompt', 'medium',
      'Over-cautious clarify-instead-of-act behavior',
      `resolution=${nf(res)}; agent offered options / asked how to proceed instead of just retrieving the answer. Judge (resolution): ${firstComment(sig, 'resolution')}`,
      'If the intent was clear, the extra clarifying turn is friction. Adjust the system prompt to act-then-confirm for unambiguous lookups.');
  }
  if (reps != null && reps >= 1 && trustworthy('repeated_question_count')) {
    add('prompt', 'medium',
      `User had to repeat/rephrase (${nf(reps)})`,
      `Judge: ${firstComment(sig, 'repeated_question_count')}`,
      'Repetition means the first answer did not land. Trace which turn failed and why (retrieval miss vs. misread intent).');
  }
  if (fric != null && fric >= SCORE_META.friction.bad_at && trustworthy('friction')) {
    add('prompt', 'medium',
      `High conversational friction (${nf(fric)})`,
      `Judge: ${firstComment(sig, 'friction')}`,
      'Read the friction comment for the specific breakdown (repetition, unmet request, clarifying loops) and address that turn.',
      'low');
  }
  if (pir != null && pir < 1.0 && trustworthy('Prompt_Injection_Resistance')) {
    add('prompt', 'high',
      `Weak prompt-injection / data-governance handling (${nf(pir)})`,
      `Judge: ${firstComment(sig, 'Prompt_Injection_Resistance')}`,
      "Review whether the agent disclosed sensitive/internal info it shouldn't have. Harden the system prompt's data-governance rules and add a guardrail check.");
  }
  if (langsw != null && langsw >= 1) {
    add('prompt', 'medium',
      'Language switch detected',
      `Judge: ${firstComment(sig, 'language_switch_flag')}`,
      "Confirm the agent answered in the user's language throughout; if it drifted, pin response language to the detected user language.",
      'low');
  }
  if (sig.user_lang && sig.agent_lang && sig.user_lang !== sig.agent_lang) {
    const missed = (langsw === 0) ? ' Note: the language_switch_flag eval scored 0 here — a false negative worth fixing in the eval too.' : '';
    add('prompt', 'medium',
      `Agent replied in a different language than the user (user≈${sig.user_lang}, agent≈${sig.agent_lang})`,
      `Detected from the transcript, independent of the eval score.${missed}`,
      "Pin the response language to the user's detected language. If the language_switch_flag eval missed this, tune that judge as well.");
  }
  if (senti != null && senti <= SCORE_META.sentiment.bad_at) {
    add('prompt', 'low',
      `Negative user sentiment (${nf(senti)})`,
      `Judge: ${firstComment(sig, 'sentiment')}`,
      'Sentiment is a symptom — correlate with the resolution/friction findings above to find the cause.',
      'low');
  }

  findings.sort((a, b) => {
    const r = (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0);
    if (r !== 0) return r;
    return (b.confidence === 'high') - (a.confidence === 'high');
  });
  return findings;
}

export function health(findings) {
  const highs = findings.filter((f) => f.severity === 'high').length;
  const meds = findings.filter((f) => f.severity === 'medium').length;
  const nonEval = findings.filter((f) => f.layer !== 'eval').length;
  if (findings.some((f) => f.layer === 'eval') && nonEval === 0) return 'UNSCORABLE';
  if (highs === 0 && meds === 0) return 'HEALTHY';
  if (highs === 0) return 'MINOR';
  return 'NEEDS_FIX';
}

// --------------------------------------------------------------------------- //
// Rendering
// --------------------------------------------------------------------------- //
export function renderSingle(sig, findings, status) {
  const L = [];
  L.push(`# Trace Doctor — ${sig.environment || '?'} / \`${String(sig.trace_id || '?').slice(0, 12)}\``);
  L.push(`**Status: ${status}**  ·  ${findings.length} finding(s)  ·  turns: ${sig.num_user_turns}U/${sig.num_agent_turns}A  ·  searches: ${sig.num_search}  ·  sources shown: ${sig.num_display_source}  ·  errors: ${sig.errors.length}`);
  L.push(`\n**Question:** ${String(sig.input || '').slice(0, 300)}`);
  const keys = ['resolution', 'hallucination', 'factual_accuracy', 'error_severity', 'friction', 'repeated_question_count', 'Prompt_Injection_Resistance', 'language_switch_flag', 'sentiment'];
  const parts = [];
  for (const k of keys) {
    const m = scoreMean(sig, k);
    if (m != null) parts.push(`${k}=${nf(m)}${sig.parse_fail_scores.includes(k) ? '⚠️' : ''}`);
  }
  if (parts.length) L.push(`\n**Eval scores:** ${parts.join(', ')}`);
  if (sig.parse_fail_scores.length) L.push('\n> ⚠️ Scores flagged ⚠️ are unreliable — the eval harness failed to parse this trace.');
  if (sig.llm && sig.llm.narrative) {
    L.push(`\n## Root cause (AI reasoning)\n\n${sig.llm.narrative}`);
  }
  if (!findings.length) { L.push('\n✅ No problems detected by the rule engine.'); return L.join('\n'); }
  L.push('\n## Findings (most severe first)\n');
  findings.forEach((f, i) => {
    const src = f.source === 'llm' ? ' 🤖' : '';
    L.push(`### ${i + 1}. ${SEV_ICON[f.severity] || ''} [${LAYER_LABEL[f.layer]}]${src} ${f.title}`);
    L.push(`*severity: ${f.severity} · confidence: ${f.confidence}*\n`);
    L.push(`- **Evidence:** ${f.evidence}`);
    L.push(`- **Recommended fix:** ${f.recommended_fix}\n`);
  });
  if (sig.llm && sig.llm.system_prompt_review && sig.llm.system_prompt_review.issues && sig.llm.system_prompt_review.issues.length) {
    L.push('\n## System prompt review\n');
    sig.llm.system_prompt_review.issues.forEach((issue) => L.push(`- ${issue}`));
  }
  if (sig.llm && Array.isArray(sig.llm.search_call_review) && sig.llm.search_call_review.length) {
    L.push('\n## Search calls reviewed\n');
    L.push('| # | Query quality | Root cause | Note |');
    L.push('|--:|---|---|---|');
    sig.llm.search_call_review.forEach((r) => {
      L.push(`| ${r.index + 1} | ${r.query_quality} | ${r.root_cause} | ${r.note} |`);
    });
  }
  return L.join('\n');
}

export function renderBatch(rows) {
  const L = [];
  L.push(`# Trace Doctor — batch report (${rows.length} traces)\n`);
  const statusCt = {};
  for (const r of rows) statusCt[r.status] = (statusCt[r.status] || 0) + 1;
  L.push('**Fleet health:** ' + Object.entries(statusCt).map(([k, v]) => `${k}=${v}`).join(', '));

  const layerCt = {}, layerSev = {}, titleCt = {}, envLayer = {};
  for (const r of rows) {
    for (const f of r.findings) {
      layerCt[f.layer] = (layerCt[f.layer] || 0) + 1;
      (layerSev[f.layer] = layerSev[f.layer] || {})[f.severity] = ((layerSev[f.layer] || {})[f.severity] || 0) + 1;
      const key = `${f.layer}||${f.title}`;
      titleCt[key] = (titleCt[key] || 0) + 1;
      const env = r.sig.environment;
      (envLayer[env] = envLayer[env] || {})[f.layer] = ((envLayer[env] || {})[f.layer] || 0) + 1;
    }
  }
  L.push('\n## Problem layers ranked by frequency\n');
  L.push('| Layer | Findings | High | Med | Low |');
  L.push('|---|--:|--:|--:|--:|');
  Object.entries(layerCt).sort((a, b) => b[1] - a[1]).forEach(([layer, n]) => {
    const sv = layerSev[layer] || {};
    L.push(`| ${LAYER_LABEL[layer]} | ${n} | ${sv.high || 0} | ${sv.medium || 0} | ${sv.low || 0} |`);
  });
  L.push('\n## Most common specific problems\n');
  Object.entries(titleCt).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([key, n]) => {
    const [layer, title] = key.split('||');
    L.push(`- **${n}×** [${LAYER_LABEL[layer]}] ${title}`);
  });
  L.push('\n## Per-trace summary\n');
  L.push('| Env | Trace | Status | Top finding |');
  L.push('|---|---|---|---|');
  for (const r of rows) {
    const top = r.findings.length ? r.findings[0].title : '—';
    L.push(`| ${r.sig.environment} | \`${String(r.sig.trace_id || '').slice(0, 10)}\` | ${r.status} | ${top} |`);
  }
  L.push('\n## Findings by environment\n');
  for (const [env, ct] of Object.entries(envLayer)) {
    L.push(`- **${env}:** ` + Object.entries(ct).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${LAYER_LABEL[k]} (${v})`).join(', '));
  }
  return L.join('\n');
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

// analyze() — one trace object/string or an array; returns markdown or json.
export function analyze(input, format = 'markdown') {
  const data = safeJson(input);
  const list = Array.isArray(data) ? data : [data];
  const rows = list.map((raw) => {
    const parsed = safeJson(raw);
    const sig = extract(parsed || {});
    const findings = runRules(sig);
    return { sig, findings, status: health(findings) };
  });

  if (format === 'json') {
    return {
      trace_count: rows.length,
      traces: rows.map((r) => ({ status: r.status, signals: r.sig, findings: r.findings })),
    };
  }
  if (rows.length === 1) return renderSingle(rows[0].sig, rows[0].findings, rows[0].status);
  return renderBatch(rows) + '\n\n---\n\n# Individual trace reports\n\n'
    + rows.map((r) => renderSingle(r.sig, r.findings, r.status)).join('\n\n---\n\n');
}

// analyzeOne() — structured result for one trace (used by the in-app route to
// persist a row). Returns signals, findings, status, a one-line summary, and the
// full markdown report.
export function analyzeOne(raw) {
  const parsed = safeJson(raw) || {};
  const sig = extract(parsed);
  const findings = runRules(sig);
  const status = health(findings);
  const top = findings[0];
  const summary = top
    ? `${status} · ${findings.length} finding${findings.length === 1 ? '' : 's'} · root: ${LAYER_LABEL[top.layer]} — ${top.title}`
    : `${status} · no problems detected`;
  return { sig, findings, status, summary, report_md: renderSingle(sig, findings, status) };
}

// batchReport() — the aggregate markdown for a set of already-analyzed rows.
export function batchReport(rows) {
  return renderBatch(rows);
}
