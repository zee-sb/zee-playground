# Miro Board — Build Spec

A step-by-step layout so you can rebuild this in Miro in ~20 min. The board is structured **left-to-right by workshop phase** so people read it like a timeline. Async pre-fill happens on the right half; convergent work moves leftward as the workshop progresses.

> Board title: **Navigator Roadmap Workshop · 2026-05-20**
> Share link: editor access for the 9 team members, view-only for stakeholders.

---

## Section A — Welcome strip (top, full width)

A horizontal strip across the top of the board. Pinned, not movable.

- **Big text:** "Navigator Roadmap Reshape · May 20, 2026"
- **Subtitle:** "Goal: ship the things that move AI MAU and add stickiness."
- **Three KPI tiles** (use Miro shape rectangles, brand color `#00C7B2`):
  - `Today: 0.04% MAU` (58 of 131k)
  - `Q3 target: >5% MAU`
  - `Q3 target: 25 active branches`
- **House rules** (sticky cluster, gray):
  - Quantity > quality in divergent rounds
  - No criticism in the first hour
  - Anchor every idea to a customer signal or a metric
  - Honest skepticism is gold in the convergent rounds

---

## Section B — The framework: three audiences, one north star (top-left, large)

Three large colored columns side-by-side. Above all three, a single banner: **"North star: AI MAU."** The point is that every column is a *path to MAU*, just through a different audience.

```
┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│                          │                          │                          │
│      STAFFBASE           │       CUSTOMER           │       EMPLOYEE           │
│      (us)                │  (admins · IT · CSM)     │      (end user)          │
│                          │                          │                          │
│  color: #B8C5FF (indigo) │  color: #FFD9A6 (amber)  │  color: #A8E6C9 (mint)   │
│                          │                          │                          │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘

       ▲ scales us up           ▲ enables them            ▲ pulls them back

                  ───── North star above all three: AI MAU ─────
```

In each frame, add a header text block plus sub-prompts:

### STAFFBASE — "Does this scale us up?"
Subtitle: *Our business outcomes. Engineering, infra, GTM, leadership.*

Sub-prompts:
- Scalability — more tenants, more traffic, no linear cost
- Infra cost — Voice Live retirement, model tiering, retrieval cost
- Time-to-onboard a new tenant
- Eval gates / ground-truth metrics so we can ship with confidence
- GTM velocity & sales positioning (vs. Copilot, M365)
- Differentiation & defensibility
- Talent capacity — eng leverage, fewer manual escalations
- Drain the activation backlog (70+ waitlisted customers)

### CUSTOMER — "Does this enable them?"
Subtitle: *The admins, IT teams, and CSMs who run Navigator inside the org.*

Sub-prompts:
- Activation confidence — they know it's working
- Admin trust — they can see what's configured and what's not
- Audit visibility — what employees are asking, what's failing
- Branding & customization — slogan, "Ask AI" text, logos, personalization placeholders
- Configuration UX in Studio — knowledge sources, starters, assistants
- CSM efficiency — fewer firefights per account
- Self-service depth — they can fix things without us
- Activation Concierge (assisted onboarding + audit + CSM tab)

### EMPLOYEE — "Does this pull them back?"
Subtitle: *The end user we're trying to make MAU out of. Office and frontline.*

Sub-prompts:
- Right answer (no wrong HR email, no contradictions, no hallucinations)
- Source delivery — clickable links, PDFs, files actually arrive
- Latency & streaming feel
- Format coverage — .docx, .pptx, .xlsx, SharePoint, OrgChart, Profile Widgets
- Permission correctness — no leaks
- Conversation continuity & history (in flight)
- Memory & personalization — feels like *my* assistant
- Follow-up suggestions, clarifying questions, next-actions
- Reason to come back — targeted starters, fresh content, contextual nudges
- Ability to *do*, not just read — forms, ServiceNow actions, escalate-to-HR

### Wildcards lane (skinny column to the right of EMPLOYEE)
- Anything that doesn't fit any of the three audiences. Don't force-fit. We'll triage in clustering.

---

## Section C — Idea capture (under each column)

For each of the three audience columns, leave a **drop zone** sized for ~30 sticky notes per column. Use sticky color = same as the column color so people stay in the right zone.

**Sticky template** — share this as a "starter sticky" inside each column:

```
[ONE-LINE IDEA]

Customer signal:  Slack ts / customer name / "gut"
MAU story:        direct / via Customer / via Staffbase
Metric it moves:  MAU / repeat use / resolution / activation / cost-to-serve
Effort guess:     S / M / L / XL
Author:           @initials
```

The **MAU story** line is important — it forces "how does this eventually move MAU?" If the answer is "it doesn't, it just makes us feel better," that's information. Don't enforce the template hard — people who just want to drop a verb-phrase can.

---

## Section D — Seeded customer signals strip (bottom-left)

A horizontal "feedback gallery" — pre-populate these so the team starts grounded. Each is a small dark-gray sticky with customer + one-liner. People can drag these into the column where they apply.

| Sticky | Customer / Source | One-liner | Likely column(s) |
|---|---|---|---|
| #1 | Camion | "Very disappointing — wrong HR email, contradictory replies, can't trigger forms" | Employee |
| #2 | Getinge | "Source links not delivered on first run, files not clickable" | Employee |
| #3 | Heraeus | "Permission visibility leaks — content surfaced to users without access" | Employee + Staffbase (credibility risk) |
| #4 | Seeburger | "Source mgmt UX is awful · OrgChart/Profile Widgets not read · targeted starters · placeholders · 50-char slogan" | Customer (admin UX) + Employee |
| #5 | EBZ Gruppe | "SharePoint links missing · personalization placeholders broken" | Customer + Employee |
| #6 | Morley | "Can't customize 'Ask AI anything' text · PDFs not clickable" | Customer + Employee |
| #7 | Lindner | "Mobile-only activation requested" | Customer (deployment control) |
| #8 | VOICES (Steven Stöber) | "Public stress tests — prompt workarounds because system isn't responding to intent" | Employee + Staffbase (positioning risk) |
| #9 | VOICES (Jasmina→Zee) | "Open: account-wide vs. individual memory model" | Employee |
| #10 | ISTA / LSG / LyricHealth / DesertDiamond / VWSK | "Activated with no enablement — what do we do now?" | Customer (Activation Concierge) |
| #11 | Stadtwerke München | "Copilot Agent / M365 interface story unclear" | Staffbase (GTM positioning) |
| #12 | Max Scholz | "Admins can't see 'Report issue' feedback anywhere" | Customer (admin tools) |
| #13 | Laura Turner | "Language drifts to Spanish unprompted · sub-assistant flag inconsistent" | Employee |
| #14 | BASF EC / Sunidhi | ".docx / .pptx / .xlsx / external URLs not supported" | Employee + Customer |
| #15 | Jon Lam | "What sets us apart from Copilot? (sales positioning)" | Staffbase (differentiation) |
| #16 | Activation backlog (Jasmina) | "70+ customers stuck on waitlist, no scalable way to drain" | Staffbase (capacity) + Customer |
| #17 | Internal (Langfuse / AIW-348) | "Resolution rate is LLM-as-judge — every quality claim is structurally unreliable" | Staffbase (eval gates) |

---

## Section E — Current roadmap (top-right)

A small panel listing the **4 current bets** as cards. Each bet has:
- Title + status (Discovery / In flight)
- Primary audience column + spillovers
- A "Confirm / Expand / Shrink / Drop" voting strip (4 dot slots)

| Bet | Primary audience | Spillover | Default |
|---|---|---|---|
| Navigator 2.0 — architectural rebuild | Employee | Staffbase (eval gates, infra cost) | Confirm |
| Activation Concierge | Customer | Staffbase (drain activation backlog) | Confirm |
| MCP + A2A with Identity & Delegation | Employee (more it can do) | Staffbase (differentiation vs. Copilot) | Confirm |
| Analytics + Logs depth | Customer (admins see what's working) | Staffbase (real metrics for decisions) | Confirm |

Plus a card for **"What we're NOT doing"** (the deferred list from the roadmap) so the team can pull any of them onto the board with "I think we should re-litigate this." Items:
- Voice/Audio improvements (won't do)
- Self-serve activation (Search dependency)
- Intent-based routing (Q4+)
- Proactive push (Q4)
- Agent marketplace (Q4+)
- Permission/visibility (Search team owns)

---

## Section F — Clustering zone (middle, large empty frame)

Big titled frame: **"Themes"**. After divergent ideation, ideas get dragged here and grouped. Each cluster gets a label sticky (red, bold) — that's the candidate "theme" name. Examples of themes that might emerge (across all three columns):

- "Make starters do work" (targeted, personalized, fresh — Employee + Customer)
- "Source delivery has to be invariant" (links, files, PDFs always work — Employee)
- "Knowledge connectors beyond PDF" (SharePoint, .docx, OrgChart — Customer + Employee)
- "Activation Concierge — wider than we scoped" (Customer)
- "Memory model decision" (Employee)
- "Admin sees what's working" (Customer)
- "Eval gates everywhere" (Staffbase)
- "Cost-to-serve drops as we scale" (Staffbase — model tiering, voice retire)
- "Beat Copilot on the demo" (Staffbase — positioning + reliability)

---

## Section G — Bet shaping zone (middle-right)

Once themes are voted on, the top 5-6 themes graduate into a **Bet Card**. Provide a template Miro shape:

```
╭──────────────────────────────────────╮
│ BET: <name>                          │
│                                      │
│ Hypothesis: If we ___ then ___        │
│                                       │
│ Primary audience: Staffbase /         │
│                   Customer /          │
│                   Employee            │
│ Spillover audiences:                  │
│                                       │
│ MAU story (how it ladders up):        │
│ Metric we'll watch:                   │
│ Confidence (1-5):                     │
│ Effort (S/M/L/XL):                    │
│ Quarter:                              │
│ Owner candidate:                      │
│ Dependencies:                         │
│ What it replaces / shrinks:           │
╰──────────────────────────────────────╯
```

10-12 of these slots, pre-laid-out.

---

## Section H — Prioritization 2×2 (right side, large)

A standard **Impact × Effort** matrix, but use **Impact = expected MAU lift** specifically (not "general impact"). Add a third dimension via dot color: green = high confidence, yellow = medium, red = low confidence.

```
                  ▲  High MAU lift
                  │
                  │
   ◀──────────────┼──────────────▶
   High effort   │   Low effort
                  │
                  │
                  ▼  Low MAU lift
```

Bet cards from Section G get dragged here. The conversation we want: "this bet is high-confidence and high-MAU-lift — it's a no-brainer; this one is low-confidence — should we scope a spike?"

---

## Section I — Commitments lane (bottom, full width)

Final strip. Three columns:
- **What we're doing** (the 3–5 bets we leave the room with, with owner + quarter)
- **What we're explicitly NOT doing this cycle** (the things we de-prioritized, with the reason)
- **What we'll re-check in 2 weeks** (parking lot)

Plus a sticky labeled **"Decision log"** where Zee captures the moment-of-decision notes during the day.

---

## Async pre-work instructions (text block, top-right above Section E)

> Pre-work before you walk in tomorrow:
>
> 1. Read the pre-read (separate doc, in calendar invite).
> 2. Drop **at least 2 ideas in each of the 3 columns** (Staffbase / Customer / Employee) by 9am Wednesday.
> 3. Drag in 1 customer signal sticky (Section D) that you think is currently under-served.
> 4. Cast a "Confirm / Expand / Shrink / Drop" dot on each of the 4 current bets (Section E).
> 5. Bring **one thing we should kill** — a current roadmap item that doesn't earn its slot.
>
> No pressure on quality. Quantity wins until lunch.

---

## Suggested Miro tooling

- Use **Frames** for each section so they show in the navigator panel on the left.
- Use **Voting** (built-in) for dot-voting clusters in Section F.
- Use **Timer** (built-in) for each exercise — the agenda has timings.
- Lock Section A (welcome strip) and the framework labels in Section B so they don't get accidentally moved.
- Turn on **anonymous mode** for the divergent round (Section C) — important for the more junior team members to feel safe; turn it off again for clustering so authorship is visible.
