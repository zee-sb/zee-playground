// ToolProvider — the port between the orchestrator and the list of enabled
// connectors / tools available to a given turn.
//
// The orchestrator depends on this interface, not on any concrete connector
// registry. Production wires WorkspaceConfigToolProvider (reads
// navigator_config.connectors). Tests / Studio-empty fallback wire a
// StaticToolProvider against the seed list in lib/connector-registry.mjs.
//
// Currently this file documents the contract. Wire-in happens in Phase 2,
// after flows are extracted (they share the connector scope with the agentic
// loop and the migration is easier to do together).

/**
 * @typedef {Object} ToolDescriptor
 * @property {string} id            namespaced "{connectorId}__{toolName}"
 * @property {string} name          original tool name
 * @property {string} connectorId
 * @property {string} connectorName
 * @property {string} description
 * @property {object} inputSchema   JSON schema
 */

/**
 * @typedef {Object} ConnectorHandle
 * @property {string} id
 * @property {string} name
 * @property {string} kind          "mcp" | "agent" | "kb"
 * @property {string} endpoint
 * @property {object} [meta]
 */

/**
 * @typedef {Object} ToolProvider
 * @property {() => Promise<ConnectorHandle[]>} listConnectors
 *   All enabled connectors visible to this turn.
 * @property {(connectorIds: string[]) => Promise<ToolDescriptor[]>} listTools
 *   Tools, namespaced, for the agentic loop's tools=[] payload.
 * @property {(toolId: string, args: object, ctx: object) => Promise<unknown>} callTool
 *   Dispatch a namespaced tool call to its connector and return the result.
 *   Results SHOULD conform to the lib/mcp/ ToolResult envelope after Phase 3.
 */

// Concrete implementations land alongside the Phase 2 flow extraction:
//   - WorkspaceConfigToolProvider — reads navigator_config.connectors
//   - StaticToolProvider          — reads lib/connector-registry.mjs::CONNECTORS

export const TOOL_PROVIDER_CONTRACT_VERSION = 1;
