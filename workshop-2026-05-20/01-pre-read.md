# Navigator Roadmap Workshop — Pre-read

**When:** Wed 2026-05-20, morning · half-day · 9 people
**Facilitator:** Zee
**Goal:** Reshape the Navigator roadmap (Q3 2026 → end of year) so it measurably moves **AI MAU** and **stickiness** for our customers' employees.

> Please skim this before tomorrow. ~12 min read. Show up with one or two ideas per column already in mind — we'll capture them on the Miro board first thing.

---

## 1. The one thing we have to do

Get our customers' employees to **come back** to Navigator. Not "see it once during onboarding." Not "use it when their CSM nudges them." **Come back next week, unprompted.**

Today: **0.04% AI MAU at GA** (58 of 131k employees with access used Navigator in a month). End of Q3 target: **>5% MAU**, 25 actively-engaged branches.

We won't get there by shipping more features. We get there by being honest about **who has to win for MAU to move** — the employees who need a reason to come back, the customers/admins who have to deploy it well, and us (Staffbase) who need the scalability, evaluation, and positioning to keep it going. That's the framework on the next page.

---

## 2. The framework we'll use — three audiences, one north star

Every idea on the board goes in the column for **whoever it most directly helps**. Three columns:

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│     STAFFBASE        │      CUSTOMER        │      EMPLOYEE        │
│       (us)           │  (admins · IT · CSM) │     (end user)       │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Scalability          │ Activation confid.   │ Right answer         │
│ Infra cost           │ Admin trust          │ Source delivery      │
│ Eval gates           │ Audit visibility     │ Latency              │
│ Time-to-onboard      │ Branding control     │ Personalization      │
│ GTM velocity         │ CSM efficiency       │ Reason to come back  │
│ Differentiation      │ Configuration UX     │ Memory & continuity  │
└──────────────────────┴──────────────────────┴──────────────────────┘

              ▲                  ▲                  ▲
              │                  │                  │
              └─── North star: AI MAU ──────────────┘
```

| Column | Whose pain | The question to ask of every idea |
|---|---|---|
| **Staffbase** | Us. Engineering, infra, GTM, leadership. | "Does this let us serve more customers without more cost, ship faster, gate quality, or open new markets?" |
| **Customer** | The admins, IT, and CSMs paying for and running Navigator. | "Does this let the admin trust what's happening, see what's configured, fix what's broken, and onboard their employees without us?" |
| **Employee** | The end user we want coming back. The MAU number. | "Does this give the employee a real reason to come back next week — a better answer, a faster path, something the system learned about them?" |

An idea can hit more than one column. Put it in the column where it has the **biggest first-order impact** and note the spillovers on the sticky.

Why three audience columns and not problem-area buckets (Reliability / Adoption / Quality / UX)? Because every team member can immediately point to which audience they spend their day building for — but "is this a Quality issue or a UX issue?" is a debate that eats half the workshop. Scalability has a home (Staffbase). Activation Concierge has a home (Customer). Memory has a home (Employee). Nothing falls off the board.

**The north star above all three columns is AI MAU.** Every bet that leaves the workshop needs a credible story for how it eventually moves MAU — directly (Employee column), through enablement (Customer column), or by unblocking capacity to do more of it (Staffbase column). If a bet can't tell that story, it gets parked.

---

## 3. State of the world — what we already know

### What we're hearing (last 2 weeks in `#feedback-navigator`), clustered by audience

**Staffbase pain** (us — engineering, infra, GTM)
- Demos are unreliable on production (Maximus "thinking >1 minute," broken sources on Voices demo) — every customer call is a coin-flip
- We have a 70+ activation backlog and no scalable way to drain it
- Resolution-rate numbers are LLM-as-judge → we can't make confident decisions about prompt/model/retrieval changes
- Sales positioning vs. Copilot/M365 not crisp (Jon Lam, Stadtwerke München) — we lose deals we shouldn't
- Voice Live transport adds infra cost for declining customer value

**Customer pain** (admins, IT, CSMs)
- "Activated with no enablement — what do we do now?" (ISTA, LSG, LyricHealth, DesertDiamond, VWSK)
- Source-management UX in Studio is "awful, impossible to get an overview" (Seeburger)
- Branding capped — slogan 50 chars, "Ask the AI..." not customizable (Seeburger, Morley)
- "Report issue" feedback collected but admins can't see it anywhere (Max Scholz)
- No way to know what's working in their tenant — flying blind on whether deployment succeeded
- Configuration shadow: customers conclude Navigator is broken when it's actually unconfigured (Camion: "very disappointing")

**Employee pain** (end users)
- Wrong answers — wrong HR email, wrong "Head of Logistics" (Camion)
- Source links and PDFs not delivered or not clickable (Getinge, EBZ, Morley, Laura)
- File formats limited to PDF; .docx, .pptx, .xlsx, SharePoint, external URLs blocked (BASF EC, EBZ, Sunidhi)
- OrgChart / Profile Widgets / Employee Directory not read as sources (Seeburger)
- Permission leaks — content surfaced to users who shouldn't see it (Heraeus, Fox) — Search-team-owned but it lands on our credibility
- Language drifts (Laura — English-configured, answering Spanish unprompted)
- Sessions lost on source clicks — our #1 employee blocker, already in flight as Conversation Continuity
- Conversation Starters can't be targeted by group/location (Seeburger — cantine-in-HQ-only example)
- Personalization placeholders broken (`{{user.profile.firstName}}` — EBZ, Seeburger)
- No way for the employee to act, only read — "AI says contact HR by email" instead of pointing to a form (Camion address-change example)
- Open: account-wide vs. individual memory model (VOICES Jasmina→Zee thread)

These three columns are the seeds. Bring them on stickies tomorrow; we'll arrange them on the board first thing.

### What's already on the roadmap (May 11 draft — what we're reshaping)

Four bets currently sitting in the Q2–Q3 draft. Tomorrow we'll either confirm, expand, replace, or shrink each one.

1. **Navigator 2.0 — architectural rebuild** (Q2–Q3, in flight) — speed contract, structured response envelope, eval-gated changes. Absorbs Conversation Continuity, follow-ups, language handling, voice retire, multi-agent GA. *Primary audience: Employee (better answers, faster, more reliable) — with big Staffbase spillover (eval gates, infra cost).*
2. **Activation Concierge** (Q3, discovery) — Studio does the setup for them. Onboarding wizard + audit + CSM tab. *Primary audience: Customer (admin trust, configuration confidence) — with Staffbase spillover (drain activation backlog).*
3. **MCP + A2A with Identity & Delegation** (Q2–Q3, in flight) — be the front door to all customer AI (Copilot, Gemini, Workday, ServiceNow), handed off as the real user. *Primary audience: Employee (more the assistant can actually do) — with Staffbase spillover (differentiation vs. Copilot).*
4. **Analytics + Logs depth** (Q2, in flight) — resolution state on every conversation, dashboards. *Primary audience: Customer (admins finally see what's working) — with Staffbase spillover (we get real metrics to make decisions on).*

### What we're NOT doing right now (and why) — be ready to challenge
- Voice / Audio improvements (won't do)
- Permission leaks (Search team)
- Self-serve activation (Search dependency)
- Intent-based routing (Q4+, needs production data)
- Proactive push (Q4, needs action infra first)
- Agent marketplace (Q4+, needs MCP maturity)

If one of these is the unlock for MAU — directly or through the Customer or Staffbase columns — we should re-litigate it tomorrow. Bring receipts.

### The metric problem we can't pretend isn't there
Our resolution-rate numbers are LLM-as-judge today (Langfuse). That means **every quality claim we make right now is structurally unreliable**. AIW-348 is the path to ground truth (human annotation → trained eval model → automated scoring → measurement framework). When we propose new work tomorrow, prefer metrics that don't depend on LLM-judging-LLM: **conversation recovery rate, repeat-use rate, branch activation count, MAU.**

---

## 4. What drives MAU in AI products — patterns to bring into the room

Four patterns from Reforge / Lenny / Mixpanel on AI-product stickiness. Useful when shaping Employee-column bets, but each one also has a Customer or Staffbase counterpart:

- **Activation → Retention lift:** % of users who complete a *first valuable AI output* and return within 7 days is the strongest leading indicator of long-term retention. For us: "first answered question with a clicked source within 7 days of activation." Direct Employee impact; the Customer-side version is Activation Concierge making sure that first answer is actually good.
- **Fresh surfaces:** give people a reason to open it today that wasn't there yesterday (Spotify Daily Mix). For Navigator: contextual starters tied to fresh intranet content, weekly digests, "what changed in your space" prompts.
- **Investment loops:** the system gets noticeably better the more you use it — memory, learned preferences, "your" follow-ups. The investment is what creates switching cost (Employee column) — and it's also how Staffbase becomes hard to rip out at the contract level.
- **The funnel narrows hard at each step:** consumer AI products see step-changes in dropoff between "tried it once," "used it this week," and "used it this month." Enterprise is harder; in our context the bottleneck is almost always *trigger* (no reason to come back), not *interest* (people who try it like it well enough). That's why Customer-column work (admins configuring starters, deploying broadly) probably moves MAU more than another Employee-side feature in the short term.

---

## 5. What you're walking into tomorrow

**Format:** Miro board, three audience columns (Staffbase / Customer / Employee), plus a "wildcards" lane. Half-day, 3.5 hours:
1. Frame the goal (10 min)
2. State of the world walkthrough (15 min)
3. Silent ideation + post + walk-the-wall (50 min)
4. Break (10 min)
5. Clustering + dot-vote (30 min)
6. Shape top themes into bet hypotheses (40 min)
7. Prioritize on impact × effort × confidence (30 min)
8. Commitments & owners (25 min)

**Your homework before walking in:**
- Open the Miro board (link in the calendar invite — going out today)
- Drop at least **two ideas in each column** before tomorrow morning — Staffbase, Customer, Employee. Stale, half-formed, "obvious" — all welcome. Quantity wins; we'll prune in the room.
- Read this pre-read.
- Bring one "we should kill this" — a thing currently on the roadmap that you think doesn't earn its slot.

**The decision we have to leave the room with:**
A reshaped roadmap with **3–5 bets** for the rest of 2026, each one anchored to its primary audience (Staffbase / Customer / Employee), the metric it moves, and the MAU story it carries.

See you tomorrow.

— Zee
