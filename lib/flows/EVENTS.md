# Flow events

The flow runtime emits these events. The orchestrator streams them through to the chat shell, which routes them via `src/ui/chat-adapter.js` (after Phase 4).

All events flow as NDJSON over the orchestrator's existing event channel. None are flow-only transports — same wire format as `tool_call` / `tool_result`.

| Event | Fires when | Payload |
|---|---|---|
| `flow_started` | A trigger matched and step machine began | `{ flowId, name, mode, goal, totalSteps, steps: [{id, type, label}] }` |
| `flow_step` | A form/confirm pauses, OR a tool step completes | `{ flowId, stepIndex, totalSteps, label, status, stepId, summary? }` where `status` is `"awaiting_user"` or `"done"` |
| `form_request` | Step machine reached a `FormStep` | `{ flowId, stepId, label, spec, initialValues }` |
| `confirm_request` | Step machine reached a `ConfirmStep` | `{ flowId, stepId, label, summary }` |
| `flow_completed` | All steps done OR user cancelled | `{ flowId, summary }` |
| `tool_start` | A `ToolStep` is about to dispatch its MCP call | `{ toolCallId, name, connector, connectorKind, connectorName, args }` |
| `tool_result` | The dispatched MCP call returned | `{ toolCallId, name, connector, result }` |

`tool_start` / `tool_result` shapes are identical to the orchestrator's agentic-loop tool events — the UI doesn't need to discriminate by source.

## Pause and resume

When the runtime emits `form_request` or `confirm_request`, the step machine pauses. The chat shell:

1. Renders the form/confirm UI from the event payload.
2. Persists run state via the `onSystemMessage` callback (today: localStorage; could be DB).
3. On user submit, POSTs back to the orchestrator with `flowSubmission = { kind, stepId, values | accepted }`.
4. Orchestrator passes the submission into `runFlow` via the FlowProvider port; runtime applies it and resumes.

The `flow_step.status === "awaiting_user"` event is the explicit pause signal — `flow_completed` is the terminal signal.

## Token interpolation

Any string field in a step (form description, tool args, confirm summary rows) can reference outputs of prior steps via `{{stepId.fieldId}}`. The runtime resolves these at the moment the step is reached, NOT at flow definition time. See `lib/flows/runtime.mjs::resolveTokens`.
