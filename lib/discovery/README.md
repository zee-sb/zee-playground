# `lib/discovery/` — workspace discovery

**Status: Phase 5 in progress. The three discovery prompts are now versioned at [prompts/passA-workspace.txt](prompts/passA-workspace.txt), [prompts/passB-assistants.txt](prompts/passB-assistants.txt), [prompts/optimize-main.txt](prompts/optimize-main.txt) (loaded from [api/navigator-setup.mjs](../../api/navigator-setup.mjs) via [load-prompt.mjs](load-prompt.mjs)). The [SourceAdapter](source-adapter.mjs) interface is defined; the [Staffbase adapter](adapters/staffbase.mjs) wraps `lib/staffbase.mjs`. Blueprint shape is documented at [types.mjs](types.mjs). The actual move of `handleDiscover`'s orchestration logic into `lib/discovery/discover.mjs` (and the rewrite of `api/navigator-setup.mjs` to be a thin HTTP shim around it) is the natural next step but not blocking — the contract is in place.**

Turns a workspace into a typed `WorkspaceBlueprint`: channels, pages, glossary, topic clusters, suggested assistants, main instructions.

## Contract

```
discover({ source: SourceAdapter, options }) → WorkspaceBlueprint
```

Discovery is a pure pipeline. It does NOT write Assistant or Connector objects; that is the [blueprint-applier](../blueprint-applier.mjs)'s job.

### `SourceAdapter`

The interface that lets discovery run on Staffbase today and other sources later (Confluence, HRIS, etc.).

```
interface SourceAdapter {
  gather()       → SourceSignals       // channels, pages, posts, groups, users, counts, languages
  workspaceKey() → string              // persistence key (e.g. Staffbase branch id)
  describe()    → { name, kind }       // shown in prompts / UI
}
```

Implementations:
- `lib/discovery/adapters/staffbase.mjs` — wraps `lib/staffbase.mjs`. Default.

### `WorkspaceBlueprint`

JSON Schema lives in `lib/discovery/blueprint.schema.json` (Phase 5). Shape:

```
{
  schemaVersion: number,
  source: { name, kind, key },     // who produced this
  channels[], pages[], posts[],
  groups[], users[], counts, languages[],
  workspace: { name, mission, mainInstructions, glossary, tone, … },
  topicClusters[],                 // grouped topics surfaced from content
  suggestedAssistants[],           // 5-9 proposals (icon, name, instructions snippet)
  meta: { discoveredAt, durationMs, … }
}
```

## Prompts

Versioned files (loaded at runtime):

- `lib/discovery/prompts/passA-workspace.txt` — workspace overview pass
- `lib/discovery/prompts/passB-assistants.txt` — assistant proposals pass
- `lib/discovery/prompts/optimize-main.txt` — polish pass for mainInstructions edits

## Persistence

Blueprints live in `navigator_config_blueprints` (`lib/blueprints.mjs`). Keyed by `SourceAdapter.workspaceKey()` (currently a Staffbase branch id).

## How to port

To run discovery against a different source:

1. Implement `SourceAdapter` against your data source.
2. Pass it to `discover()`. No other code changes needed.
3. If the target schema differs from `WorkspaceBlueprint`, write a small mapper in your applier.

## Coupling notes

- Discovery does NOT know about Assistants, Connectors, or Flows. The [blueprint-applier](../blueprint-applier.mjs) maps Blueprint → runtime config.
- Discovery does NOT call MCPs or the orchestrator. It only reads from its source adapter and emits a blueprint.
