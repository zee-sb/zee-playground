// WorkspaceBlueprint — the canonical output of discovery.
//
// This is what gets persisted to workspace_blueprints (lib/blueprints.mjs) and
// what the blueprint-applier reads to derive the runtime config (assistants,
// connectors, flows).
//
// Today the shape lives implicitly in api/navigator-setup.mjs::handleDiscover
// and Pass A/B prompt outputs. The typedef below captures it explicitly so
// schema changes can be tracked.

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} term
 * @property {string} definition
 */

/**
 * @typedef {Object} Workspace        Pass A output
 * @property {string} companyName
 * @property {string} companyMission
 * @property {string} overview
 * @property {string[]} tone
 * @property {string} mainInstructions  Workspace-level orchestrator system prompt
 * @property {GlossaryEntry[]} glossary
 * @property {string[]} workspaceFacts
 * @property {string[]} questionTypes
 */

/**
 * @typedef {Object} TopicCluster     Pass B output
 * @property {string} name
 * @property {string} description
 * @property {string} lucideIcon
 * @property {string[]} channelIds
 * @property {string[]} samplePostTitles
 */

/**
 * @typedef {Object} SuggestedAssistant   Pass B output
 * @property {string} clusterName
 * @property {string} name
 * @property {string} description
 * @property {string} lucideIcon
 * @property {string} systemPromptSnippet
 * @property {Array<{ channelId: string, channelTitle: string, url?: string }>} knowledgeSources
 * @property {boolean} alwaysInclude
 * @property {string[]} signalsUsed
 */

/**
 * @typedef {Object} WorkspaceBlueprint
 * @property {number} [schemaVersion]
 * @property {{ name: string, kind: string, key: string | null }} [source]
 *   Adapter-provided source descriptor + persistence key.
 * @property {Array<object>} channels
 * @property {Array<object>} topPosts
 * @property {Array<object>} recentPosts
 * @property {Array<{ id: string, title: string, contentLength: number }>} deepPosts
 * @property {Array<object>} pages
 * @property {Array<object>} groups
 * @property {object} orgSignals
 * @property {string[]} languages
 * @property {Workspace} workspace
 * @property {TopicCluster[]} topicClusters
 * @property {SuggestedAssistant[]} proposedAssistants
 * @property {{ id: string, name: string, slug?: string } | null} branch  Staffbase branch ref (legacy field; new adapters use `source.key`)
 * @property {{
 *   openAiUsed: boolean,
 *   fallbackReason: string | null,
 *   postsAnalyzed: number,
 *   usersAnalyzed: number,
 *   usersTotal: number | null,
 *   pagesAnalyzed: number,
 *   pagesEmbedded: number,
 *   groupsAnalyzed: number,
 *   deepPostsFetched: number,
 *   persisted: boolean,
 *   discoveredAt?: string,
 * }} meta
 */

export const BLUEPRINT_SCHEMA_VERSION = 1;
