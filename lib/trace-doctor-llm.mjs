// Trace Doctor — LLM review layer (additive to the deterministic rule engine).
//
// trace-doctor-engine.mjs stays deterministic and kept byte-identical to the
// Python skill's rule engine — nothing in there changes here. This module adds
// judgment the rule engine structurally can't do:
//   - language consistency across every USER/AGENT turn (not just the first)
//   - system-prompt contradiction/gap analysis, when the export captures the
//     prompt text (most exports today don't — see extractDeep() below)
//   - per-searchKnowledgeBase-call query/relevance review, when the export
//     captures tool input/output (ditto)
//
// The packaged Claude skill doesn't need this: when a human runs it inside a
// Claude conversation, Claude itself supplies this judgment live. The Slack
// MCP connector and the in-app route are headless, so they need a real model
// call to get the same "second half" of the hybrid analysis.

import { createAIClient, MODELS } from './ai-client.mjs';
import {
  safeJson, extract, runRules, health, renderSingle, renderBatch, LAYER_LABEL, SEV_RANK, getTranscript,
} from './trace-doctor-engine.mjs';
import { extractToolActivity, analyzeToolActivity } from './trace-doctor-tools.mjs';

// --------------------------------------------------------------------------- //
// Deep extraction — the fields the deterministic engine intentionally never
// reads. Langfuse stores these on the observation (Message (SYSTEM).input is
// the raw system-prompt string; Tool Call: searchKnowledgeBase has structured
// .input/.output), but many export paths strip them before they reach a JSON
// file. When present we use them; when absent we degrade gracefully — that's
// why this lives here rather than in the shared engine.
// --------------------------------------------------------------------------- //
export function extractDeep(raw) {
  const trace = (raw && raw.trace) ? raw.trace : (raw || {});
  const observations = (raw && raw.observations) || trace.observations || [];

  let systemPrompt = null;
  const searchCalls = [];
  for (const o of observations) {
    const name = String((o && o.name) || '');
    if (!systemPrompt && name === 'Message (SYSTEM)' && typeof o.input === 'string' && o.input.trim()) {
      systemPrompt = o.input;
    }
    if (name === 'Tool Call: searchKnowledgeBase' && o.input && typeof o.input === 'object') {
      const entries = (o.output && Array.isArray(o.output.entries)) ? o.output.entries : null;
      searchCalls.push({
        query: o.input,
        results: entries ? entries.map((e) => ({ title: e.title, snippet: e.snippet, type: e.type })) : null,
      });
    }
  }
  return { systemPrompt, searchCalls };
}

// --------------------------------------------------------------------------- //
// LLM call
// --------------------------------------------------------------------------- //
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    narrative: {
      type: 'string',
      description: '2-4 sentence plain-language root-cause synthesis of what actually happened in this conversation and why, connecting the dots across turns the way a human triager would.',
    },
    findings: {
      type: 'array',
      description: 'Additional findings the rule engine could not produce. Only include real problems — do not restate findings implied by the eval scores alone; add causal/behavioral judgment.',
      items: {
        type: 'object',
        properties: {
          layer: { type: 'string', enum: ['prompt', 'query', 'results', 'tools', 'sources', 'eval'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          evidence: { type: 'string' },
          recommended_fix: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['layer', 'severity', 'title', 'evidence', 'recommended_fix', 'confidence'],
      },
    },
    language_check: {
      type: 'object',
      properties: {
        user_languages: { type: 'array', items: { type: 'string' } },
        agent_languages: { type: 'array', items: { type: 'string' } },
        mismatch: { type: 'boolean' },
        detail: { type: 'string', description: 'Which turn(s) mismatched, quoting the telling phrase.' },
      },
      required: ['mismatch'],
    },
    system_prompt_review: {
      type: 'object',
      description: 'Omit / leave issues empty if no system prompt text was provided.',
      properties: {
        issues: { type: 'array', items: { type: 'string' }, description: 'Contradictions, ambiguities, or gaps in the system prompt, each tied to a concrete behavior it likely causes.' },
      },
    },
    search_call_review: {
      type: 'array',
      description: 'One entry per searchKnowledgeBase call provided, in order. Omit entirely if no search calls were provided.',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '0-based, matching the "Call index N" label in the prompt.' },
          query_quality: { type: 'string', enum: ['good', 'poor'] },
          root_cause: { type: 'string', enum: ['query', 'results', 'none'] },
          note: { type: 'string', description: 'One sentence: was the query well-formed for the user ask, and did the returned snippets support the final answer.' },
        },
        required: ['index', 'query_quality', 'root_cause', 'note'],
      },
    },
  },
  required: ['narrative', 'findings'],
};

function buildPrompt(sig, deep, act) {
  const turns = getTranscript(sig.__raw).map((m) => `${String(m.role || '?').toUpperCase()}: ${m.text || ''}`).join('\n');
  const ruleFindingsSummary = sig.__ruleFindings.length
    ? sig.__ruleFindings.map((f) => `- [${f.layer}/${f.severity}] ${f.title}`).join('\n')
    : '(none)';

  const parts = [
    'You are reviewing a Navigator AI-assistant conversation trace for root-cause diagnosis. A deterministic rule engine already ran; your job is the judgment it cannot do.',
    `\n## Conversation transcript\n${turns || '(no transcript available)'}`,
    `\n## Rule-engine findings already raised (do not just restate these — add causal reasoning or genuinely new findings)\n${ruleFindingsSummary}`,
  ];

  if (deep.systemPrompt) {
    parts.push(`\n## System prompt in effect\n${deep.systemPrompt}`);
    parts.push('\nReview the system prompt for internal contradictions, ambiguous instructions, or gaps, and tie any you find to specific behavior visible in the transcript above.');
  } else {
    parts.push('\n## System prompt\nNot available in this export — do not fabricate a system_prompt_review; leave its issues array empty.');
  }

  if (deep.searchCalls.length) {
    const block = deep.searchCalls.map((c, i) => `### Call index ${i}\nQuery: ${JSON.stringify(c.query)}\nResults: ${c.results ? JSON.stringify(c.results).slice(0, 1500) : '(no results captured)'}`).join('\n\n');
    parts.push(`\n## searchKnowledgeBase calls (query + returned snippets)\n${block}`);
    parts.push('\nFor each call, judge whether the query was well-formed for what the user actually asked, and whether the returned snippets support the agent\'s final answer. Classify root_cause as "query" (the query itself was poorly formed), "results" (query was reasonable but retrieval/content missed), or "none". The "index" field in your response must exactly match the 0-based "Call index N" label above — the first call is index 0.');
  } else {
    parts.push('\n## searchKnowledgeBase calls\nNo call input/output captured in this export — omit search_call_review entirely, do not fabricate it.');
  }

  // Grounding context — which sources the agent actually cited (displaySource)
  // vs. what retrieval returned. Lets the model judge answer faithfulness.
  if (act && (act.displayed.length || act.counts.search)) {
    const cited = act.displayed.length ? act.displayed.map((d) => `"${String(d.title || '?').slice(0, 70)}"`).join(', ') : '(none)';
    parts.push(`\n## Sources the agent cited (displaySource)\nCited: ${cited}\nRetrieved sources available: ${act.grounding.retrievedCount}. Cited-but-not-retrieved: ${act.grounding.citedNotRetrieved.length}.`);
    parts.push('\nJudge answer faithfulness: does the final answer stay within what the cited/retrieved sources actually support? A deterministic tool analyzer already flagged the structural grounding issues above — do NOT restate those; add faithfulness judgment (e.g. the answer over-claims relative to the snippet content).');
  }

  parts.push('\nAlso check language consistency: does the agent reply in the same language the user is writing in, across every turn (not just the first)? Flag any switch even if the rule engine\'s language_switch_flag score did not.');

  return parts.join('\n');
}

// Returns { findings, narrative, language_check, system_prompt_review, search_call_review }
// or throws — callers should catch and degrade gracefully.
export async function llmReview(sig, raw, ruleFindings, act = null) {
  const deep = extractDeep(raw);
  const client = createAIClient();
  const promptSig = { __raw: raw, __ruleFindings: ruleFindings };
  const resp = await client.chat.completions.create({
    model: MODELS.SMART,
    max_tokens: 2048,
    temperature: 0,
    messages: [
      { role: 'system', content: 'You are a precise, evidence-grounded diagnostic reviewer. Only report what the provided transcript/prompt/search data actually shows. Respond only via the structured_output tool.' },
      { role: 'user', content: buildPrompt(promptSig, deep, act) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'structured_output', description: 'Trace review findings.', schema: RESPONSE_SCHEMA },
    },
  });
  const content = resp.choices?.[0]?.message?.content;
  const parsed = safeJson(content);
  if (!parsed || typeof parsed !== 'object') throw new Error('LLM review returned unparseable output');
  return {
    findings: Array.isArray(parsed.findings) ? parsed.findings.map((f) => ({ ...f, source: 'llm' })) : [],
    narrative: parsed.narrative || null,
    language_check: parsed.language_check || null,
    system_prompt_review: (parsed.system_prompt_review && parsed.system_prompt_review.issues?.length) ? parsed.system_prompt_review : null,
    search_call_review: (Array.isArray(parsed.search_call_review) && parsed.search_call_review.length) ? parsed.search_call_review : null,
    search_calls: deep.searchCalls,
    had_system_prompt: !!deep.systemPrompt,
    had_search_calls: deep.searchCalls.length > 0,
  };
}

function mergeFindings(ruleFindings, llmFindings) {
  const merged = [...ruleFindings, ...llmFindings];
  merged.sort((a, b) => {
    const r = (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0);
    if (r !== 0) return r;
    return (b.confidence === 'high') - (a.confidence === 'high');
  });
  return merged;
}

// --------------------------------------------------------------------------- //
// Public API — deep (rule engine + LLM) equivalents of analyzeOne()/analyze()
// --------------------------------------------------------------------------- //

// analyzeOneDeep() — same contract as engine.analyzeOne(), but async and with
// the LLM pass merged in. Never throws for LLM failures: degrades to the
// rule-engine-only result with a note, so a model hiccup can't break analyze.
export async function analyzeOneDeep(raw) {
  const parsed = safeJson(raw) || {};
  const sig = extract(parsed);
  const ruleFindings = runRules(sig);

  // Deterministic tool & retrieval analysis over the full observations — works
  // with no eval scores and no model call.
  let activity = null;
  let toolFindings = [];
  try {
    activity = extractToolActivity(parsed);
    toolFindings = analyzeToolActivity(activity);
  } catch { activity = null; toolFindings = []; }

  // The LLM sees rule + tool findings so it adds causal judgment instead of
  // restating structural findings it can already see.
  const deterministic = [...ruleFindings, ...toolFindings];
  let llm;
  try {
    llm = await llmReview(sig, parsed, deterministic, activity);
  } catch (e) {
    llm = { findings: [], narrative: `AI review unavailable: ${e.message}`, language_check: null, system_prompt_review: null, search_call_review: null, search_calls: [], error: true };
  }

  const findings = mergeFindings(deterministic, llm.findings);
  const status = health(findings);
  sig.tool_activity = activity;
  sig.llm = {
    narrative: llm.narrative,
    language_check: llm.language_check,
    system_prompt_review: llm.system_prompt_review,
    search_call_review: llm.search_call_review,
    search_calls: llm.search_calls || [],
    error: !!llm.error,
  };
  const top = findings[0];
  const summary = top
    ? `${status} · ${findings.length} finding${findings.length === 1 ? '' : 's'} · root: ${LAYER_LABEL[top.layer]} — ${top.title}`
    : `${status} · no problems detected`;
  const report_md = renderSingle(sig, findings, status) + renderToolAppendix(activity);
  return { sig, findings, status, summary, report_md };
}

// A compact tool & retrieval appendix for the stored markdown report. Kept out
// of the engine's renderSingle so that stays byte-identical to the skill.
function renderToolAppendix(act) {
  if (!act || !act.counts.total) return '';
  const L = ['\n\n## Tool & retrieval activity'];
  L.push(`Searches: ${act.counts.search} · Sources cited: ${act.counts.display} · Agent selections: ${act.counts.selectAgent} · Retrieved: ${act.grounding.retrievedCount} · Cited-not-retrieved: ${act.grounding.citedNotRetrieved.length}`);
  act.searches.forEach((s, i) => {
    L.push(`\n**Search ${i + 1}** — \`${String(s.semanticQuery || '(no query)').slice(0, 120)}\``
      + `${s.keywordTerms.length ? ` · keywords: ${s.keywordTerms.join(', ')}` : ''}`
      + `${s.publishedAfter ? ` · publishedAfter: ${s.publishedAfter}` : ''}`
      + ` → **${s.resultCount == null ? '?' : s.resultCount} result(s)**${s.empty ? ' ⚠️ empty' : ''}`);
    if (s.titles.length) L.push(s.titles.slice(0, 5).map((t) => `  - ${String(t).slice(0, 90)}`).join('\n'));
  });
  if (act.displayed.length) {
    L.push(`\n**Cited sources:** ${act.displayed.map((d) => `${String(d.title || '?').slice(0, 70)}`).join(' · ')}`);
  }
  if (act.grounding.citedNotRetrieved.length) {
    L.push(`\n⚠️ **Cited but never retrieved:** ${act.grounding.citedNotRetrieved.map((t) => `"${String(t).slice(0, 60)}"`).join(', ')}`);
  }
  return L.join('\n');
}

// analyzeDeep() — same contract as engine.analyze(), but async and with the
// LLM pass merged in for every trace. Used by the Slack MCP connector, which
// (unlike the packaged Claude skill) has no live model reasoning over the
// output unless this module supplies it.
export async function analyzeDeep(input, format = 'markdown') {
  const data = safeJson(input);
  const list = Array.isArray(data) ? data : [data];
  const rows = await Promise.all(list.map(async (raw) => {
    const parsed = safeJson(raw);
    const { sig, findings, status } = await analyzeOneDeep(parsed || {});
    return { sig, findings, status };
  }));

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
