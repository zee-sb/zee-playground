// Middleware chain runner for MCP tool results.
//
// Each middleware is a pure function (ToolResult, ctx) => ToolResult. They
// compose in order. The chain runs server-side immediately after the tool
// returns, before the result hits the orchestrator's event stream.
//
// Conventional middlewares:
//   - lib/mcp/middlewares/staffbase-enrichment.mjs — link entities to live
//     Staffbase profiles/URLs. Wired only on the Staffbase server.
//
// Servers wire their middleware chain at boot, e.g.:
//
//   import { runMiddlewares } from '../mcp/middleware.mjs';
//   import { staffbaseEnrichment } from '../mcp/middlewares/staffbase-enrichment.mjs';
//
//   const chain = [staffbaseEnrichment];
//   …
//   const result = await runMiddlewares(rawToolOutput, chain, ctx);

import { wrapResult } from './envelope.mjs';

/**
 * @param {object} rawResult         Whatever the tool returned (envelope or legacy)
 * @param {import('./types.mjs').Middleware[]} chain
 * @param {import('./types.mjs').MiddlewareContext} ctx
 * @returns {Promise<import('./types.mjs').ToolResult>}
 */
export async function runMiddlewares(rawResult, chain, ctx) {
  let acc = wrapResult(rawResult);
  for (const mw of chain) {
    acc = await mw(acc, ctx);
  }
  return acc;
}
