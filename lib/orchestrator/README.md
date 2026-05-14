# `lib/orchestrator/` — turn orchestration

**Status: Phase 1 in progress. The monolith has been moved to `lib/orchestrator/index.mjs`. Classifier prompt is now versioned (`prompts/classifier.txt`). `ToolProvider` port is defined but not yet wired — that happens in Phase 2 alongside the flow extraction.**

Routes a single user turn to either a [flow](../flows/README.md) (deterministic automation) or an agentic LLM loop with tool calls.

## Contract

```
runOrchestratedTurn({
  messages,            // chat history
  userContext,         // { userId, email, lang, tz, … }
  toolProvider,        // ToolProvider — supplies enabled MCPs / agents / KBs
  flowProvider,        // FlowProvider — supplies enabled flows
  workspaceInstructions, // optional: main instructions from discovery
  emit                 // event sink
}) → Promise<void>
```

Emits NDJSON events (typed):
- `intent` — classifier result `{ domains, reasoning, inScope }`
- `tool_call`, `tool_result` — MCP invocations (one per tool)
- `delta`, `done` — streamed assistant message
- `refusal` — out-of-scope short-circuit
- `flow_delegated` — turn handed to `lib/flows/` (followed by flow events)
- `a2a_update`, `a2a_done` — A2A protocol delegation

## Ports

The orchestrator does NOT statically import MCP servers, flow runtime, or workspace config. It depends on ports:

### `ToolProvider`
```
interface ToolProvider {
  list()                       → ToolDescriptor[]      // for classifier
  tools(domain)                → ToolHandle[]          // for agentic loop
  call(handle, args)           → Promise<ToolResult>   // mcp/ envelope
}
```
Implementations: `WorkspaceConfigToolProvider` (prod, reads `navigator_config.connectors`), `StaticToolProvider` (tests / Navigator preview fallback).

### `FlowProvider`
```
interface FlowProvider {
  match(userText, ctx)         → Flow | null
  start(flow, ctx)             → AsyncIterable<FlowEvent>
}
```
Production wires `WorkspaceConfigFlowProvider` (reads `navigator_config.flows` + invokes `lib/flows/runtime.mjs`).

## Prompts

- `lib/orchestrator/prompts/classifier.txt` — intent classifier
- `lib/orchestrator/prompts/system.txt` — agentic-loop system message
- `lib/orchestrator/prompts/suggestions.txt` — `<suggestions>` token rules

## Turn flow

1. Resolve userContext (pronoun anchor: last 6 turns).
2. Ask `flowProvider.match(text)`. If match → emit `flow_delegated`, stream through `flowProvider.start()`, return.
3. Otherwise run classifier → resolves domains and `inScope`.
4. If out of scope → emit `refusal` + `done`.
5. Else `toolProvider.tools(...)` → namespaced tool list.
6. Agentic loop (6 rounds max): LLM call → tool calls → tool results → next round → stream `delta` chunks.
7. Extract `<suggestions>[…]</suggestions>` token from final message; emit `done` with suggestions.

## How to port

In the main Staffbase product:
1. Implement `ToolProvider` and `FlowProvider` against your tool registry / flow registry.
2. Call `runOrchestratedTurn` with your providers. The function is platform-agnostic.
3. Wire the event sink to your transport (SSE, WebSocket, fetch streaming).

## Coupling notes

- Orchestrator imports `lib/mcp/` only via `ToolResult` types — not concrete servers.
- Orchestrator imports `lib/flows/` only via `FlowProvider` port — not runtime internals.
- Orchestrator does NOT know about UI rendering. All UI hints live in `ToolResult.presentation`.
