# Product Scorecard — Q3 2026 (Release 2026.3, July 30)

**Feature:** Navigator Concierge — Automatic Context (first version)
**Initiative:** PI-306 — NAV-BET-04 Navigator Concierge · **Jira epic:** [NAV-1088](https://mitarbeiterapp.atlassian.net/browse/NAV-1088) (assignee: Filip Pižl)
**PM / Assignee:** Zyad Abuzeid · **Deadline to fill:** June 9, 2026

> Drafted against the [Product Scorecard Fields 2026](https://mitarbeiterapp.atlassian.net/wiki/spaces/DOCSnGUI/pages/6683918362) guide. This is the **Concierge first version** — the automatic content scan. Granular Controls V2 (NAV-1071) is tracked separately. Fields marked **⟶ ADD** are quick lookups; the status and activation calls are recommended below.

---

## Description fields

**Summary (full):**
Navigator Concierge automatically configures Navigator from the customer's existing Staffbase content — with **zero setup work on the client side**. On activation, Concierge scans available data — news, spaces, groups, user profile fields, most-popular topics, and the company glossary — and builds a grounded understanding of *who the company is* and *who its audiences are* (e.g. desk vs. frontline, how the org is segmented). That understanding becomes Navigator's baseline context (system-prompt grounding), so search and answers work well **before any manual configuration**. It replaces the setup customers and CSMs do today — organization instructions, "additional context" fields, source curation, conversation starters. This first version is a **quick scan**; deeper analysis, delta re-scans, and a refresh layer come later. Advisory-first: Concierge grounds context automatically; nothing high-risk is changed without admin visibility.

**Feature Name:** Navigator Concierge  *(⟶ confirm with PMM — or "Navigator Auto-Setup")*
**German Feature Name:** Navigator Concierge  *(⟶ confirm with PMM)*

**Minimum User Role:** Administrator *(runs automatically on activation; admin reviews the grounded context)*

**Customer Use Case:**
Today Navigator quality depends on an admin remembering to write a persona prompt, list context, curate sources, and keep them fresh — most don't, so dormant tenants sit unconfigured and customers conclude Navigator is "broken" when it's just empty. The feedback corpus (Camion, EBZ, ISTA, Seeburger, VOICES) shows the same loop: activate → don't configure → generic answers → disengage, plus 70+ tenants on the "unable to activate" waitlist. Concierge makes Navigator self-configuring on day one — the path to scale isn't more admin work, it's zero admin work.

**Where it's found / how it's activated:** Runs automatically when Navigator is activated for a tenant (Beta: behind a feature flag for selected customers). Grounded context is visible to admins in the Navigator setup area.

**Figma File & Screenshots:** ⟶ ADD (link designs; set sharing to "anyone with link can view")

**Known Limitations:**
- First version is a **quick scan** — no deep/engagement-weighted body analysis yet
- No automatic refresh / delta re-scan yet (re-runs on demand)
- Advisory-first — grounds context but does not auto-apply high-risk changes
- ⟶ confirm language coverage (EN/DE first?)

**Feature Slack Channel:** #feedback-navigator
**Internal Documentation:** [Navigator Concierge Product Concept](https://mitarbeiterapp.atlassian.net/wiki/spaces/PP/pages/7007535196) · [PRD — Activation Concierge (6916866086)](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6916866086) · [Org Context Layer (6987448404)](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6987448404)

---

## Details section

| Field | Value |
|---|---|
| **Status (on release day)** | **Beta / Early Access** — net-new capability, flagged to design-partner tenants |
| **Product** | Intranet (+ App where Navigator surfaces) ⟶ confirm |
| **Category** | ⟶ ADD (product unit Navigator reports into) |
| **Assignee** | Zyad Abuzeid |
| **Technical Writer** | ⟶ ADD |
| **Product Marketing Manager** | ⟶ ADD |
| **Pricing: Email** | Not Applicable |
| **Pricing: Add-on** | Not Applicable |
| **Pricing: Base** | No separate pricing — bundled with Navigator. Select **Customers with Specific Existing Feature** = have Navigator. |
| **Feature Flags** | ⟶ ADD (Concierge scan flag + base Navigator flags) |
| **Feature Activation Method** | **Slug list** — Beta rollout to selected customers. Deliver the list to Customer Care by **July 22**. |
| **Customer Control Collection** | ⟶ ADD (the Navigator/EEX collection) |
| **Opt-Out List** | ⟶ likely N/A for a flagged Beta; confirm |
| **Feature Type** | New Feature |
| **Communication** | Communicate *(⟶ Top Communication? — it's the activation story)* |
| **Parent** | 2026.3 (Q3 release) |

---

## What still needs to happen before June 9
1. ~~Create the Jira epic~~ ✅ Done — [NAV-1088](https://mitarbeiterapp.atlassian.net/browse/NAV-1088), assigned to Filip.
2. Confirm **scope of the first scan** = company & audience (4.1) + structural scan (4.2) + topics (4.3) + glossary (4.4). Anything dropped from the July-30 cut?
3. Assign **PMM + Technical Writer**, add **feature flags**, pick the **CuCo collection** and **Category**.
4. Draft the **design-partner slug list** (owed July 22).

*Pricing: none — confirmed bundled with Navigator. Status: Beta/EA. Activation: Slug list.*
