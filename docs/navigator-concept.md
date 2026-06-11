# Navigator — Product Concept (Target Model)

**Status:** Draft v1 · Team design doc · 2026-06-11 · Owner: Zee
**Scope:** The concept layer — what admins and employees see and touch. The locked runtime architecture (hackathon decisions 1–10) is untouched; this defines what that runtime is *for*.

---

## Punchline

> **Connect your systems. Navigator answers what it can prove, asks before it acts, and shows you every gap. You review — you never build.**

Today's concept layer asks a non-technical comms or HR admin to pre-build the product before it's useful: author experts, bind connections, write instructions, assemble workflows from twelve step types. That's a developer's mental model sold to a non-developer. The target model inverts it: Navigator is useful the moment a system is connected, learns what's missing from real questions, and proposes its own configuration for the admin to approve. The admin's job shifts from *authoring* to *reviewing*.

---

## 1. The two concepts admins see

Everything an admin touches collapses into two objects. Everything else is engine room.

### Sources & Actions — what Navigator can see and do

One entry per connected **system** (Staffbase, SharePoint, Workday, ServiceNow…), never per protocol. Whether a system speaks MCP or a classic API is invisible; what the admin sees per connection:

| Facet | What the admin sees | What the admin decides |
|---|---|---|
| Capabilities | Plain language: "can look up time-off balances, can submit leave requests" | Toggle capabilities on/off |
| Risk tier | **Assist** (read & explain) / **Trigger** (prepare, human submits) / **Execute** (act with confirmation) | Set the tier per capability; Trigger is the default |
| Identity | Whose credentials act: the employee's (just-in-time auth via Connection Broker) or a service account | Pick identity mode where the system allows both |
| Permissions | "Inherited from {system}" — read-only display | Nothing. See the inheritance principle below |
| Health | connected / degraded / disconnected, enforced at runtime | Nothing; Navigator says "I can't reach Workday right now" on its own |

**The inheritance principle: Navigator never grants access, it only inherits it.** Retrieval is ACL-trimmed at query time against the source system; actions run under the employee's own identity wherever possible. There is no Navigator-side audience model to maintain in parallel with Entra groups, SharePoint permissions, or Staffbase visibility. Any screen that asks an admin to define who-sees-what is a design bug — it recreates the parallel-permissions liability we're eliminating.

### Behaviors — how Navigator answers and acts

The second object holds policy, not plumbing:

- **Answer policies**, set per content domain, not per bot. Default: answer with citations. Strict: cite-or-refuse (safety-critical content — medical procedures, flight ops). Deflect: always route to a human (legal, works council matters).
- **Tone & terminology** as structured data — terminology pairs ("PTO" → "Flexible Time Off"), tone preset, banned phrases. Not a free-prose system prompt an admin can silently break. The current mainInstructions textbox survives only as an advanced escape hatch.
- **Escalation routes**: per domain, where unanswerable questions go (a channel, a ticket queue, a named team). Escalation is a first-class *outcome*, not a failure.
- **Capability bundles** (internal): a named set of sources + capabilities + answer policy + tone that applies for an audience derived from real profile fields (location, role, contract type). This is what "Experts" become — **invisible policy containers the orchestrator composes at query time. Employees never see them, never pick one, and routing never depends on guessing which one the admin meant.**
- **Processes**: deterministic flows, reserved for compliance-critical sequences — approvals, signatures, works-council steps, anything auditable. See §4.

## 2. The employee experience

**One Navigator.** No expert picker, no assistant gallery. The employee asks; the system composes sources, tools, and policy behind the scenes. Multi-domain questions ("I'm pregnant — what leave am I entitled to, who do I tell, how do I update payroll?") are the norm, not an edge case, and no admin-drawn boundary should be able to break them.

**Context is explicit and inspectable.** Navigator's user context is a visible contract, not prose buried in instructions: *"Answering as: cabin crew, A320 fleet, Hamburg base, tariff contract."* The employee can see it and flag it when wrong. Internally these are metadata filters on retrieval and parameters to tools — which is also how the exotic verticals work: a medical-procedures or cabin-crew assistant is not a separate expert, it's the same Navigator with context-selected corpus and a strict answer policy.

**Trust moments, not traces.** The intent trace is a developer artifact. What ships for employees:

1. **Citations** on every factual answer — source, freshness, deep link.
2. **Action preview** before anything writes: "Here is exactly what I'll submit to Workday, acting as you." Approve / edit / cancel.
3. **Receipt** after: what was done, where, reference number, undo where the system supports it.
4. **Honest limits**: "I can't reach SharePoint right now" and "I don't have a reliable answer — I've routed this to HR Direct" are good answers.

**Language follows the employee**, including for previews, receipts, and escalations — never only for the chat bubble.

## 3. The learning loop — the Studio's actual job

The Studio's home page is the **question log**, not a builder. Setup is the first lap of a loop that never stops:

- **Day 0:** connect Staffbase. Navigator answers from intranet content with citations. That's the whole minimum setup — one decision, value before configuration.
- **Continuously:** Navigator clusters real questions and surfaces demand: *"17 people asked about parking permits this week. No source covers it. Draft answer attached — approve, edit, or route to Facilities?"* Gaps, stale-content flags, repeated escalations, and candidate capability bundles all arrive as **proposals the admin reviews**, not blank forms the admin fills.
- The current discovery wizard's two LLM passes become this loop's first iteration rather than a one-shot setup ceremony.

This is the only model a non-technical persona sustains past week two — and it's the moat: Copilot Studio gives enterprises a better builder; we remove the need for one.

## 4. Processes: described, not built

The deterministic flow runtime stays exactly as locked (state machines, no LLM at flow runtime). What dies is the **builder as the admin interface**. Authoring becomes:

1. Admin describes the process in words, or uploads the existing form / policy PDF.
2. Navigator drafts the state machine and shows it as plain-language steps ("collect these 4 fields → manager approves → submit to HR → confirm to employee").
3. Admin test-drives it in chat, adjusts in words, activates.

Two further constraints: a process must **justify its existence** — if the agentic loop with a confirmation gate can do it, it's not a process, it's a capability (most "workflows" die here, which is correct); and processes are **matched by purpose through the classifier**, not by admin-authored trigger phrases — keyword lists don't survive 30 languages. (The two-tier routing stays: deterministic match first, but on classifier-resolved purpose, not raw trigger strings.)

## 5. Migration: what maps to what

| Prototype entity | Target concept | What changes |
|---|---|---|
| Experts | Capability bundles inside Behaviors | No longer user-facing; audience derived from profile fields, not hand-set; routing never depends on them being well-partitioned |
| Connections (toolkits / handoffs / search KBs) | Sources & Actions | Unified per-system view; protocol invisible; risk tier + identity become the visible facets; degraded status enforced |
| Knowledge bases | Sources & Actions (read capabilities) | Same object as tools — a KB is a source with Assist-tier capabilities |
| Workflows (12 step types) | Processes | Generated from description/document; builder demoted to internal representation; most flows replaced by gated tool calls |
| mainInstructions + glossary | Behaviors (structured) | Terminology pairs, tone presets, answer policies; free prose becomes an escape hatch |
| Audience targeting on experts | Inherited permissions + context filters | The parallel audience model is deleted |
| Setup wizard | First iteration of the learning loop | Same discovery passes, re-run continuously; output is proposals, not a finished config |
| Intent trace (user-facing) | Trust moments (citations, preview, receipt) | Trace stays as an admin/debug view |

Untouched: all 10 locked runtime decisions — module boundaries, port contracts, ToolResult envelope, presentation registry, chat adapter, two-tier routing shape, deterministic flow runtime, one DB / one LLM provider.

## 6. What this explicitly kills

- A user-facing assistant gallery and any "pick your expert" UX.
- The visual workflow builder as the primary authoring surface.
- Navigator-side audience management duplicating source-system permissions.
- Free-prose system prompts as the default behavior control.
- "Configure first, value later" onboarding.

## 7. Risks and open questions

- **ACL-trimmed retrieval at query time** is the load-bearing technical bet (MORI/Bet 07 critical path). If a source can't give us per-user trimming, the fallback is per-bundle index partitions — which quietly reintroduces an audience model. Needs an explicit per-connector answer.
- **Proposal quality** carries the learning loop. Bad proposals burn admin trust fast; this needs the evaluation harness (Bet 03 / 3.3) more than any other feature.
- **Sales narrative**: "Assistants/Collections" is currently pitched as multi-agent differentiation. Capability bundles keep the substance (scoped knowledge, tone, audience) while dropping the user-facing picker — GTM needs the reframed story before this ships.
- **Question-log privacy**: clustering employee questions for admins needs anonymization thresholds (no cluster below n, no verbatim quotes by default) and works-council sign-off in DACH.
- **Power-admin escape hatches** (raw prompt, raw flow editor) must exist but stay off the main path — the concept dies if the escape hatch becomes the default.

## 8. What we borrow from Claude Cowork — and what we deliberately don't

Cowork is the closest shipped product to this concept, and it validates the two-object model: its only extension primitives are **connectors** (≈ Sources & Actions) and **skills** (≈ Behaviors). Everything else it does well sits around those two. Worth adopting:

| Cowork concept | Navigator translation |
|---|---|
| **Skills** — a markdown document that teaches the assistant a procedure; triggered by intent, no builder | The authoring format for Behaviors and Processes. An admin writes (or uploads) "how travel claims work here"; the system handles triggering. This is "described, not built" with a proven container — and skills are reviewable, versionable, and diffable, which works councils and audits love |
| **Plugins** — skills + connectors + config bundled, installed as one unit | **Packs**: "HR Starter," "Cabin Crew," "IT Helpdesk" — pre-built bundles of capability bundles, processes, and answer policies per vertical. Solves cold start better than discovery alone; turns Navigator config into a distributable artifact (and eventually a partner ecosystem) |
| **Connector registry + just-in-time suggestion** — mid-task: "this needs Jira; connect it?" | Employee-level JIT auth at the moment of need (already the Connection Broker strategy). Admin pre-approves the catalog; employees connect personally when a question first requires it — nobody pre-wires 40,000 users |
| **Trust ladder on actions** — allow once / always-allow per tool, scoped | Graduated confirmation: first Workday submission previews everything; the tenth, the employee may opt into "don't ask again for time-off requests." Confirmation fatigue is a real failure mode of "ask before acting" |
| **Memory** — persistent, file-based, user-inspectable, with explicit rules on what's never stored | The context contract, extended from static profile to learned context ("prefers German, asked about parental leave twice"). Cowork's two properties to copy exactly: the user can read and delete every memory, and sensitive categories are never persisted without explicit consent. That's the works-council answer designed in, not bolted on |
| **Scheduled tasks** — "every morning, brief me" | **Subscriptions**: "tell me when the shift plan changes," "remind me before my certification expires." Turns Navigator from pull to push — likely the strongest frontline-MAU lever in this doc |
| **Live artifacts** — saved views that re-query connectors on open | Saved answers that stay alive: "my open requests" as a persistent, refreshing page instead of a dead chat transcript |
| **Visible task progress** — plan widget during multi-step work | The replacement for the intent trace: a plain-language progress narrative for long-running actions ("checked your balance → drafting the request → waiting for your confirmation") |

And what we deliberately don't copy. Cowork puts the configuration burden on the *end user* — pick folders, install plugins, approve each step. Right for a single-player knowledge-worker power tool; wrong for an org-deployed product where the median user is a nurse on a phone. Navigator moves every one of those decisions to the org level (admin approves the catalog, packs ship defaults) and gives the employee at most one decision at a time, in the moment it matters. Cowork is also file-and-session-centric; Navigator stays question-and-action-centric — no file system, no session management, no model pickers. The litmus test for any borrowed concept: *does it survive a 30-second interaction on a phone in a hospital corridor?*

## 9. Glossary

| Term | Meaning |
|---|---|
| Source | A connected system Navigator can read from or act on |
| Capability | One thing a source enables, in plain language, with a risk tier |
| Risk tier | Assist (read/explain) · Trigger (prepare, human submits) · Execute (act with confirmation) |
| Capability bundle | Internal policy container: sources + capabilities + answer policy + tone for a derived audience (the artist formerly known as Expert) |
| Answer policy | Default-with-citations · cite-or-refuse · deflect-to-human |
| Process | Deterministic, auditable multi-step flow, generated from a description, reserved for compliance-critical sequences |
| Question log | The Studio home: clustered real demand, gaps, and proposals awaiting admin review |
| Context contract | The inspectable set of profile attributes Navigator uses to condition answers and filter retrieval |
