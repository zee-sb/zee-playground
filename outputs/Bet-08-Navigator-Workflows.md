# Bet 08 — Navigator Workflows

**Author:** Zee · **Date:** 2026-05-22 · **Status:** Draft after Martin discussion
**Pairs with:** `src/prototypes/NavigatorWorkflows/` (prototype seed) and the existing [[seven-bets-2026]] strategy page.

---

## TL;DR

We add an 8th bet to the 2026 roadmap: **Navigator Workflows** — a no-code layer of Forms, Workflows, and a Task Inbox that lives inside Navigator. It targets the **20% of Copilot Studio's surface that delivers 80% of the value for a non-technical owner**: capturing a structured request from an employee in chat, routing it to a manager or HR contact, and tracking it through to a logged outcome — **without a third-party integration**.

The strategic prize is not Copilot Studio parity. It is **net-new users on the Staffbase platform**: HR Ops, Frontline Managers, Facilities/Ops, Safety Officers. People who never touch the communicator tools today but who own real operational data and would happily own a workflow.

The bet sits alongside, not inside, the seven. It cuts across pillars 2 (Actions), 4 (Employee Experience), and 5 (Admin & Studio), and it slots cleanly under the Staffbase MCP picture (Bet 06) once it ships.

---

## Why now

Three signals converged in the Martin discussion:

1. **Copilot Studio is sucking the air out of "build your own agent" stories.** We will not win a feature war on flow primitives, integrations, or developer surface. We can win on **time-to-first-workflow** for a non-technical owner — HR Manager, Operations Lead, Comms Manager — for whom Copilot Studio is over-engineered.
2. **Navigator's MAU ceiling is the communicator footprint.** Goal: 1M MAU by year-end ([[mau-math]]). Current 20K. The 50× gap is not "more communicators using Navigator harder," it's **new personas** — frontline, ops, HR Ops — pulled in by a job-to-be-done they recognize.
3. **The Staffbase intranet already has audience, profile, and routing.** Every other "ops workflow" tool spends 6 months selling integration. We already are the integration.

The 20/80 framing: a customer should be able to ship **shift swap, incident reporting, or equipment requests** in 15 minutes from a Navigator conversation, with **zero IT involvement and zero external system**. The data lands in a Navigator dashboard the owner can query and export. That is the wedge.

---

## What's in scope (and what isn't)

**In scope:**
- **Forms as first-class objects** — schema, fields, conditional logic (light), validation, optional file/photo upload.
- **Workflows** — simple "when X submitted → notify Y, create task for Z, post update to channel A" rules. No branching beyond conditions on form fields.
- **Task Inbox** — a per-user queue of items to action: approve/decline, comment, complete. The new home surface for managers and HR.
- **Submissions dashboard** — filterable, exportable record of everything captured. The data the owner came for.
- **AI-assisted authoring** — describe the workflow in chat, get a draft form + workflow back. (Same Studio capability we already use for assistant generation.)
- **Chat as the entry point** — workflows are triggered from Navigator chat (intent → form), but also accessible from a deep link or Studio launcher.

**Out of scope (deliberate):**
- General-purpose if/else/loop programming. If a customer needs that, they buy Copilot Studio or Power Automate.
- Third-party action execution beyond what existing MCP connectors already cover. Navigator Workflows is for the **internal** loop.
- Multi-step approval chains beyond one level. Single-approver is the 80% case.
- Reporting/BI. We give a dashboard tile and CSV export. Anything richer is connector territory.
- Custom code blocks or webhooks v1. They are a fast-follow if the wedge lands.

---

## The 8th Bet, in the same shape as the others

| | |
|---|---|
| **Name** | `08 Navigator Workflows` |
| **Outcome** | Non-technical owners ship operational workflows in <15 min. 5 anchor templates ship with GA. 3 named customers running a workflow in production within 60 days of GA. |
| **Net-new pillar?** | No new pillar. Cuts pillars **2 / 4 / 5**. The new entity types (form, workflow, submission, task) extend the existing `navigator_config` blob. |
| **Dependency on others** | Bet 02 Assistants 2.0 (intent → workflow trigger), Bet 03 Actionable Analytics (submissions show up on the dashboard), Bet 06 Staffbase MCP (workflows publish posts / read profile via the Staffbase MCP), Bet 07 Search ⇄ Navigator (workflows surface in search). |
| **Biggest risk** | Confusion with existing "flows" (the deterministic flow runtime locked in [[hackathon-locked-decisions]]). Resolution: workflows are user-authored objects; flows are the runtime that executes them. Same mental model as "form" vs "form renderer." |
| **Biggest unlock** | New persona acquisition. Every customer has 5–20× more frontline + ops + HR people than communicators. |

---

## Persona expansion — where the MAU comes from

Today Navigator's primary persona inside a customer is the **Communicator / Internal Comms Admin** (sets up assistants, edits prompts, reviews analytics). Workflows pulls in four net-new personas:

| Persona | Why they show up | What they own | Anchor use case |
|---|---|---|---|
| Frontline Employee | They need to *request* something — shift, supply, time off, help. Today they DM a manager. | Their own submissions, status, history. | Shift swap, equipment request, anonymous concern |
| Frontline Manager | They sit in 50+ Slack DMs a day approving asks. Task Inbox replaces the chaos. | Approving / declining their team's requests. | Shift swap approval, equipment approval |
| HR Manager / HR Ops | They want a clean record of every people-related ask. Today it's email + spreadsheet. | The Submissions Dashboard for HR-routed workflows. | Internal mobility interest, anonymous concern, leave requests |
| Ops / Facilities Lead | They get pinged for broken-thing-at-location-X all day. They want a queue with location + photo + severity. | The Submissions Dashboard for ops-routed workflows. | Equipment, maintenance, supply requests |

These four personas multiply Navigator MAU at roughly 5–20× per customer. None of them are touched by today's communicator-centric setup.

---

## The 5 anchor use cases — end-to-end flows

Each one is implemented in the prototype seed and runs end-to-end across **Employee chat → Form → Workflow routing → Manager/HR Task Inbox → Resolution → Dashboard tile.** Each is demoable in ≤90 seconds.

### 1. Shift Swap Request
- **Persona:** Frontline Employee → Frontline Manager
- **Anchor customers:** Vet Partners (clinic shifts), DHL (depot shifts), retail
- **Employee experience:** "I need to swap my Friday closing shift." Navigator picks intent, opens a form (date, reason, suggested replacement from team list), submits.
- **Routing:** Manager receives task in inbox with employee context, shift detail, suggested swap. Approves / declines / proposes alt.
- **Outcome:** Employee notified. Schedule note posted to team channel. Row in HR dashboard tagged with cycle time.
- **Why it lands:** Schedule pain is THE frontline pain point. Currently lives in Slack DMs and personal favors.

### 2. Safety / Incident Report
- **Persona:** Frontline Employee → Safety Officer / HR
- **Anchor customers:** Vet Partners (animal handling injuries — legally mandated logging), DHL (warehouse safety), manufacturing
- **Employee experience:** "I want to report a workplace incident." Form with: location, time, severity (red/amber/green), description, optional photo.
- **Routing:** Safety officer + HR get task. Red severity also posts to a #safety-now channel.
- **Outcome:** Logged with audit trail, compliance dashboard tile, monthly export for OSHA / equivalent.
- **Why it lands:** Replaces paper and Slack DMs with auditable record. Compliance value is the sell.

### 3. Equipment / Supply Request
- **Persona:** Frontline Employee → Ops / Facilities Manager
- **Anchor customers:** Universal frontline — Vet Partners, DHL, retail, hospitality
- **Employee experience:** "I need new safety boots size 10." Form: item, size, urgency (today/this week/whenever), location.
- **Routing:** Ops manager for that location gets task. Approves → triggers existing PO process or simply tracks fulfillment.
- **Outcome:** Tracked from request → approved → fulfilled. Dashboard shows supply-request trends by item, location, fulfillment time.
- **Why it lands:** Currently lives in Slack DMs, paper, or expensive add-on integrations.

### 4. Internal Mobility / Role Interest
- **Persona:** Any Employee → HR Manager
- **Anchor customers:** Mid-large enterprise (DHL, VOICES-scale retail)
- **Employee experience:** "What roles are open here?" Navigator surfaces internal openings. "I'm interested in Warehouse Manager." Form: motivation, relevant background, current manager (auto-filled).
- **Routing:** HR receives candidate signal. Optional: notify current manager only with consent.
- **Outcome:** HR sees a pool of internal interest before the role even posts externally. Retention metric.
- **Why it lands:** ATSes are slow and over-engineered for "express interest." This is the early funnel.

### 5. Anonymous Speak-Up / Concern
- **Persona:** Any Employee → HR / Compliance contact
- **Anchor customers:** EU customers under whistleblower directive (DHL, regulated industries)
- **Employee experience:** "I want to raise a concern anonymously." Form is identity-stripped: category (harassment, safety, ethics, other), description, optional contact-back channel.
- **Routing:** Designated HR/Compliance contact only. Acknowledgment goes back via Navigator if the employee opted to be contactable.
- **Outcome:** Logged with cryptographic separation of identity from content. Dashboard for HR with category trends, no PII.
- **Why it lands:** Replaces NAVEX EthicsPoint at lower cost. Regulatory requirement in EU.

---

## Positioning vs Copilot Studio (the elevator answer)

> **Copilot Studio** is a flow-building IDE for technical owners. It assumes you have engineering time, an integration plan, and a backlog of automation.
>
> **Navigator Workflows** is for the HR manager or operations lead who needs to capture and route 80% of the recurring asks they already get — today, without IT — and have the data show up in a dashboard they can act on. It is native to the intranet your people already open every day.
>
> If you have a single workflow that runs across Salesforce, ServiceNow, and SAP — buy Copilot Studio. If you have ten workflows that run inside your company between your people, ship them in Navigator this afternoon.

---

## Build scope (what the prototype seed encodes)

The prototype at `src/prototypes/NavigatorWorkflows/` is the opinionated reference. It encodes the following decisions, consistent with the [[hackathon-locked-decisions]]:

1. **`forms`, `workflows`, `submissions`, `tasks` are new top-level objects** in the workspace config. Stored as JSONB extensions to `navigator_config`, with the same revision-CAS semantics.
2. **Forms are JSON-schema-shaped** but with a Navigator-flavored extension: each field has `label`, `type`, `required`, `helpText`, `aiHint` (used by chat to ask for it conversationally).
3. **Workflows are deterministic** — `on: form_submitted` triggers, `then: [task.create, channel.post, dashboard.tile]` actions. No LLM at runtime, same as the existing flow runtime. AI is used at authoring time to draft them.
4. **Tasks have one assignee resolved at run time** (by role / group / manager-of-submitter). No multi-approver chains in v1.
5. **The Task Inbox is the new home tab** for non-communicator personas. Communicators keep today's Studio home; managers see Inbox first.
6. **Personas drive the landing view, not feature flags.** "View as" persona switcher (Frontline Employee, Frontline Manager, HR Manager, Ops Manager) shows the same data, different surface.
7. **5 templates ship as seed data** so the prototype loads with the demos ready to go. Customers can clone + edit.
8. **No new infrastructure.** Same Postgres, same Vercel functions, same Vite frontend. Same one-LLM-provider rule.

The prototype is registered in `src/App.jsx` `PROTOTYPES` as the third top-level card.

---

## Risks + open questions

- **Terminology overload.** "Workflows" already exists in the codebase as the renamed `flows` (assistant trigger automations). Resolution: in code, the new objects are `forms`, `taskWorkflows`, `submissions`, `tasks`. In customer-facing surfaces, "Workflow" is the new thing; the existing internal "flow" is invisible to admins (it's the runtime).
- **Bet count.** Going from 7 to 8 immediately after Martin approved 7 looks like roadmap drift. Mitigation: frame as a **scope sharpening of Bet 02 + Bet 06** if we get pushback, with Workflows as the user-facing name. Internal naming can stay `Bet 08` for tracking.
- **Salesforce / IT pushback.** "This is shadow IT." Counter: every workflow is in Studio, owner-controlled, with audit log. Same posture as ServiceNow's "Now Assist" for frontline.
- **Customer expectation creep.** First demo creates demand for branching, multi-approver, webhooks. We need a public "what's not in v1" line that survives sales calls.
- **Eval.** No ground truth for "did the workflow route correctly." Resolution: workflows are deterministic, so eval = unit test on rule firing, not LLM-as-judge. Cleaner than the [[evaluation-problem]] we have for chat.

---

## Recommended next steps

1. **Demo the prototype seed to Bijal + Marko + Jasmina.** Get the GTM read on the 5 anchor use cases.
2. **DHL roadmap call 2026-05-27** — show Use Case 2 (Safety Report) and Use Case 3 (Equipment Request) as the lead. Max Kersting is the right audience for this framing.
3. **Vet Partners check-in** (Amanda France) — show Use Case 1 (Shift Swap) and Use Case 2 (Safety Report). Vet practice safety is a real legal driver.
4. **Decide bet count.** Either Martin agrees this is bet 08, or we frame internally as "Bet 02 expansion" and use "Navigator Workflows" only as the customer-facing name.
5. **PRD shape.** Draft PRD in AW Confluence linking back to this doc and the prototype Confluence page. Same structure as the other Bet PRDs ([[prd-format]]).
6. **Resource ask.** This is roughly half an additional eng track for two quarters. Decide if it comes out of Bet 02 Assistants 2.0 timeline or net-new headcount.

---

## Appendix — Mapping to the existing 5 pillars

| Pillar | Workflows touches it how |
|---|---|
| 1 — Knowledge & Answers (RAG) | Light. Workflows may reference KB articles in form help text. |
| 2 — Actions & Integrations | Heavy. Workflows are the new internal action type. Reuses Tier model. |
| 3 — Agent Intelligence | Light. Intent classifier learns workflow triggers; same routing as today. |
| 4 — Employee Experience | Heavy. Forms in chat, Task Inbox is a new home surface for managers. |
| 5 — Admin & Studio | Heavy. Form Builder + Workflow Editor + Submissions Dashboard are net-new Studio tabs. |
