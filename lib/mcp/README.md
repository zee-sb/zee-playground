# `lib/mcp/` — tools and connectors

**Status: Phase 3 in progress. The canonical envelope is defined in [types.mjs](types.mjs); migration helpers in [envelope.mjs](envelope.mjs); the middleware chain runner in [middleware.mjs](middleware.mjs); and the Staffbase enrichment middleware skeleton at [middlewares/staffbase-enrichment.mjs](middlewares/staffbase-enrichment.mjs). The existing 7 MCP server implementations under `lib/mcp-servers/` continue to use their legacy shapes for now (the Staffbase server has `{summary, chart?, cards?, raw}`; others return plain JSON). Migration is incremental — `wrapResult()` adapts either shape, so tools can be migrated file-by-file without a flag day.**

Every external capability — MCP servers, agents, knowledge bases — exposes tools that return a uniform `ToolResult` envelope. The Staffbase MCP is just-another-MCP plus one middleware (`staffbaseEnrichment`); no special-casing elsewhere.

## Contract

```
type ToolResult = {
  summary: string,                  // 1-2 sentence natural-language summary (what the LLM reads)
  data: unknown,                    // canonical result data
  presentation?: PresentationHint[], // UI rendering hints (consumed by src/ui/ registry)
  sources?: Source[]                // citation entries
}

type PresentationHint = {
  kind: string,                     // e.g. "post-list", "user-grid", "chart", "kpi"
  ...                               // kind-specific props
}

type Source = { id, label, url?, kind, … }
```

`data` is canonical. `presentation` is purely additive — derived from `data`, never replaces it. The LLM only reads `summary` and `data`; the UI only reads `presentation` (or falls back to rendering `data` if no hint).

## Middleware

```
runTool(tool, args, ctx) → ToolResult
  → toolImpl(args)
  → middleware1(result, ctx)
  → middleware2(result, ctx)
  → …
```

Middlewares are pure: `(ToolResult, ctx) → ToolResult`. Wired per-server.

### `staffbaseEnrichment`

Lives at `lib/mcp/middlewares/staffbase-enrichment.mjs`. Runs only on the Staffbase server. Walks `result.data` for entities (users, posts, channels) and:
- Adds Staffbase profile URLs and live attributes (title, avatar, department).
- Resolves channel ids → readable names.
- Augments `result.sources` with Staffbase-shaped entries.

Other MCPs may add their own middlewares (e.g., HR enrichment for employee records) — same contract.

## Servers

| Server | File | Tools (examples) |
|---|---|---|
| Staffbase intranet | `lib/mcp-servers/staffbase.mjs` | `list_recent_posts`, `search_posts`, `get_post`, analytics |
| HR portal | `lib/mcp-servers/hr.mjs` | `list_employees`, `search_policies`, `list_holidays` |
| IT helpdesk | `lib/mcp-servers/it.mjs` | tickets, knowledge base |
| Intranet | `lib/mcp-servers/intranet.mjs` | pages, search |
| Atlassian | `lib/mcp-servers/atlassian.mjs` | Jira, Confluence |
| KB | `lib/mcp-servers/kb.mjs` | docs search |

Registry: `lib/mcp-registry.mjs` exports `SEED_CONNECTORS` (seed + fallback). The runtime list of *enabled* connectors lives in `navigator_config.connectors`.

## Endpoint

`api/mcp/[flavor].mjs` dispatches to the corresponding server module.

## How to port

1. Copy `lib/mcp/types.mjs` (the envelope type).
2. Wrap each existing tool in your product to return the envelope. Most tools: `return { summary, data }`. UI hints are optional.
3. If your product has Staffbase plumbing, port `staffbase-enrichment.mjs` and wire it into your Staffbase server.

## Coupling notes

- A tool's `data` shape is its own — no global types.
- A tool's `presentation` kinds must be registered in `src/ui/presentation/registry.js`. Unknown kinds fall back to a generic JSON pretty-print.
- MCPs are stateless. Auth flows through bearer tokens or per-request context.
