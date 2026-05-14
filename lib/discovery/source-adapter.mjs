// SourceAdapter — the interface discovery uses to read a workspace.
//
// Discovery is source-agnostic: pass in a SourceAdapter and it produces a
// WorkspaceBlueprint. Today the only implementation is the Staffbase adapter
// at lib/discovery/adapters/staffbase.mjs (wrapping lib/staffbase.mjs). To
// run discovery against Confluence, HRIS, or another source, implement this
// interface — no other code changes needed.

/**
 * @typedef {Object} SourceChannel    News surface / content channel
 * @property {string}  id
 * @property {string}  title
 * @property {string}  [description]
 * @property {number}  [postCount]
 * @property {string[]} [locales]
 */

/**
 * @typedef {Object} SourcePost
 * @property {string} id
 * @property {string} title
 * @property {string} [teaser]
 * @property {string} [content]
 * @property {number} [likes]
 * @property {number} [comments]
 * @property {{ id: string, title: string }} [channel]
 */

/**
 * @typedef {Object} SourcePage     Reference doc / policy / hub page
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} [bodyExcerpt]
 * @property {number} [bodyLength]
 * @property {string} [published]
 * @property {string[]} [locales]
 */

/**
 * @typedef {Object} SourceGroup    Org segmentation / ERG / program group
 * @property {string} name
 * @property {string} [description]
 * @property {boolean} [isDepartmentGroup]
 */

/**
 * @typedef {Object} SourceUser
 * @property {string} id
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [department]
 * @property {string} [location]
 * @property {string} [title]
 */

/**
 * @typedef {Object} SourceSignals
 * @property {SourceChannel[]} channels
 * @property {SourcePost[]}    posts
 * @property {SourcePost[]}    deepPosts    Full-body sample for tone inference.
 * @property {SourcePage[]}    pages
 * @property {SourceGroup[]}   groups
 * @property {SourceUser[]}    users
 * @property {number}          [usersTotal]
 * @property {string[]}        languages
 */

/**
 * @typedef {Object} SourceAdapter
 * @property {() => Promise<SourceSignals>} gather
 *   Pull everything discovery needs in one call. Adapter implementations
 *   parallelize the underlying API requests.
 * @property {() => Promise<string | null>} workspaceKey
 *   Stable persistence key for the discovered workspace. For Staffbase this
 *   is the branch id; for another source it might be a tenant id. Used as
 *   the primary key in `workspace_blueprints`.
 * @property {() => { name: string, kind: string }} describe
 *   Short label for logs and prompts (e.g. "Staffbase intranet").
 */

export const SOURCE_ADAPTER_CONTRACT_VERSION = 1;
