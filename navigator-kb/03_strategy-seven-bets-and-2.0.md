# Navigator Strategy — The 7 Bets, the 2.0 Architecture, and the MAU Story

## The MAU story (anchor numbers — get these right)
- **6M** — total intranet MAU across all Staffbase customers (the TAM).
- **20K** — AI MAU today (the floor).
- **1M** — end-of-2026 AI MAU goal (committed externally).
- **50×** — the multiplier between today and the goal; the size of the gap the 7 bets close.

**1M is the goal, not the audience.** TAM is 6M. EOY share ≈ 1M / 6M ≈ 17%. For exec/CEO framing prefer the 6M / 20K / 1M / 50× shape.

## The 7 bets (H2-2026)
Reshaped from 4 bets to 7, approved by Martin (CEO) on **2026-05-21**. Every Navigator feature/PRD/epic in H2-2026 maps to exactly one bet; otherwise it's deferred or won't-do.

**Sharpened (existing roadmap, sharper outcomes):**
- **01 — Conversation 2.0** (PI-152): continuity, history, push-to-talk, rich responses, model-suggested next steps, language detection, context-aware. Absorbs the prior "Navigator 2.0" umbrella. *MAU lever: returning users ×2.*
- **02 — Assistants 2.0** (PI-304): scale to 100+ per tenant, ACL, targeting, templates, AI-generated assistants, MCP/A2A integration. *Coverage ×10.*
- **03 — Actionable Analytics** (PI-305): aggregated dashboards, resolution state, Evals 2.0, AI insights for admins, employee feedback. *Healthy tenants ×1.5.*

**Net new:**
- **04 — Navigator Concierge** (PI-306): productize the hackathon onboarding wizard — first-run wizard + audit/refresh + CSM tab in Studio. Navigator does the setup work. *Activated tenants ×3.*
- **05 — MCP + A2A Orchestration** (PI-307): discovery of tools/resources/prompts/skill cards on any customer MCP, with user-token identity passthrough. *Use cases ×3+.*
- **06 — Staffbase MCP (Navigator surface)** (PI-308): Tilo & Martin's work exposes Staffbase capabilities as agentic primitives; Navigator becomes the conversation surface for the whole intranet. **Biggest PRD gap — no whole-bet spec exists yet; PRD comes before any Bet 06 Jira work.** *Surface area ×5.*
- **07 — Search ⇄ Navigator** (PI-309): unify retrieval, AI summaries, seamless handover from search to conversation. Foundations via MORI hybrid search. **Largest single MAU lever.** *Entry points ×5–10.*

**Plus 00 — Navigator Tech Enablement** (PI-303): voice transport, DX, prod readiness, model cutover — cross-cutting enablers.

## Two kills (decommission, not deferral — don't propose these)
- **Live voice experience** → replaced by **push-to-talk**. No customer evidence; WebSocket transport caused a mobile source-click bug. Retirement tracked as a Task under Bet 00.
- **mem0 user memory** → already removed. Over-stored; blocked fresh content from assistants/pages/news; no recall-quality evidence.

## The Navigator 2.0 architecture commitment (decided 2026-05-06)
Navigator is re-architected from the ground up. **Single track — no parallel 1.0/2.0 run.** Tenants migrate to 2.0 as surfaces ship; eval gating prevents regression.

**Why:** compounding issues incremental fixes won't solve — sources rendered via a side-channel tool call (cause of Getinge/Voices demo bugs), prompt debt with no eval gating, single-tier model choice, and a parallel retrieval stack that would diverge from MORI.

**Founding principles:**
1. Speed when answers are obvious; visible thinking when they're not. Three-tier latency contract: Instant <400ms / Researching 400–1500ms / Deep 1.5–8s / Acting variable.
2. Sources live **inside the structured response envelope**, never as a side-channel tool call.
3. The model decides response shape (answer / clarify / offer_options / propose_action / refuse / escalate) as a structured-output field.
4. Every prompt or model change ships **behind an eval gate** — no exceptions.

**Architecture pillars:** per-turn model tiering on Azure (GPT-5-mini for classify/route, GPT-5 or o4-mini reasoning for hard synthesis, GPT-5-mini for action planning); JSON-schema structured outputs every turn (citations, follow_ups, options, actions are first-class); a lightweight orchestrator state machine (greet → classify → small_talk | retrieve | plan_action | clarify → synthesize → stream); retrieval consumed from MORI hybrid search (not built in Navigator); per-message language detection with explicit override; decision policy as positive prompt clauses, each mapped to an eval case.

**Key dependencies:** MORI Phase 3 ("Connect Search with the AI Assistant") needs joint commitment on paper; AIW-348 (Conversation Evaluation) becomes the eval-gate runtime and must be production-trustworthy before any 2.0 release.

**Consequence framing:** per-assistant starters, source-citation reliability, language switching, and follow-up questions all fall out of the structured-output envelope automatically — frame them as consequences of 2.0, not standalone items.

*Layer-1 strategy page: AW 6918012931 (2026 Roadmap Q2 and beyond). Seven-bets and 2.0 detail per Zee's memory + Initiative Map (AW 6976798741).*
