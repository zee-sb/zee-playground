# `src/ui/` — chat shell UI

**Status: Phase 4 in progress. The presentation registry ([presentation/registry.js](presentation/registry.js)) and the chat-adapter ([chat-adapter.js](chat-adapter.js)) are in place — both purely additive. Existing components live at `src/prototypes/StaffbaseCompanion/{ChatPanel, CardRouter, FlowCard, ToolCallCard, TraceCard}.jsx` and continue to work unchanged. To adopt incrementally: pick a single event kind, route it through `adaptEvent`, render it through `lookup(kind)`, ship it. Repeat per kind. The full ChatPanel `Item()` rewrite is deferred so it can stack cleanly on top of in-flight Flow UI work in `src/components/{FormCard,ConfirmCard}.jsx` and `src/prototypes/StaffbaseCompanion/FlowTimeline.jsx`.**

The chat shell that renders orchestrator and flow events. Decoupled from orchestrator internals — components consume clean adapter shapes, not raw event payloads.

## Contract

```
chatAdapter(eventSource, persistedMessages) → RenderItem[]
```

`RenderItem` is the unit the UI walks. Each item has a `kind` that maps to a component via the presentation registry.

```
RenderItem =
  | { kind: "user-message", text, ts }
  | { kind: "assistant-message", text, ts, suggestions? }
  | { kind: "trace",            route, … }
  | { kind: "tool-call",        toolCallId, name, connector, args, status, result? }
  | { kind: "flow-card",        flow, completedSteps, status, steps[], summary? }
  | { kind: "flow-suggestion-chip", flow }
  | { kind: "form",             flowId, stepId, spec, initialValues }
  | { kind: "confirm-summary",  flowId, stepId, summary }
  | { kind: "presentation",     hint: PresentationHint, source: Source }
  | …
```

## Presentation registry

```
registry: Record<string, Component>
```

Maps `PresentationHint.kind` (from `lib/mcp/` envelopes) to a React component. The seed:

| `kind` | Component | Purpose |
|---|---|---|
| `user`, `user-grid` | UserCard, UserGrid | Staffbase user / list |
| `post`, `post-list` | PostCard, PostList | Staffbase post / list |
| `chart` | AnalyticsChart | Time-series charts |
| `kpi`, `leaderboard` | KpiGrid, Leaderboard | Analytics |
| `timeline` | Timeline | Sequence views |
| `capabilities` | CapabilitiesList | Tool/agent listings |
| `mixed` | MixedCard | Polymorphic |

New kinds: add a component, register it. Unknown kinds fall back to a JSON pretty-print with a "raw" badge.

## Files (after Phase 4)

```
src/ui/
  chat-adapter.js       ← orchestrator/flow events → RenderItem[]
  presentation/
    registry.js         ← kind → Component map
    CardRouter.jsx      ← lookup + render entrypoint (moved from StaffbaseCompanion)
    FlowCard.jsx        ← (moved from StaffbaseCompanion)
    Form.jsx            ← renders FormStep spec
    ConfirmSummary.jsx  ← renders ConfirmStep summary
    cards/              ← UserCard, PostList, KpiGrid, …
  markdown/             ← moved from lib/markdown.jsx
  message-bubble/       ← from src/chat-widget/ (promoted)
```

## How to port

The UI registry is React but the adapter is plain JS — port the adapter as-is to any framework, then write components in your target framework.

1. Copy `src/ui/chat-adapter.js` (framework-agnostic).
2. Implement components in your framework for each `RenderItem.kind` and each `PresentationHint.kind` you support.
3. Wire your event transport (SSE / WebSocket / fetch stream) into the adapter input.

## Coupling notes

- UI components do NOT read orchestrator internals (no `tier1.kind`, no `intent.reasoning`). They consume only adapter shapes.
- The adapter is the seam — change orchestrator event names without touching components.
- `chat-adapter` handles BOTH live event streams AND persisted message rows (rehydrate from DB / localStorage on page load).
