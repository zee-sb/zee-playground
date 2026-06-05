# PI-306 — NAV-BET-04 — Navigator Concierge

> Draft initiative description in house template. MVP per Zee, 2026-06-04. Not yet pushed to Jira.

## Bet 04 — Navigator Concierge (NEW)

**Navigator configures itself from the customer's existing content — and only looks at the content that's worth looking at.** Zero-friction setup, no tone-of-voice prompts, no "additional context" fields, no admin curation marathon. The assistant grounds itself in who the company is and who its people are, and the admin scopes out the noise instead of restructuring their whole intranet.

### Why this initiative

Today Navigator quality depends on an admin remembering to write a persona prompt, list "additional context", curate sources, and keep it fresh. Most don't — so the dormant tenant base sits unconfigured and customers conclude Navigator is broken when it's actually just empty. The feedback corpus (Camion, EBZ, ISTA, Seeburger, VOICES) shows the same loop every time: activate → don't configure → generic answers → disengage. Plus 70+ tenants on the "unable to activate" waitlist. The path to 1M MAU isn't more admin work — it's zero admin work. Concierge makes Navigator self-configuring on day one and lets admins fix content-readiness with a scoping switch instead of a content migration.

### The MVP — two folds

**Fold 1 — Onboarding & Smart Configuration.** A quick scan of all available Staffbase data — news, groups, spaces, user profile fields, most popular topics, glossary — that produces a grounded understanding of *who this company is* and *who its audience types are* (desk vs. frontline, how the org is segmented). This becomes Navigator's baseline context and grounds search massively, eliminating the manual setup effort customers and CSMs do today. The MVP is a **quick scan**; depth comes later.

**Fold 2 — Granular Controls 2.0.** The other big friction point: customer content isn't ready — noise, contradictions, irrelevant or outdated pages and news. Granular scoping of what Navigator considers in search lets admins exclude that content **without restructuring their intranet, deleting old pages, or re-writing anything**. The scoping switch replaces the content-cleanup project.

### What it does

* Scans existing Staffbase data on activation — news, spaces, groups, profile fields, top topics, glossary — and builds a grounded picture of the company and its audiences
* Turns that into Navigator's baseline context (system-prompt grounding) so search works well *before* any manual configuration
* Eliminates the manual effort customers and CSMs spend today making Navigator usable
* Lets admins scope what Navigator considers in search — excluding noisy, contradictory, outdated, or irrelevant content — with controls, not a content migration
* Advisory-first: Concierge recommends and the admin approves; nothing high-risk auto-applies

### Boundary with Bet 02 (Assistants 2.0), Bet 03 (Analytics), Bet 07 (Search)

* **Bet 02** is the ongoing assistant lifecycle (create, edit, target, govern). **Bet 04** is the *initial* grounding + continuous config; it shares the AI-generation engine with Bet 02 (§2.2 ↔ §4.x). Suggesting Experts/Assistants (a later Concierge iteration) feeds Bet 02.
* **Bet 03** produces the behavioural signals (gaps, clusters, resolution state); **Bet 04** consumes them in later iterations to keep config current.
* **Bet 07** owns the *retrieval engine*. **Bet 04 Granular Controls 2.0** decides *what's in scope* for that engine per tenant/assistant. Concierge curates the input; Search runs the retrieval.

### Sub-topics (PRD ↔ Epic 1:1)

**MVP — Fold 1: Onboarding & Smart Configuration (Setup-layer quick scan)**

* 4.1 Company & audience understanding — who the company is + audience types (desk/frontline, segmentation) → system-prompt grounding
* 4.2 Structural scan — news, spaces, groups, and user profile fields (decode field *meaning* + group descriptions)
* 4.3 Topics — most-popular topics from content + top search queries; powers "what can I help with?"
* 4.4 Glossary — company-specific vocabulary mined from titles, channels, and profile-field codes

**MVP — Fold 2: Granular Controls 2.0**

* 4.5 Granular search scoping — admins curate what Navigator considers (exclude noise, contradictions, outdated, irrelevant) without restructuring or deleting content

**Later iterations (not MVP)**

* 4.6 Suggested Experts (Assistants) from content + audience signals → feeds NAV-BET-02
* 4.7 Deeper research on Staffbase content (engagement-weighted body sampling, canonical-source embedding)
* 4.8 Refresh + Live layers (delta re-scan; per-query personalization)
* 4.9 CSM workspace + re-runnable audit/refresh; graduation of high-acceptance recommendations to autonomous apply

### Key PRDs

* [PRD — Activation Concierge](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6916866086)
* [Context Lifecycle & Knowledge Layers](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6984335367)
* [Org Context Layer — Scope & First Implementation](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6987448404)
* [Granular Knowledge Base Selection PRD](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6545113089) — basis for Granular Controls 2.0 / "what AI sees"

### Dependencies

* 4.1–4.4 share discovery / AI-generation infra with NAV-BET-02 (§2.2); 4.6 Suggested Experts feeds NAV-BET-02
* Search query-log access (top + no-result queries) — coordinate with the Search / Intranet team
* 4.5 granular scoping relates to NAV-BET-07 retrieval (Concierge scopes input; BET-07 owns the engine)
* Advisory-first MVP ships without full Nav 2.0; autonomous mode later needs NAV-BET-01 primitives (language, response envelope, eval gating) + NAV-BET-03 analytics

### MAU lever

Activated tenants × 3+. The dormant base unlocks; quality stops being gated on the variance of admin attention.

---

**Discovery Plan:** https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6967787581
**Roadmap:** https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6918012931
**PRDs folder:** https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6977126471

Part of the 4→7 bet Navigator reshape approved by Martin 2026-05-21.
