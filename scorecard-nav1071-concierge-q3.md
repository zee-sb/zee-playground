# Product Scorecard — Q3 2026 (Release 2026.3, July 30)

**Feature:** Navigator — Content Scope Controls (Search Granular Controls V2)
**Note:** SEPARATE deliverable from the Concierge first version (auto-context scan). Folds into Concierge later — the headline Concierge scorecard is `scorecard-concierge-autocontext-q3.md`.
**Jira epic:** [NAV-1071](https://mitarbeiterapp.atlassian.net/browse/NAV-1071) · **Initiative:** PI-306 NAV-BET-04 Navigator Concierge
**PM / Assignee:** Zyad Abuzeid · **Deadline to fill:** June 9, 2026

> Draft against the [Product Scorecard Fields 2026](https://mitarbeiterapp.atlassian.net/wiki/spaces/DOCSnGUI/pages/6683918362) guide. Fields marked **⟶ DECISION** need your / PMM / Andra's call before Comms Freeze. Create the live card in the PSC Jira project and set Parent = the 2026.3 release.

---

## Description fields

**Summary (full):**
Content Scope Controls give intranet admins direct, content-level control over what Navigator searches — so the assistant answers from a curated, trustworthy slice of the intranet instead of everything by default (including old, broken, or irrelevant content). Admins can: exclude all news in one toggle or pick a subset of news channels; include/exclude specific pages; and set a freshness cutoff so content older than a chosen date/timeframe drops out of results. Works on tenants **without Spaces** (flat/legacy intranets), falling back to channel- and page-level controls. Configured at the assistant/tenant level in the admin UI. Builds on Search Granular Controls V1 (NAV-394, shipped Q2 2026), which delivered the role/permission spine; V2 adds the content-scope lever without touching permissions or data governance. Default when nothing is configured = search everything (no regression vs. today).

**For Improvements — detailed changes from last release (vs. V1 / NAV-394):**
- News channel include/exclude, plus a master "exclude all news" toggle
- Page-level include/exclude from search scope
- Freshness / last-modified cutoff (exclude content older than a date or rolling window)
- Scope controls now work on tenants **without Spaces** (V1 assumed Spaces-based governance)

**Feature Name:** Navigator Content Scope Controls  *(⟶ DECISION — confirm with PMM)*
**German Feature Name:** Navigator Inhaltsbereich-Steuerung  *(⟶ DECISION — confirm with PMM)*

**Minimum User Role:** Administrator  *(⟶ DECISION — confirm Space Administrator is sufficient for assistant-level scoping)*

**Customer Use Case:**
Customers repeatedly report Navigator returning wrong or low-confidence answers because it retrieves from outdated news, archived pages, or draft material (feedback corpus: Camion, EBZ, ISTA, Seeburger, VOICES). They have no way to say "only look here, ignore anything stale" without restructuring or deleting content. Content Scope Controls let an admin curate Navigator's knowledge in minutes — cutting noise and raising answer quality without a content-migration project.

**Figma File & Screenshots:** *(⟶ ADD — link the V2 designs; screenshots exist on the NAV-1071 epic. Set link-sharing to "anyone with link can view".)*

**Known Limitations:**
- Freshness cutoff behaviour: hard exclude vs. ranking de-prioritisation — *(⟶ confirm; draft assumes hard exclude)*
- No per-end-user scope overrides; configured at assistant/tenant level only
- Permission/ACL changes remain owned by V1 (NAV-394), not this feature

**Feature Slack Channel:** #feedback-navigator
**Internal Documentation:** [NAV-1071 epic](https://mitarbeiterapp.atlassian.net/browse/NAV-1071) · [Granular Knowledge Base Selection PRD (6545113089)](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6545113089)
**Activation and Further Rollout:** *(⟶ DECISION — see Activation Method below)*

---

## Details section

| Field | Value |
|---|---|
| **Status (on release day)** | ⟶ DECISION — likely **Beta / Early Access** (epic is Open today; build runs Sprint 5–6). Confirm before freeze. |
| **Product** | Intranet (+ App if Navigator surfaces there) ⟶ confirm |
| **Category** | ⟶ DECISION — Pull vs. Platform (which product unit Navigator reports into) |
| **Assignee** | Zyad Abuzeid |
| **Technical Writer** | ⟶ ADD |
| **Product Marketing Manager** | ⟶ ADD |
| **Pricing: Email** | Not Applicable |
| **Pricing: Add-on** | ⟶ DECISION — AI/Navigator add-on? Confirm with Andra |
| **Pricing: Base** | ⟶ DECISION — likely "Customers with Specific Existing Feature" (have Navigator) ; confirm pre-2026 pricing availability |
| **Feature Flags** | ⟶ ADD all flags (this feature + base Navigator flags) |
| **Feature Activation Method** | ⟶ DECISION — Slug list vs. Related Flag (existing Navigator customers). If Slug list, you must deliver it to Customer Care by **July 22**. |
| **Customer Control Collection** | ⟶ DECISION — EEX or Add-On collection |
| **Opt-Out List** | ⟶ DECISION — if yes, send to Sören/CC before release |
| **Feature Type** | Feature Improvement (follows NAV-394 V1) |
| **Communication** | Communicate *(⟶ confirm not Top Communication)* |
| **Parent** | 2026.3 (Q3 release) |

---

## Open decisions to close before June 9
1. **Release-day status** — Beta/EA vs. Production. Drives documentation depth and comms.
2. **Pricing** (Base + Add-on) — the one to settle with Andra early.
3. **Activation method** — Slug list (→ owe a list July 22) vs. related-flag to existing Navigator customers.
4. **PMM + Technical Writer** assignment.
5. **Category** (product unit) and confirm **Min User Role**.
