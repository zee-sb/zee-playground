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

## Section B — The Stickiness Engine framework (top-left, large)

A 2×2 (NOT a funnel) — these are *loop phases*, not a sequence. People can vote that one idea sits in two phases.

Use four large colored frames, one per phase. Brand-adjacent palette so phases are distinguishable but not loud.

```
┌─────────────────────────────┬─────────────────────────────┐
│                             │                             │
│   TRIGGER                   │   DELIVER                   │
│   "Why open it today?"      │   "Does it work?"           │
│   color: #FFE08A (warm)     │   color: #A7D8FF (cool)     │
│                             │                             │
├─────────────────────────────┼─────────────────────────────┤
│                             │                             │
│   INVEST                    │   REWARD                    │
│   "Does it learn me?"       │   "Was that worth it?"      │
│   color: #C8E6C9 (green)    │   color: #F5C2C7 (rose)     │
│                             │                             │
└─────────────────────────────┴─────────────────────────────┘
```

In each frame, add a header text block:

### TRIGGER — "Why would an employee open Navigator *today*?"
Sub-prompts (small text under header):
- Conversation Starters (targeted, fresh, group-aware)
- Entry points (chat icon, mobile, contextual prompts in pages/posts)
- Push moments (digests, "your team just published…", manager nudges)
- Discoverability inside the intranet (search, navbar, hero)

### DELIVER — "Did it actually answer my question?"
- Retrieval accuracy & permission correctness
- Source delivery (clickable, files, PDFs)
- Format coverage (.docx, .pptx, .xlsx, SharePoint, OrgChart, Profile Widgets)
- Language handling (per-message detection, override)
- Latency / streaming / mobile parity
- Eval gating + ground-truth metrics

### REWARD — "Did it feel worth the 30 seconds?"
- Answer feel: right length, no contradictions, no hallucinated emails
- Actions: ServiceNow forms, address-change, escalate-to-HR, write-back
- Follow-ups: clarification · next_action · related-question chips
- Personality, tone, branding, slogan, customizable text
- "It got smarter mid-answer" experience

### INVEST — "Does using it make next time better?"
- Memory: account-wide vs. individual (open VOICES question)
- Conversation continuity & history (in flight)
- My pinned assistants / learned preferences
- Personalization placeholders that actually work
- **Admin-side investment:** Activation Concierge, analytics, admin-visible feedback, audit tools
- Network effects: more sources connected → more value

### Wildcards lane (skinny column to the right of REWARD)
- Anything that doesn't fit. Don't force-fit. We'll triage in clustering.

---

## Section C — Idea capture (under each frame)

For each of the four frames, leave a **drop zone** sized for ~25 sticky notes per phase. Use sticky color = same as the frame color so people stay in the right zone.

**Sticky template** — share this as a "starter sticky" inside each frame:

```
[ONE-LINE IDEA]

Customer signal:  Slack ts / customer name / "gut"
Metric it moves:  MAU / repeat use / resolution / activation
Effort guess:     S / M / L / XL
Author:           @initials
```

Don't enforce the template hard — people who just want to drop a verb-phrase can.

---

## Section D — Seeded customer signals strip (bottom-left)

A horizontal "feedback gallery" — pre-populate these so the team starts grounded. Each is a small dark-gray sticky with customer + one-liner. People can drag these into the bucket where they apply.

| Sticky | Customer | One-liner | Likely bucket |
|---|---|---|---|
| #1 | Camion | "Very disappointing — wrong HR email, contradictory replies, can't trigger forms" | Deliver + Reward |
| #2 | Getinge | "Source links not delivered on first run, files not clickable" | Deliver |
| #3 | Heraeus | "Permission visibility leaks — content surfaced to users without access" | Deliver |
| #4 | Seeburger | "Source management UX is awful · OrgChart/Profile Widgets not read · targeted starters · placeholders · 50-char slogan" | Trigger + Deliver + Invest |
| #5 | EBZ Gruppe | "SharePoint links missing · personalization placeholders broken" | Trigger + Deliver |
| #6 | Morley | "Can't customize 'Ask AI anything' text · PDFs not clickable" | Trigger + Reward |
| #7 | Lindner | "Mobile-only activation requested" | Trigger |
| #8 | VOICES (Steven) | "Public stress tests — prompt workarounds because system isn't responding to intent" | Reward + Invest |
| #9 | VOICES (Jasmina→Zee) | "Open: account-wide vs. individual memory model" | Invest |
| #10 | ISTA / LSG / LyricHealth / DesertDiamond / VWSK | "Activated with no enablement — what do we do now?" | Invest (Activation Concierge) |
| #11 | Stadtwerke München | "Copilot Agent / M365 interface story unclear" | Reward + GTM |
| #12 | Max Scholz | "Admins can't see 'Report issue' feedback anywhere" | Invest (admin) |
| #13 | Laura Turner | "Language drifts to Spanish unprompted · sub-assistant flag inconsistent" | Deliver |
| #14 | BASF EC / Sunidhi | ".docx / .pptx / .xlsx / external URLs not supported" | Deliver |
| #15 | Jon Lam | "What sets us apart from Copilot? (sales positioning)" | GTM wildcard |

---

## Section E — Current roadmap (top-right)

A small panel listing the **4 current bets** as cards. Each bet has:
- Title + status (Discovery / In flight)
- Which Stickiness Engine phase it primarily serves
- A "Confirm / Expand / Shrink / Drop" voting strip (4 dot slots)

| Bet | Phase | Default |
|---|---|---|
| Navigator 2.0 — architectural rebuild | Deliver (with Reward and Invest spillovers) | Confirm |
| Activation Concierge | Invest (admin) → Trigger flow-on | Confirm |
| MCP + A2A with Identity & Delegation | Reward (more it can do) | Confirm |
| Analytics + Logs depth | Invest (admin) | Confirm |

Plus a card for **"What we're NOT doing"** (the deferred list from the roadmap) so the team can pull any of them onto the board with "I think we should re-litigate this." Items:
- Voice/Audio improvements (won't do)
- Self-serve activation (Search dependency)
- Intent-based routing (Q4+)
- Proactive push (Q4)
- Agent marketplace (Q4+)
- Permission/visibility (Search team owns)

---

## Section F — Clustering zone (middle, large empty frame)

Big titled frame: **"Themes"**. After divergent ideation, ideas get dragged here and grouped. Each cluster gets a label sticky (red, bold) — that's the candidate "theme" name. Examples of themes that might emerge:

- "Make starters do work" (targeted, personalized, fresh)
- "Source delivery has to be invariant" (links, files, PDFs always work)
- "Knowledge connectors beyond PDF" (SharePoint, .docx, OrgChart)
- "Activation Concierge — wider than we scoped"
- "Memory model decision"
- "Admin sees what's working"

---

## Section G — Bet shaping zone (middle-right)

Once themes are voted on, the top 5-6 themes graduate into a **Bet Card**. Provide a template Miro shape:

```
╭──────────────────────────────────────╮
│ BET: <name>                          │
│                                      │
│ Hypothesis: If we ___ then ___        │
│                                       │
│ Stickiness phase: T / D / R / I       │
│                                       │
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
> 2. Drop **at least 2 ideas in each of the 4 buckets** by 9am Wednesday.
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
