// FlowProvider — the port between the orchestrator and the flows module.
//
// The orchestrator currently imports flow-runtime helpers directly. After the
// final rewire (deferred to a follow-up because it touches the 2351-line
// orchestrator and risks breaking the running app), it will only depend on
// this interface. Production wires WorkspaceConfigFlowProvider (reads
// navigator_config.flows). Tests / fixtures wire StaticFlowProvider.
//
// This file documents the contract.

/**
 * @typedef {Object} FlowProvider
 * @property {(userText: string, ctx: object) => Promise<import('../flows/types.mjs').Flow | null>} match
 *   Inspect the user's text (and optional ctx like recent history) and return
 *   the flow that should take the turn, or null to let the agentic loop run.
 * @property {(flow: import('../flows/types.mjs').Flow, ctx: object) => AsyncIterable<object>} start
 *   Begin or resume a flow. Yields the events documented in
 *   lib/flows/EVENTS.md. The orchestrator pipes them straight through.
 * @property {(submission: object, ctx: object) => Promise<void>} resume
 *   Apply a form or confirm submission to a paused run. Called by
 *   /api/companion/confirm and similar resume endpoints.
 */

export const FLOW_PROVIDER_CONTRACT_VERSION = 1;
