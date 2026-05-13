# Staffbase Prototype Playground

React-based prototyping site for the Navigator product, hosted on **Vercel**. Vite for dev + production builds; Vercel functions under `api/` for the backend (OAuth, MCP servers, orchestrator, Navigator config). Neon Postgres for persistence.

## Project structure

```
index.html                          ← Vite entry point
src/
  App.jsx                           ← Gallery + prototype router (4 cards)
  main.jsx                          ← React mount + global API
  prototypes/
    Navigator/                      ← Studio (admin) — assistants, MCPs, agents,
                                      KBs, flows, Setup tab, "View as" preview
    NavigatorOrchestrator/          ← Employee Chat — orchestrator, intent
                                      trace, flow detection, tool-call cards,
                                      multi-language UI
    NavigatorSetup/                 ← Discovery wizard (folded into Studio's
                                      Setup tab; still routable directly)
    NavigatorAnalytics/             ← Analytics dashboard spec
    StaffbaseCompanion/             ← Real Google login + Atlassian MCP
    AIAssistant/                    ← Shared state seam (configStore +
                                      useConfigStore)
api/
  auth.mjs                          ← Google OAuth — DO NOT change callback paths
  connections.mjs                   ← Atlassian OAuth — DO NOT change callbacks
  companion.mjs                     ← Companion chat + connection info
  orchestrate.mjs                   ← LLM intent classifier + tool routing
  navigator-setup.mjs               ← Discovery wizard backend
  navigator-assistant.mjs           ← Persistent assistants CRUD
  navigator-config.mjs              ← Non-assistant Navigator config (v5)
  mcp/[flavor].mjs                  ← MCP server endpoints
  a2a.mjs                           ← A2A protocol endpoint
lib/
  db.mjs                            ← Neon HTTP client
  blueprints.mjs                    ← workspace_blueprints + navigator_assistants
  workspace-config.mjs              ← navigator_config (revision + state machines)
  staffbase.mjs                     ← Staffbase API client (channels, posts, users)
  mcp-servers/*.mjs                 ← MCP server implementations
  atlassian.mjs, google.mjs         ← OAuth client libs (DO NOT modify lightly)
db/migrations/
  001..005_*.sql                    ← Schema migrations
```

## Development

```bash
npm install                                # first time
npm run dev                                # vite on http://localhost:3456
node db/run-migration.mjs db/migrations/00X.sql   # run a single migration
```

For local API testing you need `vercel dev` (or a deployed environment) — Vite alone does not serve `/api/*`. The frontend gracefully falls back to localStorage when the navigator-config endpoint isn't reachable.

## Architecture: one canonical Staffbase workspace

The four prototypes share **one** Staffbase Intranet workspace, modeled on Campsite (Staffbase's real internal intranet):

- `workspace_blueprints` (migration 004) — discovery snapshot, keyed by Staffbase branch id. Channels, pages, groups, glossary, mainInstructions.
- `navigator_assistants` (migration 004) — persistent assistants, normalized.
- `navigator_config` (migration 005) — MCP connectors, external agents, knowledge bases, flows, tenant overrides. JSONB blob with `revision` for optimistic CAS.

Client-side, `src/prototypes/AIAssistant/useConfigStore.js` hydrates from localStorage (offline-friendly), then background-fetches from `/api/navigator-config?action=load`. Setters write through to localStorage AND `POST /api/navigator-config?action=save` with revision-based conflict detection.

### State machines

- `assistant.status` / `flow.status` : `draft | active | archived`
- `mcpConnector.status` / `externalAgent.status` : `disconnected | connected | degraded`

Server validates on save (`lib/workspace-config.mjs`).

## Hard constraints — DO NOT break

- `/api/auth/google/callback` and `/api/connections/atlassian/callback` — registered redirect URIs.
- `/prototypes/staffbase-companion` route — OAuth bounce destination.
- `APP_URL`, `GOOGLE_*`, `ATLASSIAN_*`, `TOKEN_ENC_KEY`, `SESSION_JWT_SECRET` env vars.
- `users` and `connections` tables.
- `vercel.json` ordering for `/api/auth`, `/api/connections`, `/api/companion`, `/api/mcp-*` rewrites.

## How to add a new prototype

1. Create the component under `src/prototypes/MyNewProto/`.
2. Register in the `PROTOTYPES` array in `src/App.jsx`.
3. If it needs Navigator's shared config (assistants, connectors, etc.), import `useConfigStore` from `src/prototypes/AIAssistant/useConfigStore.js`. The hook handles localStorage + server sync.

## Deployment

- **Build**: `npm run build` → `dist/`.
- **Host**: Vercel (configured in `vercel.json`). Function timeouts and rewrites live there.

## Staffbase Context

- **Brand color (teal)**: `#00C7B2`
- **Background**: `#F5F5F7`
- **Surface**: `#FFFFFF`
- **Workspace name**: Staffbase
- **Intranet**: Campsite (`campsite.staffbase.com`)
