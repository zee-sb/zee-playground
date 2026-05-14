// chat-adapter — translates raw orchestrator/flow events (and persisted
// message rows from the database) into clean RenderItem[] for the chat UI.
//
// This is the seam: orchestrator event names and shapes can change without
// touching any React component, as long as the adapter still emits the same
// RenderItem shapes. Conversely, the UI can adopt new render kinds without
// the orchestrator knowing.
//
// Today: additive — ChatPanel.jsx's existing reduceMessages() / Item()
// switch continues to work unchanged. This file is the migration target.
// To adopt incrementally: route ONE event kind through the adapter, render
// it with the registry, ship it. Repeat per kind.
//
// Input sources the adapter must handle (per the plan's verification reqs):
//   1. Live NDJSON event stream from /api/companion/chat
//   2. Persisted message rows loaded from the DB on conversation open
//   3. localStorage-persisted flow state (form/confirm awaiting_user pause)

/**
 * @typedef {Object} RenderItem
 * @property {string} id              Stable id within the conversation.
 * @property {string} kind            See KINDS below.
 * @property {any}    [props]         kind-specific render props.
 * @property {number} [ts]            Monotonic timestamp for ordering.
 */

/**
 * RenderItem kinds the adapter produces. Each maps to a component via
 * src/ui/presentation/registry.js. Kinds are stable contracts — once shipped,
 * additive only.
 */
export const KINDS = Object.freeze({
  USER_MESSAGE: 'user-message',
  ASSISTANT_MESSAGE: 'assistant-message',  // text bubble (markdown-rendered)
  TRACE: 'trace',                           // classifier route trace
  TOOL_CALL: 'tool-call',                   // single tool invocation card
  FLOW_CARD: 'flow-card',                   // flow progress + completed steps
  FLOW_SUGGESTION_CHIP: 'flow-suggestion-chip',  // suggested-mode chip
  FORM: 'form',                             // flow FormStep inline render
  CONFIRM_SUMMARY: 'confirm-summary',       // flow ConfirmStep inline render
  PRESENTATION: 'presentation',             // MCP ToolResult.presentation entry
  REFUSAL: 'refusal',                       // out-of-scope short-circuit
  NEEDS_CONNECTION: 'needs-connection',     // one-tap connect card
  AGENT_HANDOFF: 'agent-handoff',           // A2A delegation handoff
  TRIVIA_QUESTION: 'trivia-question',       // hackathon trivia round
  ERROR: 'error',
});

/**
 * Map a raw orchestrator/flow event to one or more RenderItems.
 *
 * Currently a stub that the ChatPanel can opt into. The adapter is pure —
 * given an event, return RenderItems. Consumers accumulate them.
 *
 * @param {object} event   The NDJSON event object from the stream.
 * @param {object} [ctx]   Optional accumulator state (last items, lang, …).
 * @returns {RenderItem[]}
 */
export function adaptEvent(event, _ctx = {}) {
  if (!event || typeof event !== 'object') return [];
  switch (event.type) {
    case 'delta':
      // Streamed assistant text — consumers typically merge into the last
      // ASSISTANT_MESSAGE item rather than emitting a new one per chunk.
      return [{ kind: KINDS.ASSISTANT_MESSAGE, props: { delta: event.content } }];

    case 'tool_start':
    case 'tool_result':
      return [{
        kind: KINDS.TOOL_CALL,
        id: event.toolCallId,
        props: {
          toolCallId: event.toolCallId,
          name: event.name || event.toolName,
          connector: event.connector || event.serverId,
          connectorName: event.connectorName || event.serverName,
          status: event.type === 'tool_start' ? 'running' : 'done',
          args: event.args,
          result: event.result,
        },
      }];

    case 'trace_intent':
    case 'trace_route':
    case 'trace_tools':
    case 'trace_connectors':
      return [{ kind: KINDS.TRACE, props: { route: event } }];

    case 'flow_started':
    case 'flow_step':
    case 'flow_completed':
      return [{
        kind: KINDS.FLOW_CARD,
        id: event.flowId,
        props: event,
      }];

    case 'form_request':
      return [{
        kind: KINDS.FORM,
        id: `${event.flowId}:${event.stepId}`,
        props: {
          flowId: event.flowId,
          stepId: event.stepId,
          spec: event.spec,
          initialValues: event.initialValues,
        },
      }];

    case 'confirm_request':
      return [{
        kind: KINDS.CONFIRM_SUMMARY,
        id: `${event.flowId}:${event.stepId}`,
        props: {
          flowId: event.flowId,
          stepId: event.stepId,
          summary: event.summary,
        },
      }];

    case 'card':       // legacy: Staffbase server's `cards` pipeline
    case 'chart_card': // legacy: Staffbase analytics chart
      return [{
        kind: KINDS.PRESENTATION,
        props: {
          hint: event.type === 'card'
            ? { kind: event.card?.type, props: event.card }
            : { kind: 'chart', props: event.chart },
        },
      }];

    case 'refusal':
      return [{ kind: KINDS.REFUSAL, props: { message: event.message, reasoning: event.reasoning } }];

    case 'needs_connection':
      return [{ kind: KINDS.NEEDS_CONNECTION, props: { connectors: event.connectors } }];

    case 'a2a_delegate':
    case 'a2a_update':
    case 'a2a_done':
      return [{ kind: KINDS.AGENT_HANDOFF, props: event }];

    case 'error':
      return [{ kind: KINDS.ERROR, props: { message: event.message } }];

    default:
      return [];
  }
}

/**
 * Reduce a persisted message row (from the DB) into RenderItems. The
 * persisted shape is heterogeneous: user messages, assistant text turns,
 * stored tool-call traces, flow run snapshots.
 *
 * @param {object} row
 * @returns {RenderItem[]}
 */
export function adaptPersistedRow(row) {
  if (!row || typeof row !== 'object') return [];
  if (row.role === 'user') {
    return [{ kind: KINDS.USER_MESSAGE, id: row.id, props: { text: rowText(row), ts: row.created_at } }];
  }
  if (row.role === 'assistant') {
    return [{ kind: KINDS.ASSISTANT_MESSAGE, id: row.id, props: { text: rowText(row), ts: row.created_at } }];
  }
  // Tool / flow / system rows can carry inline render hints; consumers
  // extend this switch as they migrate persisted shapes into the adapter.
  return [];
}

function rowText(row) {
  const c = row.content;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    if (typeof c.text === 'string') return c.text;
    if (typeof c.content === 'string') return c.content;
  }
  return '';
}
