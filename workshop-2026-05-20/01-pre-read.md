# Navigator Roadmap Workshop — Pre-read

**When:** Wed 2026-05-20, morning · half-day · 9 people
**Facilitator:** Zee
**Goal:** Reshape the Navigator roadmap (Q3 2026 → end of year) so it measurably moves **AI MAU** and **stickiness** for our customers' employees.

> Please skim this before tomorrow. ~12 min read. Show up with one or two ideas per bucket already in mind — we'll capture them on the Miro board first thing.

---

## 1. The one thing we have to do

Get our customers' employees to **come back** to Navigator. Not "see it once during onboarding." Not "use it when their CSM nudges them." **Come back next week, unprompted.**

Today: **0.04% AI MAU at GA** (58 of 131k employees with access used Navigator in a month). End of Q3 target: **>5% MAU**, 25 actively-engaged branches.

We won't get there by shipping more features. We get there by closing the **stickiness loop**: every time an employee uses Navigator, the next visit becomes more likely.

---

## 2. The framework we'll use — the Stickiness Engine

We'll bucket every idea into one of four loop phases. The buckets are deliberately not the 5 pillars (Knowledge / Actions / Brain / Experience / Admin) — those describe *what we build*, not *what makes employees come back*. The Stickiness Engine describes the latter.

```
       ┌───────────────────────────────────────────────┐
       │                                               │
       │  ╭──────────╮      ╭──────────╮               │
       │  │ TRIGGER  │ ───▶ │ DELIVER  │               │
       │  ╰──────────╯      ╰──────────╯               │
       │       ▲                 │                     │
       │       │                 ▼                     │
       │  ╭──────────╮      ╭──────────╮               │
       │  │ INVEST   │ ◀─── │ REWARD   │               │
       │  ╰──────────╯      ╰──────────╯               │
       │                                               │
       └───────────────────────────────────────────────┘
```

| Phase | The question for the employee | What it usually requires |
|---|---|---|
| **Trigger** | "Why would I open Navigator *today*?" | Conversation starters, entry points, push moments, mobile reach, contextual prompts in pages/posts, manager nudges, weekly digests |
| **Deliver** | "Did it actually answer my question?" | Retrieval quality, source accuracy, permission correctness, language handling, latency, supported file formats, SharePoint/OrgChart sources, mobile parity |
| **Reward** | "Did it feel worth the 30 seconds?" | Right-length answers, clickable sources, ServiceNow form actions, follow-up suggestions, multi-language, the *feel* of an answer (no contradictions, no hallucinated emails) |
| **Invest** | "Did using it make next time better?" | Memory, conversation continuity, learned preferences, personalization placeholders, my history, my knowledge sources, *my* assistant — and on the admin side: Activation Concierge, analytics that show what's working |

A feature can sit in multiple phases. That's fine — on Miro we'll dot-vote each idea by the phase where it has the biggest *unblocking* effect.

This framework is borrowed/blended from Nir Eyal's Hook Model (Trigger → Action → Reward → Investment) and Reforge's growth-loop thinking, then bent to our reality: enterprise, employees-not-consumers, and the painful fact that we have a configuration problem more than an interest problem.

---

## 3. State of the world — what we already know

### What employees and admins are telling us (last 2 weeks in `#feedback-navigator`)

Clustered into the four phases — these are the seeds for tomorrow:

**Trigger gaps** (why don't employees come *back*?)
- Conversation Starters can't be targeted by group/location (Seeburger — cantine-in-HQ-only example)
- Mobile-only activation requested (Lindner)
- Branding/slogan capped at 50 chars, "Ask the AI..." not customizable (Seeburger, Morley)
- Personalization placeholders (`{{user.profile.firstName}}`) don't work in starters (EBZ, Seeburger)

**Deliver gaps** (does it work when they try it?)
- Source links broken or not delivered on first run (Getinge, Laura/Voices demo, EBZ, Morley)
- PDFs not clickable (Morley)
- Wrong info returned: wrong HR email, wrong "Head of Logistics" (Camion)
- File formats: only PDF supported — .docx, .pptx, .xlsx, SharePoint pages, external URLs blocked (BASF EC, EBZ, Sunidhi)
- User Profile Widgets / OrgChart / Employee Directory not read as sources (Seeburger)
- Permission/visibility leaks — content returned to users who shouldn't see it (Heraeus, Fox) — owned by Search team but it lands on us
- Language: English-configured, answering in Spanish unprompted (Laura)
- Latency: "thinking for >1 minute" during a demo (Maximus)

**Reward gaps** (does the answer feel good?)
- Answers too long even when set to "short" (Camion)
- Contradictory replies — "I can do that… actually I can't" (Camion)
- Knowledge-source management UX: "awful, impossible to get an overview" (Seeburger)
- No way to point a user at a form to *do* something instead of read about it (Camion: address change)
- "Report issue" feedback — admins can't see it anywhere (Max Scholz)

**Invest gaps** (does it remember anything?)
- Sessions lost on source/nav clicks — already our #1 blocker, in flight as Conversation Continuity
- Account-wide vs. individual memory model — open question from VOICES (Jasmina → Zee thread)
- Knowledge segmentation by user group requested repeatedly

**Configuration shadow** — the loud one
- Customers conclude Navigator is broken when it's actually unconfigured. Camion: "very disappointing." ISTA: "we need detailed support documentation, where is it?" LSG/LyricHealth/DesertDiamond/VWSK: "we just got activated, what do we do now?"
- This is why **Activation Concierge** is on the candidate list — and the workshop should decide how big a bet it really is.

### What's already on the roadmap (May 11 draft — what we're reshaping)

Four bets currently sitting in the Q2–Q3 draft. Tomorrow we'll either confirm, expand, replace, or shrink each one.

1. **Navigator 2.0 — architectural rebuild** (Q2–Q3, in flight) — speed contract, structured response envelope, eval-gated changes. Absorbs Conversation Continuity, follow-ups, language handling, voice retire, multi-agent GA. *Most of the "Deliver" bucket lives here.*
2. **Activation Concierge** (Q3, discovery) — Studio does the setup for them. Onboarding wizard + audit + CSM tab. *Bucket: Invest (admin-side) and Trigger.*
3. **MCP + A2A with Identity & Delegation** (Q2–Q3, in flight) — be the front door to all customer AI (Copilot, Gemini, Workday, ServiceNow), handed off as the real user. *Bucket: Reward (more it can actually do).*
4. **Analytics + Logs depth** (Q2, in flight) — resolution state on every conversation, dashboards. *Bucket: Invest (admin-side).*

### What we're NOT doing right now (and why) — be ready to challenge
- Voice / Audio improvements (won't do)
- Permission leaks (Search team)
- Self-serve activation (Search dependency)
- Intent-based routing (Q4+, needs production data)
- Proactive push (Q4, needs action infra first)
- Agent marketplace (Q4+, needs MCP maturity)

If one of these is the unlock for stickiness, we should re-litigate it tomorrow — bring receipts.

### The metric problem we can't pretend isn't there
Our resolution-rate numbers are LLM-as-judge today (Langfuse). That means **every quality claim we make right now is structurally unreliable**. AIW-348 is the path to ground truth (human annotation → trained eval model → automated scoring → measurement framework). When we propose new work tomorrow, prefer metrics that don't depend on LLM-judging-LLM: **conversation recovery rate, repeat-use rate, branch activation count, MAU.**

---

## 4. Stickiness in AI products — what works elsewhere

A few patterns from Reforge / Lenny / Mixpanel writing on AI-product stickiness that we should bring into the room:

- **Activation → Retention lift:** % of users who complete a *first valuable AI output* and return within 7 days is the strongest leading indicator of long-term retention. For us, the equivalent is "first answered question with a clicked source within 7 days of activation."
- **Fresh-content surfaces** (Spotify Daily Mix model): give people a reason to open the app today that wasn't there yesterday. For Navigator: contextual starters tied to fresh intranet content, weekly digests, "what changed in your space" prompts.
- **Variable reward + investment loops:** the system gets noticeably better the more you use it — memory, learned preferences, "your" follow-ups. The investment is what creates switching cost.
- **The funnel narrows hard at each step:** consumer AI products see step-changes in dropoff between "tried it once," "used it this week," and "used it this month." Enterprise tools are harder than consumer; in our context the bottleneck is almost always *trigger* (no reason to come back), not *interest* (the people who tried it like it well enough).

---

## 5. What you're walking into tomorrow

**Format:** Miro board, four buckets (Trigger / Deliver / Reward / Invest), plus a "wildcards" lane. Half-day, 3.5 hours:
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
- Drop at least **two ideas in each bucket** before tomorrow morning. Stale, half-formed, "obvious" — all welcome. Quantity wins; we'll prune in the room.
- Read this pre-read.
- Bring one "we should kill this" — a thing currently on the roadmap that you think doesn't earn its slot.

**The decision we have to leave the room with:**
A reshaped roadmap with **3–5 bets** for the rest of 2026, each one anchored to which phase of the Stickiness Engine it unblocks and what metric we'll watch.

See you tomorrow.

— Zee
