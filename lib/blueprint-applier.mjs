// Blueprint applier — pure function that maps a WorkspaceBlueprint to a
// proposed runtime delta: assistants to add, connectors to add, config
// fields to patch.
//
// This is the boundary between discovery and runtime config. Discovery
// produces a blueprint; the applier turns it into the assistants /
// connectors / config patch that get written into `navigator_assistants`
// and `navigator_config`. Discovery does NOT depend on the runtime config
// schema — the applier does. To port discovery to another product, swap
// out this applier.
//
// Today the equivalent logic lives inline in
// src/prototypes/NavigatorSetup/NavigatorSetupStudio.jsx::applyConfiguration.
// The wizard can adopt this function whenever the component is touched next;
// the contract is here in the meantime so the team can review and port it.

/** @typedef {import('./discovery/types.mjs').WorkspaceBlueprint} WorkspaceBlueprint */
/** @typedef {import('./discovery/types.mjs').SuggestedAssistant} SuggestedAssistant */

/**
 * @typedef {Object} ApplyOptions
 * @property {Set<number> | number[] | "all"} [includeAssistantIndices]
 *   Which suggestedAssistants to include. Default: "all".
 * @property {boolean} [includeWorkspaceConfig]
 *   Whether to emit a tenant configPatch from blueprint.workspace. Default: true.
 * @property {string}  [editedMainInstructions]
 *   Override for workspace.mainInstructions (admin may have edited it).
 * @property {(s: string) => string} [slugify]
 *   How to slugify names into ids. Default: lowercase + dash.
 * @property {(icon: string) => string} [emojiForIcon]
 *   How to map a Lucide icon name to an emoji for the assistant tile.
 * @property {number} [now]    Defaults to Date.now() — injected for deterministic tests.
 */

/**
 * @typedef {Object} ApplyResult
 * @property {object[]} assistants
 * @property {object[]} connectors
 * @property {{ tenant: object }} configPatch
 * @property {object} meta
 *   Counts + a "what would be touched" summary for confirmation UI.
 */

const DEFAULT_SLUGIFY = (s) =>
  String(s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const DEFAULT_EMOJI = () => '✨'; // Wizard supplies the real mapping.

/**
 * Pure, deterministic. Calling apply() with the same inputs returns the same
 * output (modulo `now`). Idempotent at the data level: applying twice to an
 * empty workspace produces two identical proposed-deltas, but the consumer
 * writing them deduplicates by id (assistants and connectors have stable
 * derived ids based on `slugify(name)`).
 *
 * @param {WorkspaceBlueprint} blueprint
 * @param {ApplyOptions} [options]
 * @returns {ApplyResult}
 */
export function apply(blueprint, options = {}) {
  const {
    includeAssistantIndices = 'all',
    includeWorkspaceConfig = true,
    editedMainInstructions,
    slugify = DEFAULT_SLUGIFY,
    emojiForIcon = DEFAULT_EMOJI,
    now = Date.now(),
  } = options;

  if (!blueprint?.proposedAssistants) {
    return { assistants: [], connectors: [], configPatch: { tenant: {} }, meta: { kbs: 0, assistants: 0, configTouched: false } };
  }

  const proposed = blueprint.proposedAssistants;
  const indices =
    includeAssistantIndices === 'all'
      ? proposed.map((_, i) => i)
      : Array.isArray(includeAssistantIndices)
      ? includeAssistantIndices
      : [...includeAssistantIndices];

  /** @type {SuggestedAssistant[]} */
  const selected = indices.map((i) => proposed[i]).filter(Boolean);

  const channelById = new Map((blueprint.channels || []).map((c) => [c.id, c]));

  // Knowledge bases: one per Assistant that has knowledgeSources. The wizard
  // emits them as `kind: 'kb'` connectors wired to /api/mcp-kb so they appear
  // in the Connectors tab and become selectable in AssistantDetail pickers.
  const newKbs = selected
    .filter((a) => (a.knowledgeSources || []).length > 0)
    .map((a, i) => {
      const id = `kb-setup-${slugify(a.name)}-${now}-${i}`;
      return {
        id,
        kind: 'kb',
        catalogId: 'kb_setup',
        name: a.clusterName === 'Universal' ? a.name : a.clusterName,
        description: 'Discovered from Staffbase channels during Setup.',
        endpoint: `/api/mcp-kb?kbId=${id}`,
        authMethod: 'SSO (demo)',
        status: 'connected',
        source: 'Staffbase Channels',
        domains: [],
        writeTools: [],
        articleCount: (a.knowledgeSources || []).reduce((sum, ks) => {
          const ch = channelById.get(ks.channelId);
          return sum + (ch?.sampledPostCount || 0);
        }, 0),
        addedAt: new Date(now).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        tools: [{ id: 'search', name: 'search', description: 'Search this knowledge base.' }],
      };
    });

  const kbByAssistant = new Map();
  let kbIdx = 0;
  for (const a of selected) {
    if ((a.knowledgeSources || []).length > 0) {
      kbByAssistant.set(a, newKbs[kbIdx]);
      kbIdx++;
    }
  }

  // Workspace mainInstructions + glossary are NOT prepended here. The runtime
  // composes them in via companyContextBlock (lib/orchestrator/system-prompt.mjs),
  // so baking them into each assistant's instructions would duplicate them in
  // the LLM context and clutter the admin-facing text area.
  const mainText = (editedMainInstructions ?? blueprint.workspace?.mainInstructions ?? '').trim();

  const newAssistants = selected.map((a, i) => {
    const sourceLines = (a.knowledgeSources || [])
      .map((ks) => `- ${ks.channelTitle} (${ks.url})`)
      .join('\n');
    const kb = kbByAssistant.get(a);
    return {
      id: `asst-setup-${slugify(a.name)}-${now}-${i}`,
      name: a.name,
      icon: emojiForIcon(a.lucideIcon),
      description: a.description,
      instructions: `# Role\n\n${a.systemPromptSnippet}${sourceLines ? `\n\n# Knowledge sources\n\n${sourceLines}` : ''}`,
      connectorIds: kb ? [kb.id] : [],
      audience: { everyone: true, groups: [], roles: [], locations: [] },
      status: 'active',
    };
  });

  // Tenant config patch — discovered workspace facts get merged onto the
  // existing tenant blob. The CONSUMER applies this with a merge strategy
  // (extend arrays, prefer new scalars, keep seeds for unrelated fields).
  /** @type {{ tenant: object }} */
  const configPatch = { tenant: {} };
  if (includeWorkspaceConfig) {
    const ws = blueprint.workspace || {};
    configPatch.tenant = {
      companyName: ws.companyName || '',
      companyMission: ws.companyMission || '',
      languages: blueprint.languages || [],
      glossary: ws.glossary || [],
      systemPrompt: mainText,
      workspaceFacts: ws.workspaceFacts || [],
      tone: ws.tone || [],
      questionTypes: ws.questionTypes || [],
      // discoveredLocations / discoveredRoles: emitted so the consumer can
      // merge into tenant.locations / tenant.roles without losing seeds.
      discoveredLocations: (blueprint.orgSignals?.locations || []).map((l) => l.name).filter(Boolean),
      discoveredRoles: (blueprint.orgSignals?.departments || []).map((d) => d.name).filter(Boolean),
      totalUsers: blueprint.orgSignals?.totalUsers ?? null,
    };
  }

  return {
    assistants: newAssistants,
    connectors: newKbs,
    configPatch,
    meta: {
      assistants: newAssistants.length,
      kbs: newKbs.length,
      configTouched: includeWorkspaceConfig,
    },
  };
}
