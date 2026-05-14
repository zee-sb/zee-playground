# Prompts index

Every LLM prompt in Navigator is now a versioned file (no inline templates buried in code). Edits to these files take effect on the next request — no rebuild required.

The loader pattern is the same everywhere:

```js
import { loadPrompt } from '<module>/load-prompt.mjs';
const system = loadPrompt('classifier', { connectors: domainMap });
```

Mustache-style `{{placeholders}}` are substituted at runtime. File contents are cached per-process to avoid re-reading on every request.

## Discovery (`lib/discovery/prompts/`)

| File | Purpose | Placeholders | Called from |
|---|---|---|---|
| [`passA-workspace.txt`](../../lib/discovery/prompts/passA-workspace.txt) | Pass A — workspace overview, glossary, mainInstructions | none | `passAWorkspace()` in [`api/navigator-setup.mjs`](../../api/navigator-setup.mjs) |
| [`passB-assistants.txt`](../../lib/discovery/prompts/passB-assistants.txt) | Pass B — propose 5–9 Assistants + topic clusters | `{{allowedIcons}}` | `passBAssistants()` in [`api/navigator-setup.mjs`](../../api/navigator-setup.mjs) |
| [`optimize-main.txt`](../../lib/discovery/prompts/optimize-main.txt) | Polish pass over admin-edited mainInstructions | none | `handleOptimizeMainInstructions()` in [`api/navigator-setup.mjs`](../../api/navigator-setup.mjs) |

## Orchestrator (`lib/orchestrator/prompts/`)

| File | Purpose | Placeholders | Called from |
|---|---|---|---|
| [`classifier.txt`](../../lib/orchestrator/prompts/classifier.txt) | Intent classifier — domains + inScope | `{{connectors}}` | `classifyIntent()` in [`lib/orchestrator/index.mjs`](../../lib/orchestrator/index.mjs) |

The agentic-loop **system prompt** is composed at runtime by [`lib/orchestrator/system-prompt.mjs`](../../lib/orchestrator/system-prompt.mjs). Each named function inside (`identityLine`, `companyContextBlock`, `personaBlock`, `flowBlock`, `groundingBlock`, `toolsBlock`, `behaviorTrailer`) is a documented section that `buildSystemPrompt({...})` composes. Read that file as the prompt itself.

## Flows (`lib/flows/prompts/`)

| File | Purpose | Placeholders | Called from |
|---|---|---|---|
| `scaffold-flow.txt` *(TODO)* | LLM scaffolder — generate flow steps from a description | TBD | `POST /api/navigator-assistant?action=scaffold-flow` (extraction deferred — see [`lib/flows/README.md`](../../lib/flows/README.md)) |

## Conventions

- **Naming**: `<kebab-case>.txt`. Keep names short — they appear in `loadPrompt('<name>')` calls.
- **Placeholders**: lowercase, no dots (`{{allowedIcons}}` not `{{flow.allowed_icons}}`). One source of truth per placeholder per file.
- **Editing**: feel free to tighten / re-word. The classifier and discovery prompts are battle-tested but not sacred — version control catches regressions.
- **Don't**: paste raw user data into prompts. The user content goes into the user role message; the prompt file is the system instruction template.
