// Azure AI Foundry Anthropic adapter — exposes an OpenAI-Chat-Completions-shaped
// API so existing call sites in api/ and lib/ work unchanged.
//
// Routes to Anthropic's API via Azure AI Foundry's /anthropic/v1 path. The Azure
// endpoint speaks native Anthropic Messages API, so we use @anthropic-ai/sdk with
// a baseURL override.
//
// What the shim translates:
//   • messages: OpenAI roles (system/user/assistant/tool) ↔ Anthropic system + messages
//   • tools + tool_choice: OpenAI function-calling ↔ Anthropic tool_use
//   • stream: true (with content + tool_call deltas)
//   • response_format json_object: prompts the model to emit raw JSON
//   • response_format json_schema (strict): forced tool_use, returns JSON in message.content
//   • temperature
//
// Embeddings remain on OpenAI (Anthropic has no embeddings API). See lib/embeddings.mjs.

import Anthropic from '@anthropic-ai/sdk';

// NOTE: the official @anthropic-ai/sdk appends `/v1/messages` to baseURL, so the
// base must NOT already include `/v1` (otherwise you get a double-v1 404
// "api_not_supported"). The Vercel AI SDK snippet uses `/anthropic/v1` because
// that provider only appends `/messages` — different convention, same endpoint.
const AZURE_BASE_URL =
  process.env.AZURE_ANTHROPIC_BASE_URL
  || 'https://cog-swarm-dev-swedencentral-xe92i7.cognitiveservices.azure.com/anthropic';

// Default models = the Azure AI Foundry *deployment names* on this resource.
// Verified deployed: claude-haiku-4-5, claude-sonnet-4-6. No Opus deployment
// exists, so the "big" tier falls back to the smart (Sonnet) deployment.
// Overridable via env so cost/quality can shift without code changes.
const MODEL_FAST   = process.env.AZURE_MODEL_FAST   || 'claude-haiku-4-5';
const MODEL_SMART  = process.env.AZURE_MODEL_SMART  || 'claude-sonnet-4-6';
const MODEL_BIG    = process.env.AZURE_MODEL_BIG    || 'claude-sonnet-4-6';

// 4096 is too low for the JSON-producing callers (discovery passes, assistant
// creation): a rich workspace overflows it, the response stops with
// finish_reason=length, and the truncated JSON fails to parse — which silently
// drops the caller into its generic fallback. The previous OpenAI default was
// far higher, so the Azure swap is what introduced the regression. Claude
// Haiku 4.5 / Sonnet 4.6 both support well beyond this; callers can still
// override per-request.
const DEFAULT_MAX_TOKENS = 8192;

let _anthropic;
function getAnthropic() {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.AZURE_KEY;
  if (!apiKey) throw new Error('AZURE_KEY is not configured on the server');
  _anthropic = new Anthropic({
    apiKey,
    baseURL: AZURE_BASE_URL,
    defaultHeaders: { 'anthropic-version': '2023-06-01' },
  });
  return _anthropic;
}

// Map legacy OpenAI model names → Claude. Pass-through for already-claude IDs.
//   gpt-3.5*, gpt-4o-mini, gpt-4-mini  → fast tier (haiku)
//   gpt-5-mini, gpt-4o, gpt-5, gpt-4-turbo → smart tier (sonnet) — gpt-5-mini was
//     chosen in the source for its reasoning, not its size
//   opus / large / premium  → big tier
function mapModel(model) {
  if (!model) return MODEL_FAST;
  const m = String(model).toLowerCase();
  if (m.startsWith('claude-')) return model;
  if (/(opus|premium|large)/.test(m)) return MODEL_BIG;
  if (/gpt-?5(-mini|-nano)?$|gpt-?4(o)?(-turbo|-32k)?$|sonnet|smart/.test(m)) return MODEL_SMART;
  if (/(^|[-_])(nano|mini|small|fast|haiku|flash)([-_]|$)/.test(m)) return MODEL_FAST;
  if (/gpt-?3\.5/.test(m)) return MODEL_FAST;
  return MODEL_FAST;
}

// ── Request translation: OpenAI → Anthropic ──────────────────────────────────

function normalizeContentToString(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : (c?.text || '')))
      .join('');
  }
  return String(content);
}

// OpenAI messages ↔ Anthropic system+messages. Anthropic doesn't have a
// dedicated tool role — tool results become user messages with tool_result
// content blocks. Multiple consecutive system messages get concatenated.
function convertMessages(messages) {
  const systemParts = [];
  const out = [];
  let pendingToolResults = null;

  const flushToolResults = () => {
    if (pendingToolResults && pendingToolResults.length) {
      out.push({ role: 'user', content: pendingToolResults });
    }
    pendingToolResults = null;
  };

  for (const msg of messages || []) {
    if (!msg || !msg.role) continue;

    if (msg.role === 'system') {
      flushToolResults();
      const text = normalizeContentToString(msg.content);
      if (text) systemParts.push(text);
      continue;
    }

    if (msg.role === 'tool') {
      // Group consecutive tool results into a single user message.
      if (!pendingToolResults) pendingToolResults = [];
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: normalizeContentToString(msg.content),
      });
      continue;
    }

    flushToolResults();

    if (msg.role === 'assistant') {
      const blocks = [];
      const text = normalizeContentToString(msg.content);
      if (text) blocks.push({ type: 'text', text });
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          let input = {};
          try { input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; }
          catch { input = {}; }
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function?.name || 'unknown',
            input,
          });
        }
      }
      if (!blocks.length) blocks.push({ type: 'text', text: '' });
      out.push({ role: 'assistant', content: blocks });
      continue;
    }

    if (msg.role === 'user') {
      out.push({ role: 'user', content: normalizeContentToString(msg.content) });
      continue;
    }
  }
  flushToolResults();

  return {
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    messages: out,
  };
}

// OpenAI tools (function-calling shape) → Anthropic tools.
function convertTools(tools) {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  return tools.map((t) => {
    const fn = t.function || t;
    return {
      name: fn.name,
      description: fn.description || '',
      input_schema: sanitizeJsonSchema(fn.parameters || { type: 'object', properties: {} }),
    };
  });
}

function convertToolChoice(choice) {
  if (!choice) return undefined;
  if (choice === 'auto') return { type: 'auto' };
  if (choice === 'required') return { type: 'any' };
  if (choice === 'none') return undefined;
  if (typeof choice === 'object' && choice.type === 'function' && choice.function?.name) {
    return { type: 'tool', name: choice.function.name };
  }
  return undefined;
}

// Anthropic input_schema must be a plain JSON Schema object — strip $schema/$id
// and JSON-Schema features Anthropic doesn't like.
function sanitizeJsonSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
  const cloned = JSON.parse(JSON.stringify(schema));
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    delete n.$schema; delete n.$id;
    if (n.properties) Object.values(n.properties).forEach(walk);
    if (n.items) walk(n.items);
    for (const k of ['oneOf', 'anyOf', 'allOf']) if (Array.isArray(n[k])) n[k].forEach(walk);
  };
  walk(cloned);
  if (!cloned.type) cloned.type = 'object';
  return cloned;
}

// ── Response translation: Anthropic → OpenAI ─────────────────────────────────

// Anthropic stop_reason → OpenAI finish_reason.
function mapFinish(stopReason) {
  switch (stopReason) {
    case 'end_turn':       return 'stop';
    case 'stop_sequence':  return 'stop';
    case 'max_tokens':     return 'length';
    case 'tool_use':       return 'tool_calls';
    default:               return 'stop';
  }
}

// Strip a leading/trailing markdown code fence (```json … ``` or ``` … ```).
// Claude often wraps JSON in fences even when told not to; callers that
// JSON.parse the content directly choke on them.
function stripCodeFences(text) {
  if (!text) return text;
  let t = text.trim();
  const fence = t.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  return t;
}

// Non-streaming Anthropic response → OpenAI Chat Completion shape.
// When jsonSchemaMode is true, the model produced a forced tool_use; we emit
// its input as message.content (JSON string) so callers using JSON.parse work.
// When jsonObjectMode is true, we strip markdown fences so the content parses.
function adaptResponseToOpenAI(resp, model, jsonSchemaMode, jsonObjectMode) {
  const content = Array.isArray(resp.content) ? resp.content : [];
  let text = '';
  const toolCalls = [];
  for (const block of content) {
    if (block.type === 'text') text += block.text || '';
    else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }

  if (jsonSchemaMode && toolCalls.length) {
    // Caller expects message.content to be parseable JSON.
    text = toolCalls[0].function.arguments;
    toolCalls.length = 0;
  } else if (jsonObjectMode) {
    text = stripCodeFences(text);
  }

  return {
    id: resp.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: mapFinish(resp.stop_reason),
    }],
    usage: resp.usage ? {
      prompt_tokens: resp.usage.input_tokens || 0,
      completion_tokens: resp.usage.output_tokens || 0,
      total_tokens: (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0),
    } : undefined,
  };
}

// Wraps Anthropic stream → async iterable of OpenAI-shape chunks.
//
// Anthropic events we care about:
//   • content_block_start  { index, content_block: { type, ... } }
//   • content_block_delta  { index, delta: { type: text_delta | input_json_delta, ... } }
//   • content_block_stop   { index }
//   • message_delta        { delta: { stop_reason } }
//   • message_stop
//
// Tool-call indices in OpenAI's stream are 0-based among tool_calls only, not
// across all content blocks — we maintain a separate counter.
async function* adaptStreamToOpenAI(stream, model, jsonSchemaMode) {
  const id = `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = Math.floor(Date.now() / 1000);
  const blockToToolIdx = new Map(); // anthropic block index → openai tool_calls index
  let nextToolIdx = 0;
  let jsonBuffer = ''; // for jsonSchemaMode — accumulate tool input as text delta
  let finishReason = null;

  const baseChunk = (delta, extra = {}) => ({
    id, object: 'chat.completion.chunk', created, model,
    choices: [{ index: 0, delta, finish_reason: null, ...extra }],
  });

  // Opening role chunk — some OpenAI consumers expect a leading role delta.
  yield baseChunk({ role: 'assistant', content: '' });

  for await (const evt of stream) {
    if (!evt || !evt.type) continue;

    if (evt.type === 'content_block_start') {
      const block = evt.content_block;
      if (block?.type === 'tool_use') {
        const toolIdx = nextToolIdx++;
        blockToToolIdx.set(evt.index, toolIdx);
        if (jsonSchemaMode) {
          // No tool_call surface — input chunks will be re-emitted as content.
          continue;
        }
        yield baseChunk({
          tool_calls: [{
            index: toolIdx,
            id: block.id,
            type: 'function',
            function: { name: block.name, arguments: '' },
          }],
        });
      }
      continue;
    }

    if (evt.type === 'content_block_delta') {
      const d = evt.delta;
      if (!d) continue;

      if (d.type === 'text_delta' && d.text) {
        yield baseChunk({ content: d.text });
        continue;
      }

      if (d.type === 'input_json_delta') {
        const piece = d.partial_json || '';
        if (jsonSchemaMode) {
          jsonBuffer += piece;
          yield baseChunk({ content: piece });
          continue;
        }
        const toolIdx = blockToToolIdx.get(evt.index);
        if (toolIdx === undefined) continue;
        yield baseChunk({
          tool_calls: [{
            index: toolIdx,
            function: { arguments: piece },
          }],
        });
        continue;
      }
      continue;
    }

    if (evt.type === 'message_delta') {
      if (evt.delta?.stop_reason) finishReason = mapFinish(evt.delta.stop_reason);
      continue;
    }

    if (evt.type === 'message_stop') {
      break;
    }
  }

  yield {
    id, object: 'chat.completion.chunk', created, model,
    choices: [{ index: 0, delta: {}, finish_reason: finishReason || 'stop' }],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

async function createCompletion(params) {
  const anthropic = getAnthropic();
  const model = mapModel(params.model);

  const { system, messages } = convertMessages(params.messages);
  const tools = convertTools(params.tools);
  const tool_choice = convertToolChoice(params.tool_choice);

  // response_format handling
  let extraSystem = '';
  let jsonSchemaTool = null;
  let jsonObjectMode = false;
  const rf = params.response_format;
  if (rf?.type === 'json_object') {
    jsonObjectMode = true;
    extraSystem = 'Respond ONLY with a single valid JSON object. Do not wrap it in markdown code fences. No prose, no commentary — output must start with { and end with }.';
  } else if (rf?.type === 'json_schema' && rf.json_schema?.schema) {
    jsonSchemaTool = {
      name: rf.json_schema.name || 'structured_output',
      description: rf.json_schema.description || 'Return the structured output.',
      input_schema: sanitizeJsonSchema(rf.json_schema.schema),
    };
  }

  const finalSystem = [system, extraSystem].filter(Boolean).join('\n\n') || undefined;

  const req = {
    model,
    max_tokens: params.max_tokens || DEFAULT_MAX_TOKENS,
    messages,
  };
  if (finalSystem) req.system = finalSystem;
  if (typeof params.temperature === 'number') req.temperature = params.temperature;
  if (typeof params.top_p === 'number') req.top_p = params.top_p;
  if (Array.isArray(params.stop)) req.stop_sequences = params.stop;

  if (jsonSchemaTool) {
    req.tools = [jsonSchemaTool];
    req.tool_choice = { type: 'tool', name: jsonSchemaTool.name };
  } else if (tools) {
    req.tools = tools;
    if (tool_choice) req.tool_choice = tool_choice;
  }

  if (params.stream) {
    const stream = await anthropic.messages.stream(req);
    return adaptStreamToOpenAI(stream, model, !!jsonSchemaTool);
  }

  const resp = await anthropic.messages.create(req);
  return adaptResponseToOpenAI(resp, model, !!jsonSchemaTool, jsonObjectMode);
}

export function createAIClient() {
  return {
    chat: {
      completions: { create: createCompletion },
    },
  };
}

// Direct access to model IDs in case a caller wants to override per-request.
export const MODELS = {
  FAST: MODEL_FAST,
  SMART: MODEL_SMART,
  BIG: MODEL_BIG,
};
