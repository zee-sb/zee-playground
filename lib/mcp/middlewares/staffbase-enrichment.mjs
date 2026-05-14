// Staffbase enrichment middleware.
//
// Runs only on the Staffbase MCP. Walks the tool result's `data` for entity
// references (users, posts, channels) and adds Staffbase profile URLs +
// live attributes (title, avatar, department) so the UI can deep-link
// the user back into their intranet.
//
// This is the ONLY place in the codebase that special-cases Staffbase. The
// orchestrator treats Staffbase as just-another-MCP; the rich integration
// is an envelope-level decoration.
//
// Current state: this is a stub that documents the contract. The enrichment
// logic still lives inline in lib/mcp-servers/staffbase.mjs and api/a2a.mjs.
// Migration plan (incremental, no behavior change required for first pass):
//
//   1. Move the user-profile enrichment from api/a2a.mjs lines 24-54 into
//      enrichUser() below.
//   2. Move the channel/post URL stitching that lib/mcp-servers/staffbase.mjs
//      does in its tool implementations into enrichEntity() below.
//   3. Wire `staffbaseEnrichment` into the Staffbase server's runMiddlewares
//      chain. Servers that don't need it skip the middleware.
//
// Once migrated, removing or A/B-testing the enrichment is a one-line change
// to the chain config — the tool code stays the same.

/** @type {import('../types.mjs').Middleware} */
export async function staffbaseEnrichment(result, ctx) {
  // No-op for now — preserves the current behavior while the contract is in
  // place. Phase 3 follow-up migrates the inline enrichment from
  // lib/mcp-servers/staffbase.mjs and api/a2a.mjs into this middleware.
  return result;
}

/**
 * Enrich a single Staffbase user reference in-place.
 * Currently a stub — will hydrate from the live Staffbase Directory once the
 * enrichment migration is complete.
 *
 * @param {object} userRef           At minimum { id }, optionally name/email
 * @param {object} [opts]
 * @returns {Promise<object>}        Enriched user with title, department, avatar, profileUrl
 */
export async function enrichUser(userRef /*, opts */) {
  return userRef;
}

/**
 * Add a Staffbase URL to an entity reference (post, channel, page).
 * Stub — will compute the canonical URL from the entity kind and id.
 *
 * @param {object} entity
 * @returns {object}
 */
export function enrichEntity(entity) {
  return entity;
}
