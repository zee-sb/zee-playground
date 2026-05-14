# `lib/flows/` — multi-step automations

**Status: Phase 2 in progress. `runtime.mjs` and `templates.mjs` have moved into this directory. Typedefs live in [types.mjs](types.mjs); event contract in [EVENTS.md](EVENTS.md). The `FlowProvider` port is defined at [`lib/orchestrator/flow-provider.mjs`](../orchestrator/flow-provider.mjs); rewiring the orchestrator to use it (instead of importing runtime helpers directly) is deferred to a follow-up because it touches the 2351-line orchestrator and risks regressions. The `scaffold-flow` extraction from `api/navigator-assistant.mjs` and the flow-CRUD extraction from `lib/workspace-config.mjs` are also deferred — those files have uncommitted edits in the current working tree.**

Deterministic, multi-step automations: collect input from the user, call MCP tools, summarise and confirm. No free-form LLM reasoning at runtime — flows are explicit.

## Contract

```
runFlow({
  flow,        // a Flow definition (see below)
  run,         // optional FlowRun for resume
  scope,       // { connectorById }  — supplied by the orchestrator
  userContext,
  userText,    // initial trigger phrase
  emit,        // event sink
  onSystemMessage  // for persisting run state to localStorage / DB
}) → AsyncIterable<FlowEvent>
```

The orchestrator invokes this only via the `FlowProvider` port; flows never see the chat history or classifier.

## Data model

```
Flow {
  id, name,
  trigger,           // phrase used by matchesFlowTrigger
  status: draft | active | archived,
  mode:   suggested | required,   // suggested = show chip; required = auto-start
  goal,              // shown to user
  instructions,      // shown to user
  onComplete,        // final summary message
  tools:  [{ connectorId, toolId }],
  steps:  FlowStep[]
}

FlowStep =
  | FormStep    { id, type: "form",    label, spec: { title, description, submitLabel, fields[] } }
  | ToolStep    { id, type: "tool",    label, tool: { connectorId, toolId }, args, output }
  | ConfirmStep { id, type: "confirm", label, summary: { title, description, rows, confirmLabel, cancelLabel, cancelTo } }

FlowRun {
  flowId, currentStepIndex,
  stepOutputs: { [stepId]: formValues | toolResult },
  status: running | awaiting_user | completed | cancelled,
  awaiting: { kind, stepId } | null
}
```

Token interpolation: any string field can reference prior step outputs via `{{stepId.fieldId}}`.

## Events

| Event | When | Payload |
|---|---|---|
| `flow_started` | flow matched | `{ flowId, name, mode, goal, totalSteps, steps[] }` |
| `flow_step` | form/confirm pause OR tool completes | `{ flowId, stepIndex, totalSteps, label, status, stepId, summary? }` |
| `form_request` | reached a FormStep | `{ flowId, stepId, label, spec, initialValues }` |
| `confirm_request` | reached a ConfirmStep | `{ flowId, stepId, label, summary }` |
| `flow_completed` | all steps done or cancelled | `{ flowId, summary }` |
| `tool_start`, `tool_result` | ToolStep dispatches an MCP call | same as orchestrator's tool events |

Full event reference: `lib/flows/EVENTS.md` (Phase 2).

## Detection

`matchesFlowTrigger(userText, flow)` — deterministic phrase matching:
- Tokenizes both into notable words (>2 chars, non-stopword).
- Fires if a single strong overlap (≥3 chars) OR two notable-word overlaps.

Pluggable: `FlowProvider.match()` can swap in an LLM-assisted matcher that reads blueprint topic clusters (open question; see Phase 2).

## Authoring API

Server endpoint `api/flows.mjs` (Phase 2):
- `GET /api/flows?action=list`
- `POST /api/flows?action=create | update | delete`
- `POST /api/flows?action=scaffold` — LLM generates flow steps from a description. Prompt: `lib/flows/prompts/scaffold-flow.txt`.

Templates: `lib/flows/templates.mjs` exports `FLOW_TEMPLATES` (Request PTO, Report Issue, etc.).

## Persistence

- Flow definitions: `navigator_config.flows` (JSONB).
- Run state during a paused flow (after a `form_request` or `confirm_request`): persisted by the chat shell via the `onSystemMessage` callback (today: localStorage; could be DB).

## How to port

1. Copy `lib/flows/` to your project.
2. Wire `navigator_config.flows` equivalent in your DB (or substitute).
3. Implement a `FlowProvider` that delegates to `runFlow`.
4. Implement run-state persistence (localStorage or DB).
5. UI: subscribe to flow events, render via `src/ui/` presentation registry.

## Coupling notes

- Flows do NOT have their own MCP routing. They call MCPs through the `scope.connectorById` passed in by the orchestrator (same `lib/mcp/` envelope).
- Flows do NOT make LLM calls at runtime. The only LLM call in this module is authoring-time (scaffold).
- Flow detection does NOT depend on discovery output today. Optional future enhancement.
