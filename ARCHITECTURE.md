# Navigator architecture

Navigator is composed of five self-sufficient modules. Each has a typed input/output contract and can be lifted into the main Staffbase product independently.

```
┌─────────────┐    blueprint    ┌──────────────────┐
│  discovery  │ ──────────────▶ │ blueprint-applier│ ──▶ runtime config
│ (lib/disc…) │                 │                  │     (assistants,
└─────────────┘                 └──────────────────┘     connectors, flows)
       ▲
       │ gathers signals
       │
┌─────────────┐
│ Source-     │
│ Adapter     │  (Staffbase impl; others later)
└─────────────┘

                           user turn
                              │
                              ▼
                    ┌──────────────────┐
                    │   orchestrator   │ ◀── ToolProvider (workspace_config)
                    │                  │ ◀── FlowProvider (workspace_config)
                    └─────────┬────────┘
                              │
                  flow match? │ no flow
                ┌─────────────┴────────────┐
                ▼                          ▼
       ┌────────────────┐        ┌──────────────────┐
       │     flows      │        │  agentic loop    │
       │ (step machine) │        │  (LLM + tools)   │
       └───────┬────────┘        └────────┬─────────┘
               │                          │
               └────────┬─────────────────┘
                        ▼
                ┌───────────────┐
                │      mcp      │   ─────▶  ToolResult envelope:
                │ (servers +    │            { summary, data,
                │  middleware)  │              presentation, sources }
                └──────┬────────┘
                       │
                       ▼ (events)
               ┌──────────────┐
               │      ui      │   chat-adapter → presentation registry
               │              │   (kind → React component)
               └──────────────┘
```

## Modules

| Module | Purpose | Contract | Doc |
|---|---|---|---|
| `lib/discovery/` | Turn a workspace (Staffbase or future sources) into a typed `WorkspaceBlueprint` | `SourceAdapter` in → `WorkspaceBlueprint` out | [README](lib/discovery/README.md) |
| `lib/orchestrator/` | Route a user turn to a flow or agentic loop; manage tool calls | `{messages, toolProvider, flowProvider, …}` in → NDJSON event stream out | [README](lib/orchestrator/README.md) |
| `lib/flows/` | Deterministic multi-step automations (form / tool / confirm) | `{flow, run, scope, …}` in → flow event stream out | [README](lib/flows/README.md) |
| `lib/mcp/` | MCP servers + middleware. Every tool returns a `ToolResult` envelope. Staffbase enrichment is one middleware | MCP request in → `{summary, data, presentation?, sources?}` out | [README](lib/mcp/README.md) |
| `src/ui/` | Presentation registry + chat adapter. Maps `PresentationHint.kind` → React component | event stream in → React render tree out | [README](src/ui/README.md) |

## Event flow for a single user turn

1. UI emits user message → `POST /api/companion/chat`.
2. `runOrchestratedTurn` in `lib/orchestrator/` asks `FlowProvider.match(text)`.
3a. **Flow match**: emit `flow_delegated`; stream events from `lib/flows/runtime.mjs` (form_request → user fills form → tool_start → tool_result via mcp/ → confirm_request → flow_completed).
3b. **No flow**: classifier picks domains; `ToolProvider` loads tools; agentic loop streams `delta` chunks; tool calls dispatch through `lib/mcp/`.
4. Every MCP tool result passes through middleware chain. Staffbase server runs `staffbaseEnrichment` to link entities to live profiles/URLs.
5. UI's `chat-adapter` translates raw events into render items. Registry maps each item's `kind` to a component.

## Where prompts live

All LLM prompts are versioned files (not inline strings). Index: [docs/prompts/README.md](docs/prompts/README.md).

- [`lib/orchestrator/prompts/classifier.txt`](lib/orchestrator/prompts/classifier.txt) — intent classifier
- [`lib/orchestrator/system-prompt.mjs`](lib/orchestrator/system-prompt.mjs) — agentic-loop system prompt (composed from named section functions, not a single file)
- [`lib/discovery/prompts/passA-workspace.txt`](lib/discovery/prompts/passA-workspace.txt) — workspace overview pass
- [`lib/discovery/prompts/passB-assistants.txt`](lib/discovery/prompts/passB-assistants.txt) — assistant proposals pass
- [`lib/discovery/prompts/optimize-main.txt`](lib/discovery/prompts/optimize-main.txt) — mainInstructions polish pass

## Team walkthrough

[docs/WALKTHROUGH.md](docs/WALKTHROUGH.md) is the 30-minute guided tour. Open it next to the codebase and follow the section pointers.

## What this architecture deliberately keeps simple

- One database (Neon Postgres). Tables: `users`, `connections`, `workspace_blueprints`, `navigator_assistants`, `navigator_config`. Unchanged.
- One LLM provider (OpenAI). Models named where used.
- No new runtime infrastructure. Vercel functions + Vite frontend.
- Five prototypes (App.jsx gallery) all consume the same modules.

## Porting to the main Staffbase product

Each module's README ends with a **"How to port"** section: which files to copy, which environment variables to wire, which database tables to provision, which interfaces (`SourceAdapter`, `ToolProvider`, `FlowProvider`) to implement against the target product's plumbing.
