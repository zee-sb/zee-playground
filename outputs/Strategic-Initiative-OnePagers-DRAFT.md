# Strategic Initiative One-Pagers — DRAFTS for Wed working session

**Prepared for:** joint fill-out with Jasmina (Wed)
**Owner:** Zyad Abuzeid (Employee AI)
**Purpose:** Bring the old Strategic Initiatives board into line with the locked 7-bet shape (approved by Martin 2026-05-21). Four existing concepts are updated/pivoted/replaced; three new pitches use the Product Concept template fresh.

Each draft below mirrors the **Product Concept** template exactly (Owner / Unit / Info table / Concept / Version 1) so it can be pasted straight into Confluence. Notes in _italics_ and **Open for Wed** lines are working scaffolding — strip before publishing.

---

## How these map to the 7 bets

| Board initiative (old) | Action | Becomes (bet) | Jira |
| --- | --- | --- | --- |
| Assistants 2.0 — PI-270 | Update | Bet 02 Assistants 2.0 | NAV-BET-02 / PI-304 |
| Navigator Entry Points — PI-271 | Rename + pivot | Bet 01 Conversation 2.0 | NAV-BET-01 / PI-152 |
| Actions Integrations — PI-274 | Replace | Bet 05 MCP Client & A2A | NAV-BET-05 / PI-307 |
| Workflows as part of Collections — PI-275 | Park (comment) | (superseded by Bet 08 Navigator Workflows) | PI-275 |
| **NAVIGATOR CONCIERGE** | New pitch | Bet 04 Navigator Concierge | NAV-BET-04 / PI-306 |
| **SEARCH ⇄ NAVIGATOR** | New pitch | Bet 07 Search ⇄ Navigator | NAV-BET-07 / PI-309 |
| **ACTIONABLE ANALYTICS** | New pitch | Bet 03 Actionable Analytics | NAV-BET-03 / PI-305 |

_Recommendation on the rename-vs-new question:_ for the three that still describe live, funded work (Assistants, Entry Points→Conversation, Actions→MCP) **edit and rename in place** — keep the PI ID so history and PI rollups survive. Only **Workflows** is parked rather than retired. The three NEW pitches are genuinely new and should be created fresh.

---

# 1. Assistants 2.0 — UPDATE (PI-270 → Bet 02)

**Concept Owner:** @Zyad Abuzeid
**Unit:** Employee AI

## Info — [PI-270](https://mitarbeiterapp.atlassian.net/browse/PI-270)

| Title | Strategic Alignment | Value and Impact | Estimate | Investment Category | Teams |
| --- | --- | --- | --- | --- | --- |
| Assistants 2.0 | 1M MAU Employee AI + conversation resolution rate | Targeting raises personal relevance → adoption & resolution; admin self-service cuts setup cost; unlocks a chargeable Navigator tier | **M** — scope grew from "collections" to scale-to-100 + AI generation + templates + targeting + MCP/A2A integration | Innovation | Navigator + Studio/Admin. 🤝 Dependency: Bet 05 (MCP/A2A) for assistant↔tool integration |

## Concept (how you want to build it)

**DESCRIPTION:** Turn the single-collection model into a full assistant platform. Customers build many dedicated, targeted assistants (e.g. HR, Safety, IT) — each a trimmed-down, governed knowledge scope that surfaces as its own conversation starter to the right employee group. Five capabilities:

- **2.1** Scale to 100 assistants per tenant + user/group ACL
- **2.2** AI generation of assistants from existing intranet content
- **2.3** Assistant templates marketplace
- **2.4** Targeting — user group × content × behavior
- **2.5** Assistant ↔ MCP/A2A integration (consumes Bet 05)

## Version 1

Scale-to-100 + ACL (already specced) plus user/group targeting and one AI-generated-assistant flow. Templates marketplace and MCP integration follow.

**Open for Wed:** confirm Estimate (S→M?); is the chargeable-tier framing safe to state to PLT yet?

---

# 2. Conversation 2.0 — RENAME + PIVOT (PI-271, was "Navigator Entry Points" → Bet 01)

**Concept Owner:** @Zyad Abuzeid
**Unit:** Employee AI

## Info — [PI-271](https://mitarbeiterapp.atlassian.net/browse/PI-271)

| Title | Strategic Alignment | Value and Impact | Estimate | Investment Category | Teams |
| --- | --- | --- | --- | --- | --- |
| Conversation 2.0 _(renamed from Navigator Entry Points)_ | 1M MAU Employee AI — adoption via **quality**, not just placement | Better answer quality + continuity → trust → repeat use → stickiness/MAU; fewer dropped conversations; higher resolution rate | **L** — absorbs the Navigator 2.0 re-architecture (structured-output envelope, per-turn model tiering, eval gating, MORI retrieval) | Innovation | Navigator. 🤝 Dependency: MORI (PI-38, retrieval), AI Quality Gates (PI-163, eval) |

## Concept (how you want to build it)

**DESCRIPTION:** _Pivot rationale:_ Entry Points aimed to lift adoption through visibility (prominent entry point, context-aware chat, handovers from news/podcasts). Visibility alone doesn't sustain adoption — **quality does**. We keep the adoption goal and the genuinely conversational pieces (context-awareness, news/podcast handover into a conversation) and reframe the initiative around making the conversation itself good enough to come back to: continuity and history, push-to-talk, richer response UI, and model-suggested next steps. This absorbs the prior Navigator 2.0 umbrella.

## Version 1

Conversation history + continuity, source-citation reliability (sources inside the structured response envelope, not a side-channel call), and model-suggested next steps. Push-to-talk and richer UI as fast-follows.

**Open for Wed:** confirm the rename is the right move vs. spinning Conversation 2.0 up new; the "prominent entry point" placement piece — does it stay here, move to Concierge, or drop? Estimate L needs the re-architecture caveat spelled out for PLT.

---

# 3. MCP Client & A2A Orchestration — REPLACE (PI-274, was "Actions Integrations" → Bet 05)

**Concept Owner:** @Zyad Abuzeid
**Unit:** Pull

## Info — [PI-274](https://mitarbeiterapp.atlassian.net/browse/PI-274)

| Title | Strategic Alignment | Value and Impact | Estimate | Investment Category | Teams |
| --- | --- | --- | --- | --- | --- |
| MCP Client & A2A Orchestration _(replaces Actions Integrations)_ | 1M MAU via expanded use cases; #2 GTM request, table stakes for enterprise rollout | Unlocks first real actions + wide coverage **without per-action product engineering**; customer's own MCP servers become Navigator capabilities; user-token identity passthrough keeps it enterprise-safe | **M** | Innovation | Navigator + Integrations team (contributes once patterns proven). 🤝 Dependency: Bet 06 Staffbase MCP (PI-199, Natalia) |

## Concept (how you want to build it)

**DESCRIPTION:** _Replacement rationale:_ The original Actions Integrations framework assumed per-action product engineering — slow, narrow. MCP + A2A gets broader coverage faster by **discovering** tools, resources, prompts and skill cards on any customer MCP server and letting Navigator reason over them, with user-token identity passthrough so each action runs as the actual employee. A2A lets Navigator hand off to external agents. This serves the same goal (expand use cases) and unlocks at least the first actions; the Actions team contributes once the integration pattern is clear.

## Version 1

MCP client that discovers tools/resources/prompts on one customer MCP with user-token passthrough; A2A handoff to one external agent. Low-risk / read-first actions behind explicit user confirmation.

**Open for Wed:** how much does Bet 06 (Staffbase MCP) gate v1? Confirm Unit stays "Pull". Where does the old Action Integrations Framework spec get archived vs. reused?

---

# 4. Workflows as part of Collections — PARK (PI-275, comment only)

**Action:** do not rewrite the one-pager — add a comment on the board / Jira initiative marking it **not urgent now**, with reasoning. Suggested comment text:

> **Status: parked / not urgent for H2-2026.** The workflow + forms persona-expansion play is now pursued as a dedicated, sharper vehicle — **Bet 08 Navigator Workflows** (no-code Forms + Workflows + Task Inbox, validated via prototype and customer reads with DHL and Vet Partners). This initiative as originally framed is XL, carries heavy cross-team dependency (NFS / CAD / MI / MIC / DOTT), and has unproven ROI. H2 priority is the 7 bets that close the 50× AI-MAU gap; complex multi-step "workflows inside collections" is a later-stage expansion. **Revisit once Bet 08 validates demand and the Conversation 2.0 + MCP/A2A foundations land.**

**Open for Wed:** confirm we park rather than retire; should this be formally linked as "superseded by" Bet 08 once Bet 08 has a board entry?

---

# 5. NAVIGATOR CONCIERGE — NEW PITCH (Bet 04)

**Concept Owner:** @Zyad Abuzeid _(confirm — TBD until discovery call)_
**Unit:** Employee AI

## Info — [PI-306](https://mitarbeiterapp.atlassian.net/browse/PI-306) _(NAV-BET-04)_

| Title* | Strategic Alignment | Value and Impact | Estimate | Investment Category | Teams |
| --- | --- | --- | --- | --- | --- |
| Navigator Concierge* | 1M MAU — activation is the front of the funnel; reduces time-to-value | Faster, higher-quality tenant activation → more tenants live → MAU; cuts CSM manual setup hours; audit/refresh keeps assistants healthy → resolution rate | **M** — hackathon prototype already exists | Innovation | Navigator + Customer Success (CSM) + Studio |

## Concept (how you want to build it)

**DESCRIPTION:** Productize the hackathon onboarding wizard. A first-run **setup wizard** discovers a tenant's intranet content and proposes assistants, knowledge scopes and conversation starters; an **audit/refresh** loop keeps them current as content changes; a **CSM tab in Studio** lets Customer Success trigger setup, review, and hand a configured Navigator to the customer. Turns activation from a manual CSM lift into a guided, repeatable flow.

## Version 1

First-run wizard that scans intranet content and proposes a starter set of assistants + starters, plus a CSM tab in Studio to trigger and audit. Built on the existing hackathon prototype.

**Open for Wed:** owner confirmation; CSM as primary user vs. admin self-serve; does audit/refresh belong in v1 or as a fast-follow?

---

# 6. SEARCH ⇄ NAVIGATOR — NEW PITCH (Bet 07)

**Concept Owner:** @Zyad Abuzeid _(confirm — TBD)_
**Unit:** Employee AI

## Info — [PI-309](https://mitarbeiterapp.atlassian.net/browse/PI-309) _(NAV-BET-07)_

| Title* | Strategic Alignment | Value and Impact | Estimate | Investment Category | Teams |
| --- | --- | --- | --- | --- | --- |
| Search ⇄ Navigator* | 1M MAU — search is the highest-traffic intranet surface; converting searchers into conversations is the biggest funnel into AI MAU. Unifies retrieval on MORI | Handover converts existing search traffic into AI conversations (major MAU lever); shared retrieval avoids a divergent stack; AI summaries improve search quality too | **L** — depends on MORI hybrid-search maturity and unifying two retrieval paths; cross-team (Search + Navigator) | Innovation | Navigator + Search + MORI (PI-38, Valerii). 🤝 Dependency: MORI Phase 3 |

## Concept (how you want to build it)

**DESCRIPTION:** Unify retrieval and create a seamless path from search to conversation. Search and Navigator share one retrieval backbone (MORI hybrid search), an AI summary answers on top of search results, and a one-click handover carries the query and context straight into a Navigator conversation. Employees who are already searching become AI-MAU without changing where they start.

## Version 1

AI summary answer on top of search results + a one-click "continue in Navigator" handover that carries query context. Both search and chat read the same MORI retrieval.

**Open for Wed:** how hard is MORI Phase 3 a blocker for v1? Joint ownership model with the Search team; metric definition for "search→chat handover".

---

# 7. ACTIONABLE ANALYTICS — NEW PITCH (Bet 03)

**Concept Owner:** @Zyad Abuzeid _(confirm — TBD)_
**Unit:** Employee AI

## Info — [PI-305](https://mitarbeiterapp.atlassian.net/browse/PI-305) _(NAV-BET-03)_

| Title* | Strategic Alignment | Value and Impact | Estimate | Investment Category | Teams |
| --- | --- | --- | --- | --- | --- |
| Actionable Analytics* | Closes the measurement/trust gap; gives admins the resolution-rate north-star; admins must see value to expand | Admins/CSMs see what works → expand assistants, fix gaps → adoption & resolution rate; resolution state + evals give a ground-truth quality story for renewals; AI insights surface content gaps | **M** | Enhancement / Innovation | Navigator + Data/Analytics. 🤝 Dependency: Evals (AIW-348 / AI Quality Gates PI-163) |

## Concept (how you want to build it)

**DESCRIPTION:** Give admins aggregated, decision-ready analytics: dashboards of conversations and top topics, **resolution state** (was the question answered?), **Evals 2.0** for quality, and **AI insights** that tell admins what to do next (e.g. "top 5 content gaps", "assistant X under-performing"). Moves analytics from raw counts to actions that raise resolution rate and prove value at renewal.

## Version 1

Admin dashboard — conversation volume, top topics, resolution state, and unanswered questions — plus one AI insight ("top 5 content gaps to close"). Evals 2.0 wires in as the quality layer.

**Open for Wed:** how much depends on the evaluation/ground-truth work being trustworthy first? Is resolution state self-reported, model-judged, or both? Scope of "AI insights" in v1.
