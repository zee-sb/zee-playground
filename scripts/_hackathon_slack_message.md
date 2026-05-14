*Navigator 2.0 — Hackathon results* 🛠️

I used my hackathon time to rebuild Navigator + Studio from scratch with one goal: have an opinionated reference architecture in our hands *before* we lock the H2-2026 roadmap. Everything you'd otherwise argue about in a backlog grooming — module boundaries, prompt management, flow runtime, tool envelopes, UI seams — is now a working prototype you can poke at, not a deck.

This is the version I'd build if I were starting today, informed by every piece of customer feedback we've collected in `#feedback-navigator` and from VOICES / DHL / Vet Partners. Not the final design — but a real, opinionated draft we can pressure-test as a team.

*Live prototype:* https://zee-playground.vercel.app (Studio + Companion + Setup + Analytics, all wired to the same workspace)
*Deep dive:* <https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6932168734/Navigator+2.0+Hackathon+results|Navigator 2.0 Hackathon results> (Confluence)

---

*🏗️ Technical decisions worth your attention*

• *Five modules, three ports* — `discovery`, `orchestrator`, `flows`, `mcp`, `ui` are now independent with typed contracts. The seams between them are `SourceAdapter`, `ToolProvider`, `FlowProvider`. If we port Navigator into the main product, those three interfaces are all you implement. Everything else is portable as-is.
• *Versioned prompt files* — every LLM prompt is a `.txt` file with mustache placeholders. No more inline templates buried 600 lines deep in route handlers. Edit, deploy, done. Index lives at `docs/prompts/README.md`.
• *Two-tier intent classifier* — flow trigger phrases get matched deterministically *before* the LLM is asked anything. The classifier prompt (`classifier.txt`) only runs if no flow takes the turn.
• *Deterministic flow runtime* — `runFlow` is a state machine. Zero LLM calls at runtime. Steps are `FormStep | ToolStep | ConfirmStep`, output of step N is tokenizable into step N+1 via `{{stepId.fieldId}}`. Pause/resume works because run state persists via `onSystemMessage`.
• *Canonical `ToolResult` envelope* — every tool from every MCP returns `{ summary, data, presentation?, sources? }`. The LLM reads `summary` + `data`. The UI reads `presentation`. They don't fight over the same field anymore.
• *Staffbase enrichment as middleware* — no special-casing. Staffbase MCP is just-another-MCP plus one `staffbaseEnrichment` middleware that walks `result.data` and adds profile URLs, channel names, sources. Same contract anyone can implement.
• *Presentation registry* — UI maps `presentation.kind` → React component. 14 kinds today (`post-list`, `user-grid`, `chart`, `kpi`, `timeline`, `flow-card`, `form`, `confirm-summary`, …). Unknown kinds fall back to a JSON pretty-print with a "raw" badge.
• *Chat adapter as the seam* — orchestrator emits raw events; `chat-adapter.js` translates to typed `RenderItem`s. Change event names without touching components.
• *One database, one LLM provider, no new infra* — Neon Postgres (5 tables), OpenAI, Vercel functions, Vite frontend. Nothing else. All four prototypes share the same canonical workspace via `navigator_config` with revision-based optimistic CAS.

---

*🎁 Product features built end-to-end*

• *Studio (admin)* — Assistants, MCPs (mock + real), external agents, knowledge bases, flows, team directory, Setup tab with discovery wizard, "View as" preview. Every change reflects in Companion live.
• *Discovery wizard* — two-pass LLM bootstrap: workspace overview + glossary + mainInstructions, then 5–9 suggested Assistants with topic clusters. Pluggable per source (Staffbase today, Confluence / HRIS later via `SourceAdapter`).
• *Companion (employee chat)* — Studio-driven orchestration, flow detection, tool-call cards, intent trace, multi-language UI (EN/DE), A2A handoff to the Onboarding Agent, per-user OAuth for external connectors.
• *Flows* — `Request PTO`, `Report Issue` templates working. Authoring UI in Studio. LLM "describe the flow" scaffolder for new flows.
• *Analytics dashboard spec* — Adoption / Quality (NRS) / Engagement / Retention / Company-level breakdown. Reference spec for the data team to point at when we instrument the real product.

---

*🧪 How to poke at it*

1. Open the live prototype.
2. Start in *Studio → Setup* — run discovery, edit instructions, watch the optimize pass.
3. Switch to *Companion* via "View as" — ask it something, follow the intent trace, trigger a flow.
4. Try a non-Staffbase MCP (HR, IT, Atlassian) to see the envelope + middleware chain.
5. Break something. Tell me what's wrong.

For the engineers: start at `ARCHITECTURE.md` (one-page picture), then `docs/WALKTHROUGH.md` — it's a 30-min guided tour of a single user turn end-to-end with line-level pointers into the code.

For designers: the presentation registry (`src/ui/presentation/registry.js`) is the contract — adding a new card type to chat is a one-component PR.

---

*🤝 What I want from you*

This is a *draft of the architecture I want us to commit to for H2*. Before I bring it to roadmap planning I want:

• Engineers — read `ARCHITECTURE.md` + `WALKTHROUGH.md`, tell me where the seams are wrong, what's over-engineered, what's missing.
• Designers — open Companion, run through a flow, look at the card kinds. Tell me what's awkward, where we're leaning on JSON when we should be rendering something opinionated.

Drop thoughts here or in the Confluence page. I'm blocking Thursday afternoon to walk anyone through it 1:1 if helpful.

— Zee
