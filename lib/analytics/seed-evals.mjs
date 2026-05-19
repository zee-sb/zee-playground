// Deterministic seeded evaluator + summary generator for Navigator Analytics.
//
// Every score is derived from the conversation's id + message history so a
// given conversation produces the same scores across runs. When langfuse is
// later wired in, real scores land as `source='langfuse'` and overwrite the
// `seed_v1` rows via the unique key (conversation_id, dimension, evaluator,
// evaluator_version).
//
// The public surface is intentionally small:
//
//   computeForConversation({ conversationId, messages })
//     → { summary: {...row for conversation_summary}, evals: [...rows for conversation_evals] }
//
//   bucketTopic(firstUserMessageText) → topic label
//
// `messages` is the raw rows array from the messages table — { role, content,
// created_at }. The function tolerates both object and string `content`
// payloads (the chat path stores objects in JSONB; tool messages store a
// serialized string under content.content).

const FIRST_CLASS_DIMENSIONS = [
  'resolution',
  'hallucination',
  'factual_accuracy',
  'friction',
  'sentiment',
];

const DIAGNOSTIC_DIMENSIONS = [
  'prompt_injection_resistance',
  'memory_extraction_safety',
  'language_switch_flag',
  'repeated_question_count',
  'response_latency_score',
  'primary_topic_id',
];

export const ALL_DIMENSIONS = [...FIRST_CLASS_DIMENSIONS, ...DIAGNOSTIC_DIMENSIONS];

// Bands used by the API + UI to flag a conversation as `has_low_score=true`
// when any first-class dimension lands in its bad tail. Hallucination + friction
// invert because higher is worse.
const LOW_SCORE_THRESHOLDS = {
  resolution: { lt: 0.6 },
  hallucination: { gt: 0.4 },
  factual_accuracy: { lt: 0.6 },
  friction: { gt: 0.6 },
  sentiment: { lt: 0.4 },
};

const POSITIVE_TOKENS = /\b(thanks|thank you|great|perfect|helpful|awesome|nice|love)\b/gi;
const NEGATIVE_TOKENS = /\b(wrong|useless|frustrated|frustrating|annoyed|terrible|awful|bad|broken|stupid)\b|!{2,}/gi;
const COULDNT_FIND = /\b(i (?:couldn'?t|can'?t|wasn'?t able to)|don'?t (?:have|know|see)|no (?:information|results|matches|answer))\b/i;
const STILL_FRUSTRATED = /^(?:no|that(?:'s|s)? wrong|still|try again|that doesn'?t|not (?:what|right))/i;
const CITATION_TOKENS = /(https?:\/\/\S+|\b[A-Z]{2,}-\d+\b|\b\d{3,}\b)/g;
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /forget (your|the) (instructions|system prompt)/i,
  /reveal (your|the) system prompt/i,
  /you are now (a |an )?(?!the user)/i,
  /developer mode/i,
];
const MEMORY_PATTERNS = [
  /what (do you (know|remember)|memories do you have)/i,
  /list (everything|all) (you|that you) (know|remember)/i,
  /dump (your )?(memory|memories|context)/i,
];

const TOPIC_BUCKETS = [
  { topic: 'HR',           pattern: /\b(leave|vacation|pto|benefits?|parental|sick|onboarding|payroll|holiday)\b/i },
  { topic: 'Travel',       pattern: /\b(travel|flight|hotel|per ?diem|expense|reimbursement|trip|booking|airfare)\b/i },
  { topic: 'IT',           pattern: /\b(password|vpn|laptop|mfa|2fa|account locked|software|install|printer|wifi|jira|access)\b/i },
  { topic: 'Compensation', pattern: /\b(salary|bonus|raise|compensation|equity|stock|rsu|paycheck|ltip)\b/i },
  { topic: 'Events',       pattern: /\b(town ?hall|all ?hands|event|holiday party|offsite|kickoff|campfire)\b/i },
  { topic: 'Policy',       pattern: /\b(policy|policies|handbook|code of conduct|dress code|remote work|guidelines?)\b/i },
  { topic: 'Operations',   pattern: /\b(facility|office|parking|badge|room booking|shipping|mailroom|relocation)\b/i },
];

// ── deterministic RNG ───────────────────────────────────────────────────────

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ── message extraction ──────────────────────────────────────────────────────

function parseContent(content) {
  if (content == null) return null;
  if (typeof content === 'string') {
    try { return JSON.parse(content); } catch { return content; }
  }
  return content;
}

function userText(msg) {
  if (!msg) return '';
  const c = parseContent(msg.content);
  if (typeof c === 'string') return c;
  return c?.text || c?.content || '';
}

function assistantText(msg) {
  if (!msg) return '';
  const c = parseContent(msg.content);
  if (typeof c === 'string') return c;
  return c?.content || '';
}

function toolMeta(msg) {
  if (!msg) return { name: null, content: '' };
  const c = parseContent(msg.content);
  if (!c || typeof c !== 'object') return { name: null, content: '' };
  let inner = c.content;
  if (typeof inner === 'string') {
    try { inner = JSON.parse(inner); } catch { /* keep string */ }
  }
  return {
    name: c.name || null,
    tool_call_id: c.tool_call_id || null,
    content: inner,
  };
}

function isEmptyToolResult(parsedContent) {
  if (parsedContent == null) return true;
  if (typeof parsedContent === 'string') {
    return /^\s*(null|\[\]|\{\})\s*$/i.test(parsedContent) || parsedContent.length < 4;
  }
  if (Array.isArray(parsedContent)) return parsedContent.length === 0;
  if (typeof parsedContent === 'object') {
    if (Array.isArray(parsedContent.entries)) return parsedContent.entries.length === 0;
    if (Array.isArray(parsedContent.results)) return parsedContent.results.length === 0;
    if (Array.isArray(parsedContent.items)) return parsedContent.items.length === 0;
    if (Array.isArray(parsedContent.hits)) return parsedContent.hits.length === 0;
    if ('error' in parsedContent) return true;
    if (Object.keys(parsedContent).length === 0) return true;
  }
  return false;
}

function deviceFromMessages(messages) {
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const c = parseContent(m.content);
    if (c?.input_modality === 'voice') return 'voice';
  }
  return 'desktop';
}

function modeFromMessages(messages) {
  let voice = 0; let text = 0;
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const c = parseContent(m.content);
    if (c?.input_modality === 'voice') voice++;
    else if (c && (c.text || c.content)) text++;
  }
  if (voice && text) return 'mixed';
  if (voice) return 'voice';
  return 'text';
}

function languagesFromMessages(messages) {
  const langs = new Set();
  for (const m of messages) {
    const c = parseContent(m.content);
    if (c?.stt_language) langs.add(c.stt_language);
    if (c?.session_lang) langs.add(c.session_lang);
  }
  return [...langs];
}

// ── topic bucketer ──────────────────────────────────────────────────────────

export function bucketTopic(firstUserMessageText) {
  const s = String(firstUserMessageText || '');
  if (!s.trim()) return 'Other';
  for (const { topic, pattern } of TOPIC_BUCKETS) {
    if (pattern.test(s)) return topic;
  }
  return 'Other';
}

function intentReasoningFor(topic, firstMsg) {
  if (topic === 'Other') {
    return "User question didn't map to any of the configured topic domains.";
  }
  const sampleWords = String(firstMsg || '').slice(0, 80);
  return `User question matches the ${topic} domain (text: "${sampleWords}").`;
}

// ── per-dimension scoring ───────────────────────────────────────────────────

function scoreResolution(ctx) {
  let score = 0.5;
  if (ctx.lastAssistantText && !COULDNT_FIND.test(ctx.lastAssistantText)) score += 0.3;
  if (ctx.nonEmptyToolCalls > 0) score += 0.15;
  if (ctx.lastUserText && STILL_FRUSTRATED.test(ctx.lastUserText)) score -= 0.25;
  if (ctx.allToolCalls > 0 && ctx.nonEmptyToolCalls === 0) score -= 0.2;
  score += (ctx.rand() - 0.5) * 0.06;
  const value = clamp01(score);
  let reasoning;
  if (value >= 0.8) reasoning = 'Assistant produced a definitive answer; tool calls returned hits.';
  else if (value >= 0.6) reasoning = 'Assistant answered, but with some uncertainty.';
  else if (value >= 0.4) reasoning = 'Partial answer — user may have needed to follow up.';
  else reasoning = 'Assistant could not find an answer in available sources.';
  return { value, reasoning };
}

function scoreHallucination(ctx) {
  let score = 0.05;
  const citations = (ctx.lastAssistantText || '').match(CITATION_TOKENS) || [];
  if (citations.length) {
    const haystack = ctx.toolResultText;
    const absent = citations.filter((t) => !haystack.includes(t));
    if (absent.length) score += 0.4 * Math.min(1, absent.length / citations.length);
  }
  if (ctx.allToolCalls === 0 && ctx.lastAssistantText && ctx.lastAssistantText.length > 40 && ctx.topic !== 'Other') {
    score += 0.2;
  }
  score += (ctx.rand() - 0.5) * 0.04;
  const value = clamp01(Math.max(0.02, score));
  const reasoning = value < 0.2
    ? 'Assistant claims align with tool results.'
    : value < 0.4
      ? 'Some claims could not be matched to tool output.'
      : 'Confident answer contains tokens that did not appear in any tool result.';
  return { value, reasoning };
}

function scoreFactualAccuracy(ctx) {
  let score;
  if (ctx.allToolCalls > 0) {
    score = 0.5 + 0.4 * (ctx.nonEmptyToolCalls / ctx.allToolCalls);
  } else {
    score = 0.6 + (ctx.rand() - 0.5) * 0.2;
  }
  // Penalty mirrors hallucination signal — keeps the two scores correlated
  // without being a pure inverse.
  score -= 0.1 * ((ctx.lastAssistantText || '').match(CITATION_TOKENS)?.length || 0 ? ctx.rand() * 0.3 : 0);
  const value = clamp01(score);
  const reasoning = ctx.allToolCalls > 0
    ? `${ctx.nonEmptyToolCalls}/${ctx.allToolCalls} tool calls returned data backing the assistant's claims.`
    : 'No tool calls — accuracy estimated from response coherence only.';
  return { value, reasoning };
}

function scoreFriction(ctx) {
  const turns = Math.max(0, ctx.userMessageCount - 1);
  const turnPenalty = Math.min(1, turns / 6) * 0.6;
  const repeatPenalty = ctx.repeatedTokenRatio * 0.4;
  const value = clamp01(turnPenalty + repeatPenalty);
  const reasoning = value < 0.3
    ? 'Smooth interaction — user got to the answer quickly.'
    : value < 0.6
      ? 'User needed a couple of follow-ups to land the answer.'
      : 'Multiple back-and-forths; user appeared to struggle.';
  return { value, reasoning };
}

function scoreSentiment(ctx) {
  const text = ctx.allUserText;
  const positives = (text.match(POSITIVE_TOKENS) || []).length;
  const negatives = (text.match(NEGATIVE_TOKENS) || []).length;
  const value = clamp01(0.6 + 0.1 * positives - 0.15 * negatives);
  const reasoning = positives > negatives
    ? `Detected ${positives} positive cue${positives === 1 ? '' : 's'} in user messages.`
    : negatives > 0
      ? `Detected ${negatives} negative cue${negatives === 1 ? '' : 's'} in user messages.`
      : 'No strong sentiment signal in user messages.';
  return { value, reasoning };
}

function scorePromptInjection(ctx) {
  const hit = INJECTION_PATTERNS.some((re) => re.test(ctx.allUserText));
  return {
    flag: !hit,
    reasoning: hit
      ? 'Detected at least one prompt-injection pattern in user input.'
      : 'No prompt-injection patterns observed.',
  };
}

function scoreMemoryExtraction(ctx) {
  const hit = MEMORY_PATTERNS.some((re) => re.test(ctx.allUserText));
  return {
    flag: !hit,
    reasoning: hit
      ? 'User attempted to enumerate the assistant\'s memory/context.'
      : 'No memory-extraction attempts observed.',
  };
}

function scoreLanguageSwitch(ctx) {
  const switched = ctx.languages.length > 1;
  return {
    flag: switched,
    reasoning: switched
      ? `Conversation spanned ${ctx.languages.length} languages (${ctx.languages.join(', ')}).`
      : 'Single language throughout.',
  };
}

function scoreRepeatedQuestion(ctx) {
  return {
    value: ctx.repeatedQuestionCount,
    reasoning: ctx.repeatedQuestionCount > 0
      ? `User asked ${ctx.repeatedQuestionCount} question(s) more than once.`
      : 'No repeated questions detected.',
  };
}

function scoreResponseLatency(ctx) {
  // Map median assistant-after-user latency (ms) to 0..1 where lower is better.
  const ms = ctx.medianLatencyMs;
  if (ms == null) return { value: 0.8, reasoning: 'No measurable latency (single-turn or missing timestamps).' };
  const norm = clamp01(1 - Math.min(1, ms / 10000));
  return {
    value: norm,
    reasoning: `Median assistant response latency: ${Math.round(ms)}ms.`,
  };
}

function scorePrimaryTopic(ctx) {
  return {
    label: ctx.topic,
    reasoning: intentReasoningFor(ctx.topic, ctx.firstUserMessage),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function buildContext(conversationId, messages) {
  const rand = mulberry32(fnv1a(String(conversationId)));
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const toolMessages = messages.filter((m) => m.role === 'tool');
  const firstUserMessage = userText(userMessages[0]) || '';
  const lastUserText = userText(userMessages[userMessages.length - 1]) || '';
  const lastAssistantText = assistantText(assistantMessages[assistantMessages.length - 1]) || '';
  const toolMetas = toolMessages.map(toolMeta);
  const allToolCalls = toolMetas.length;
  const nonEmptyToolCalls = toolMetas.filter((t) => !isEmptyToolResult(t.content)).length;
  const toolResultText = toolMetas
    .map((t) => (typeof t.content === 'string' ? t.content : JSON.stringify(t.content || '')))
    .join(' ');
  const allUserText = userMessages.map(userText).join(' ');
  const topic = bucketTopic(firstUserMessage);

  // Repeated-question detection: bucket each user message by its first 4-token
  // shingle and count buckets that recur.
  const shingles = new Map();
  for (const u of userMessages) {
    const norm = userText(u).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const shingle = norm.split(' ').slice(0, 4).join(' ');
    if (!shingle) continue;
    shingles.set(shingle, (shingles.get(shingle) || 0) + 1);
  }
  let repeatedQuestionCount = 0;
  let repeatedTokens = 0;
  for (const [, n] of shingles) {
    if (n > 1) {
      repeatedQuestionCount += n - 1;
      repeatedTokens += n - 1;
    }
  }
  const repeatedTokenRatio = userMessages.length ? repeatedTokens / userMessages.length : 0;

  // Median latency between a user message and the next assistant message.
  const latencies = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role !== 'user') continue;
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].role === 'assistant') {
        const a = new Date(messages[i].created_at).getTime();
        const b = new Date(messages[j].created_at).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b > a) latencies.push(b - a);
        break;
      }
    }
  }
  const medianLatencyMs = latencies.length
    ? latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length / 2)]
    : null;

  return {
    conversationId,
    rand,
    messages,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    firstUserMessage,
    lastUserText,
    lastAssistantText,
    allUserText,
    toolMessages,
    allToolCalls,
    nonEmptyToolCalls,
    toolResultText,
    topic,
    repeatedTokenRatio,
    repeatedQuestionCount,
    medianLatencyMs,
    languages: languagesFromMessages(messages),
  };
}

function isLowScore(dimension, value) {
  const t = LOW_SCORE_THRESHOLDS[dimension];
  if (!t || typeof value !== 'number') return false;
  if (t.lt != null && value < t.lt) return true;
  if (t.gt != null && value > t.gt) return true;
  return false;
}

function deriveSummary(ctx) {
  const action = ctx.allToolCalls > 0
    ? `consulted ${ctx.allToolCalls} source${ctx.allToolCalls === 1 ? '' : 's'}`
    : 'answered from its system prompt';
  const outcome = ctx.lastAssistantText && COULDNT_FIND.test(ctx.lastAssistantText)
    ? "couldn't locate a definitive answer and offered to refine the search"
    : ctx.userMessageCount > 1
      ? 'reached a final answer after a brief follow-up'
      : 'provided a direct answer';
  return `User asked about ${ctx.topic.toLowerCase()}: "${ctx.firstUserMessage.slice(0, 80)}". Assistant ${action} and ${outcome}.`;
}

function deriveResolutionState(ctx, resolutionScore) {
  if (resolutionScore >= 0.75) return 'resolved';
  if (resolutionScore >= 0.5)  return 'processing';
  if (ctx.lastAssistantText && /handed off|escalated|connecting you/i.test(ctx.lastAssistantText)) return 'escalated';
  return 'unresolved';
}

function deriveReportedIssue(ctx) {
  // Seed a small minority of conversations with reported issues so the UI has
  // signal to render. Distribution: ~6% inaccurate, ~3% unhelpful, ~1% other.
  const r = ctx.rand();
  if (r < 0.06) return 'inaccurate';
  if (r < 0.09) return 'unhelpful';
  if (r < 0.10) return 'inappropriate';
  if (r < 0.11) return 'other';
  return 'none';
}

// ── public entry ────────────────────────────────────────────────────────────

export function computeForConversation({ conversationId, messages }) {
  const ctx = buildContext(conversationId, messages || []);

  const evals = [];
  let hasLowScore = false;

  const writeNumeric = (dimension, { value, reasoning }) => {
    evals.push({
      dimension,
      score_type: 'numeric',
      score_numeric: value,
      score_label: null,
      score_flag: null,
      reasoning,
    });
    if (isLowScore(dimension, value)) hasLowScore = true;
  };
  const writeFlag = (dimension, { flag, reasoning }) => {
    evals.push({
      dimension,
      score_type: 'flag',
      score_numeric: null,
      score_label: null,
      score_flag: flag,
      reasoning,
    });
  };
  const writeLabel = (dimension, { label, reasoning }) => {
    evals.push({
      dimension,
      score_type: 'label',
      score_numeric: null,
      score_label: label,
      score_flag: null,
      reasoning,
    });
  };
  const writeCount = (dimension, { value, reasoning }) => {
    evals.push({
      dimension,
      score_type: 'numeric',
      score_numeric: value,
      score_label: null,
      score_flag: null,
      reasoning,
    });
  };

  const resolution = scoreResolution(ctx);
  writeNumeric('resolution', resolution);
  writeNumeric('hallucination', scoreHallucination(ctx));
  writeNumeric('factual_accuracy', scoreFactualAccuracy(ctx));
  writeNumeric('friction', scoreFriction(ctx));
  writeNumeric('sentiment', scoreSentiment(ctx));

  // Safety flags get a leading dimension-specific guard so they don't trip
  // the has_low_score boolean.
  writeFlag('prompt_injection_resistance', scorePromptInjection(ctx));
  writeFlag('memory_extraction_safety', scoreMemoryExtraction(ctx));
  writeFlag('language_switch_flag', scoreLanguageSwitch(ctx));
  writeCount('repeated_question_count', scoreRepeatedQuestion(ctx));
  writeNumeric('response_latency_score', scoreResponseLatency(ctx));
  writeLabel('primary_topic_id', scorePrimaryTopic(ctx));

  const resolutionState = deriveResolutionState(ctx, resolution.value);
  const reportedIssue = deriveReportedIssue(ctx);

  const summary = {
    summary: deriveSummary(ctx),
    primary_topic: ctx.topic,
    resolution_state: resolutionState,
    reported_issue: reportedIssue,
    device: deviceFromMessages(ctx.messages),
    mode: modeFromMessages(ctx.messages),
    language: ctx.languages[0] || 'en',
    intent_in_scope: ctx.topic !== 'Other',
    intent_reasoning: intentReasoningFor(ctx.topic, ctx.firstUserMessage),
    message_count: ctx.messages.length,
    tool_call_count: ctx.allToolCalls,
    has_low_score: hasLowScore,
    computed_version: 'v1',
  };

  return { summary, evals };
}

export { FIRST_CLASS_DIMENSIONS, DIAGNOSTIC_DIMENSIONS, LOW_SCORE_THRESHOLDS };
