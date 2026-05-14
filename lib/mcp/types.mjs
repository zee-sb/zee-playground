// MCP tool result types.
//
// Every MCP tool (every server in lib/mcp-servers/) returns a uniform
// envelope. The LLM reads `summary` + `data`. The UI reads `presentation`
// and `sources`. Middlewares post-process the envelope without touching
// the tool's core logic.
//
// Today only the Staffbase server uses an envelope (`{summary, chart?,
// cards?, raw}`). The migration target is one envelope shape across all
// servers; the legacy {chart, cards} fields collapse into `presentation`.

/**
 * @typedef {Object} PresentationHint
 * @property {string} kind                Registered in src/ui/presentation/registry.js
 *                                         e.g. "post-list", "user-grid", "kpi",
 *                                         "leaderboard", "chart", "timeline"
 * @property {object} [props]             kind-specific render props
 */

/**
 * @typedef {Object} Source
 * @property {string}  id
 * @property {string}  label
 * @property {string}  [url]
 * @property {string}  kind                "post" | "page" | "user" | "doc" | "ticket" | …
 * @property {object}  [meta]
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} summary             1-2 sentence natural-language framing.
 *                                         The LLM uses this to narrate the result.
 * @property {unknown} data                Canonical structured data. Stable shape
 *                                         per tool. The LLM reasons over this.
 * @property {PresentationHint[]} [presentation]  Optional UI render hints.
 * @property {Source[]} [sources]         Optional citation entries.
 * @property {object} [meta]              Tool-specific metadata: timings, paging, etc.
 */

/**
 * @typedef {Object} MiddlewareContext
 * @property {string} connectorId
 * @property {string} toolName
 * @property {object} [user]              Signed-in user, if known.
 * @property {object} [args]              The args the tool was called with.
 */

/**
 * @typedef {(result: ToolResult, ctx: MiddlewareContext) => Promise<ToolResult> | ToolResult} Middleware
 */

export const TOOL_RESULT_SCHEMA_VERSION = 1;
