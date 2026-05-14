# Navigator walkthrough (30 minutes)

A guided tour for the team. Reads top-down. Each section ends with a "look at" pointer so anyone with the repo open can follow along.

## What we're walking through

Navigator is five self-sufficient modules with typed contracts:

- **discovery** — workspace introspection
- **orchestrator** — turn routing
- **flows** — deterministic multi-step automations
- **mcp** — tool envelope + middleware
- **ui** — presentation registry + chat adapter

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the one-page picture.

---

## 1. A single user turn, end-to-end (10 min)

Trace what happens when an employee types "what's my PTO balance?" in the chat.

### 1.1 The chat shell

The UI POSTs to `/api/companion/chat` with the message history. The endpoint streams NDJSON events back.

→ Look at [`api/companion.mjs`](../api/companion.mjs) — thin HTTP shim around `runOrchestratedTurn`.

### 1.2 Orchestrator: classifier

`runOrchestratedTurn` (in [`lib/orchestrator/index.mjs`](../lib/orchestrator/index.mjs)) does two-tier intent classification. The Tier-1 router decides whether the question goes to a flow, an assistant, or a free-form turn. The classifier prompt is [`lib/orchestrator/prompts/classifier.txt`](../lib/orchestrator/prompts/classifier.txt) — open it, this is the actual brain.

→ Look at [`classifier.txt`](../lib/orchestrator/prompts/classifier.txt) + the call site in [`lib/orchestrator/index.mjs`](../lib/orchestrator/index.mjs) (search `classifyIntent`).

### 1.3 Flow detection (deterministic)

Before the classifier, [`matchesFlowTrigger`](../lib/flows/runtime.mjs) checks every configured flow's `trigger` phrase against the user message. Strong overlap → flow takes the turn. Pure phrase matching, no LLM.

→ Look at [`lib/flows/runtime.mjs:matchesFlowTrigger`](../lib/flows/runtime.mjs).

### 1.4 Tool dispatch

If no flow matched, the agentic loop loads tools from every enabled connector (workspace_config.connectors). The system prompt is composed from layered sections — see [`system-prompt.mjs`](../lib/orchestrator/system-prompt.mjs). The LLM calls a tool; the dispatch hits an MCP server.

→ Look at the agentic loop in [`lib/orchestrator/index.mjs`](../lib/orchestrator/index.mjs) (search `runStudioDrivenTurn`).

### 1.5 The MCP envelope

Every tool returns `{ summary, data, presentation?, sources? }`. The LLM reads `summary` + `data`. The UI reads `presentation`. Staffbase enrichment is a middleware that adds profile URLs to entities in `data` — see [`lib/mcp/middlewares/staffbase-enrichment.mjs`](../lib/mcp/middlewares/staffbase-enrichment.mjs).

→ Look at [`lib/mcp/types.mjs`](../lib/mcp/types.mjs) for the envelope; [`lib/mcp/middleware.mjs`](../lib/mcp/middleware.mjs) for the chain runner.

### 1.6 UI rendering

The orchestrator streams events; the chat adapter ([`src/ui/chat-adapter.js`](../src/ui/chat-adapter.js)) translates them to typed `RenderItem`s; the presentation registry ([`src/ui/presentation/registry.js`](../src/ui/presentation/registry.js)) maps `kind` → component.

→ Look at `KINDS` in [`chat-adapter.js`](../src/ui/chat-adapter.js) — these are the 14 things the UI can render.

---

## 2. Discovery (5 min)

How Navigator bootstraps itself for a new workspace.

### 2.1 Source signals

The Staffbase adapter ([`lib/discovery/adapters/staffbase.mjs`](../lib/discovery/adapters/staffbase.mjs)) pulls channels, posts, pages, groups, users in parallel. Behind a [`SourceAdapter`](../lib/discovery/source-adapter.mjs) interface so other sources (Confluence, HRIS) can plug in.

### 2.2 Two LLM passes

- **Pass A** — workspace overview + glossary + mainInstructions. Prompt: [`passA-workspace.txt`](../lib/discovery/prompts/passA-workspace.txt).
- **Pass B** — proposes 5–9 Assistants + topic clusters. Prompt: [`passB-assistants.txt`](../lib/discovery/prompts/passB-assistants.txt).

→ Open both prompts. They define the entire output shape.

### 2.3 Blueprint applier

The output of discovery is a **WorkspaceBlueprint** (see [`lib/discovery/types.mjs`](../lib/discovery/types.mjs)). The [`blueprint-applier`](../lib/blueprint-applier.mjs) is the pure function that maps blueprint → `{ assistants, connectors, flows, configPatch }`. This is the boundary you implement against if porting Navigator to a different runtime.

→ Look at [`apply()`](../lib/blueprint-applier.mjs).

---

## 3. Flows (5 min)

Multi-step automations: collect input → call tools → confirm → done.

### 3.1 Data model

[`Flow`](../lib/flows/types.mjs) has ordered `steps[]` of three types: `FormStep`, `ToolStep`, `ConfirmStep`. Steps reference prior step outputs via `{{stepId.fieldId}}` tokens.

→ Look at [`lib/flows/types.mjs`](../lib/flows/types.mjs) + the [`Request PTO` template](../lib/flows/templates.mjs).

### 3.2 Runtime is a state machine

No LLM. [`runFlowStepMachine`](../lib/orchestrator/index.mjs) walks steps sequentially, pausing on form/confirm. Pause state persists via the `onSystemMessage` callback so reloads work.

→ Look at the [event reference](../lib/flows/EVENTS.md) — there are 7 events, all documented with payloads.

### 3.3 Authoring

Studio's Flows tab lets admins build flows. There's an LLM scaffold path (`POST /api/navigator-assistant?action=scaffold-flow`) for "describe the flow you want."

---

## 4. The ports (5 min)

Three interfaces are the seams between modules. Each module's README has the contract.

| Port | Purpose | Defined at |
|---|---|---|
| `SourceAdapter` | Discovery reads any source | [`lib/discovery/source-adapter.mjs`](../lib/discovery/source-adapter.mjs) |
| `ToolProvider` | Orchestrator gets dynamic tool list | [`lib/orchestrator/tool-provider.mjs`](../lib/orchestrator/tool-provider.mjs) |
| `FlowProvider` | Orchestrator delegates to flows | [`lib/orchestrator/flow-provider.mjs`](../lib/orchestrator/flow-provider.mjs) |

To port Navigator to another product: implement these three interfaces and you're done. Everything else is portable as-is.

---

## 5. What's where (cheat sheet)

```
ARCHITECTURE.md             ← one-page diagram + module map
docs/prompts/README.md      ← index of every LLM prompt
docs/WALKTHROUGH.md         ← this file

lib/discovery/              ← bootstrap a workspace → WorkspaceBlueprint
lib/orchestrator/           ← route a user turn → event stream
lib/flows/                  ← multi-step automations (no LLM at runtime)
lib/mcp/                    ← tool envelope + middleware chain
lib/blueprint-applier.mjs   ← blueprint → runtime config

lib/mcp-servers/*.mjs       ← MCP implementations (envelope migration in progress)
lib/staffbase.mjs           ← Staffbase REST client (wrapped by discovery adapter)
lib/workspace-config.mjs    ← navigator_config persistence

api/companion.mjs           ← /api/companion/* HTTP routes
api/navigator-setup.mjs     ← /api/navigator-setup/* (discovery HTTP)

src/ui/                     ← presentation registry + chat-adapter
src/prototypes/*            ← four prototype showcases (Studio, Companion, Setup, AI Assistant)
```

---

## 6. Deferred follow-ups

Tracked in each module's README under "Status":

- Rewire `lib/orchestrator/index.mjs` to consume the `FlowProvider` port instead of importing runtime helpers directly.
- Extract `scaffold-flow` LLM logic out of [`api/navigator-assistant.mjs`](../api/navigator-assistant.mjs) into `lib/flows/scaffold.mjs`.
- Extract flow CRUD out of [`lib/workspace-config.mjs`](../lib/workspace-config.mjs) into `lib/flows/config.mjs`.
- Migrate the 6 non-Staffbase MCP servers to the canonical envelope (Staffbase has its own legacy shape today; `lib/mcp/envelope.mjs::wrapResult` adapts either).
- Migrate ChatPanel's `Item()` switch to use the chat-adapter + registry.

Each follow-up is independent and additive. None block the others.
