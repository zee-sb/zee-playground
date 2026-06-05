# Navigator — Integrations & Actions Feedback (prioritization input)

_Source: #feedback-navigator Slack (Mar 30 – Jun 3, 2026) + customer/internal email. Compiled Jun 3, 2026._

This focuses on what customers want Navigator to **connect to** (integrations) and **do** (actions), plus the source/permission issues that gate every integration. Demand counts are mentions across distinct customers/threads.

---

## TL;DR prioritization

| Priority | Theme | Why now |
|---|---|---|
| **P0 — Foundation** | Working/clickable source links; permission & visibility enforcement | Most-repeated complaint + active deal-blockers (JSD won't proceed; Heraeus, Fox leak restricted content). No integration matters if links break or leak content. |
| **P1 — Action widgets we already own** | ServiceNow (tickets + forms), Workday/absence/payslip | Widgets exist (Actions team owns them); demand is concrete and live (STIHL blocked, multiple demos). Fast win via the Actions×Navigator track. |
| **P2 — Source expansion** | SharePoint ingestion, non-PDF formats, Staffbase widgets as sources | Repeated across EU enterprise (Brussels Airlines, EBZ, BASF, DrinkPAK); blocks "answer from our real docs." |
| **P3 — AI interoperability** | M365 Copilot / Copilot Agent interface; Claude/external agent via MCP | Strategic, named asks (Stadtwerke München, Colosseum, Schwarz). MCP orchestrator already on the 2.0 roadmap; blocker = per-user tokens. |
| **P4 — Net-new connectors** | Roxtra (hospital QM) and similar vertical tools | Single-customer today, but APs committed at VOICES → expectation set. Use as the template for "external tool connection" roadmap. |

---

## Integrations requested

**ServiceNow (tickets + forms)** — highest integration demand
- TTI: testing the ServiceNow integration, created an "IT Ticket" in Navigator but it doesn't surface; ServiceNow not actually connected. (May 19)
- Kevin Kleist: best practice for showcasing ServiceNow **Forms** in Navigator; needs a working demo form/account. (May 18)
- Laura Turner: wants ServiceNow Forms for In-N-Out & Dell demos. Fix for ServiceNow form link shipped to prod Apr 30. (Apr 29–30)

**Workday / absence / payslip (HR)**
- STIHL (Kevin Kleist): Workday integration set up and shows in widgets, but Navigator says it has no access to vacation days. Demo blocker. (May 21)
- Camion: wants Navigator to point to / trigger HR self-service (address change) instead of giving an email address. (May 7)
- Internal: Actions team (Inês Gil, Khaled Garbaya) owns **absence, payslip, ServiceNow** integration widgets and is asking what customers want Navigator to do with them. ("Actions x Navigator," Jun 3)

**SharePoint (as content source)**
- Brussels Airlines: asking for the **timeline** for SharePoint integration. (Apr 29)
- EBZ Gruppe: docs live on SharePoint; Navigator finds the page but the links to page/document are missing. (May 7)
- DrinkPAK: will Navigator pick up links that point out to SharePoint? (Apr 17)
- BASF EC: confirms SharePoint / external URLs currently NOT supported. (May 19)

**Microsoft 365 / Copilot interoperability**
- Stadtwerke München: is there an interface between Staffbase and **Copilot Agent** (per-user enablement) and **Copilot M365**? (May 11)
- ebm-papst: evaluating Navigator head-to-head vs an internal HR chatbot built on Copilot. (May 19)
- Jon Lam: needs differentiation vs Copilot for a competitive deal (Veritiv). (May 5)

**External AI agent / Staffbase API via MCP**
- Colosseum Dental: wants backoffice employees to use **Claude** with their Staffbase login (API/connector). Zee: building MCPs for this; blocker = dedicated per-user tokens. (May 19–20)
- Schwarz Group / digits: "AI Agent Integration" — effort estimate requested, none yet given. (May 21)

**Roxtra (external quality-management tool — hospitals)**
- Robert Bosch Krankenhaus (via VOICES): wants Roxtra connected to Navigator; APs onsite said it's "technically possible and coming soon" → customer now expects a concrete timeline. (May 20)

---

## Actions customers want Navigator to perform (not just answer)

- **Surface & open forms**: Jon Lam — "when can forms be surfaced by Navigator?" (Apr 1); Camion — point to / open the address-change form; Laura Turner — ServiceNow forms in-chat.
- **Create tickets**: TTI — raise an IT ticket via Navigator/ServiceNow.
- **Trigger HR self-service / notifications**: Camion — "trigger a notification directly" for address change rather than telling users to email HR; STIHL/Workday — answer "how many vacation days do I have left."
- **Pull live HR/personal data**: absence balance, payslip (Actions widgets), birthdays from profiles (Bentleyinno).

> Roadmap signal (Navigator 2.0 notes, May 20): evolve sub-assistants "toward specific **workflows**," improve context delivery "via **tool integration**," and "build an **MCP orchestrator** for all types of MCP connectors." The action/integration asks above map directly onto this.

---

## Source & permission issues that gate every integration

These outweigh any single integration by volume and severity — fix first.

**Broken / non-clickable source links** (most frequent complaint)
- seeburger, Getinge, Morley, Fox/Foxcorp, Alaska Airlines, EBZ, Katryna Weiss, Manuel (broken-links thread). Pattern: correct answer, but PDF/page link is broken, incomplete, or not clickable; sometimes only appears on a second prompt.

**Permission / visibility leakage** (deal-blockers)
- Johannesstift Diakonie: Navigator displays **hidden** content (Staff Party page) — "complete roadblock, won't proceed until resolved." (May 19)
- Heraeus: Navigator disregarded visibility restrictions, returned content the test user shouldn't see. (May 5)
- Fox/Foxcorp: surfaced widget-targeted PROMO content to non-targeted users. (Mar 31)

**Indexing freshness & "learning"**
- Erica Wilk: unpublished SOP page still answered from. (Apr 15)
- ebm-papst: newly added keyword ("Gehaltsnachweis") not recognized; index update frequency unclear. (Jun 1)
- Lutz Gerlach: doesn't recognize policy end-dates (ThanksBen); correction doesn't persist across sessions. (Apr 21)

**Staffbase widgets / structured data not searched**
- JSD: meal plan & events/calendar not found. Seeburger & Bentleyinno: User Profile widgets, Org Chart, Employee Directory, birthdays not read.

**Admin source controls (repeated config asks)**
- Fressnapf: prioritize pages vs articles; restrict content age; link topics to specific sources.
- Cabonline: exclude sources beyond space level; better source transparency; prioritize news over static pages.
- Gebrüder Weiss: predefined FAQ answers; exclude/prioritize outdated content.
- Seeburger: manageable source list (title, space, visibility, owner, modified) with bulk-select & sort; targetable conversation starters.

**File-format support beyond PDF**
- BASF: Word/PPT/Excel/URLs/SharePoint not supported. Sunidhi: guidance for making PDF forms "AI-readable." Steven Stöber: brochure-style PDFs need linear/structured reformatting; explicit sub-assistant routing required.

---

## Config / UX asks (track, but not integration-critical)

- Customize "Ask AI anything" text; slogan >50 chars; personalization placeholders ({{user.profile.firstName}}) — EBZ, Max Rugen, Morley, Seeburger.
- Voice male/female toggle or disable; audio quality choppy/accented — Morley, Steven Stöber.
- Language handling: stays English / wrong locale (Spanish-Mexico vs Spain; German device → English UI) — kampfdemo, Sören, Karl/Adrian, Laura Turner.
- Persona/user-group segmentation of conversation starters & knowledge base — Chriscelle, Seeburger.
- Analytics reset before launch; admin visibility for "Report Issue" — Morley, Max Scholz, ebm-papst, Fox.
- Activation/deactivation friction: AI-hub tile not clickable, no off-toggle, stuck "Activation in Progress" — Philipp Schneider, Nora Grindemann, Julia Patschäke, Laura Turner, Verizon/KinderCare demos.

---

## Recommended next steps

1. **Bring P0 + P1 to the Actions×Navigator meeting (today).** Confirm ownership: links/permissions = Navigator core; ServiceNow/absence/payslip surfacing = Actions widgets. Agree a joint "actions in Navigator" slice.
2. **Make links/permissions a tracked epic** — it's the top blocker by volume and kills enterprise deals.
3. **Sequence integrations** ServiceNow → Workday/absence-payslip → SharePoint → Copilot/MCP interop → vertical connectors (Roxtra) as the external-connector template.
4. **Give field teams a holding answer** on the external-tool timeline (Roxtra, SharePoint, Copilot) since VOICES set expectations.
