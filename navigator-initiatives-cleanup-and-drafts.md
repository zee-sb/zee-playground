# Navigator Initiatives — Annotation Change Set + Draft Bets

**For:** Zee → Jasmina
**Date:** 2026-06-04
**Status:** DRAFT — nothing written to Jira yet.

---

## Approach (per Jasmina, 2026-06-04)

No deletes — every change has to be reportable. So:

- **Repurpose** the ones that still make sense → already done (Assistants 2.0 = PI-304, and the rest of the NAV-BET set).
- **Make new** where needed → covered by the eight NAV-BET initiatives already on the board.
- **Annotate** the outdated ones with a status banner (replaced / delayed / deprioritized / pushed later) **and a link to the successor**. Jasmina handles the board-level reporting from there.
- **Workflows is the only one that's not outdated — just deprioritized.**

The banner goes at the **top** of each initiative's description; the existing body stays untouched underneath.

---

## Scope guard: only annotate *our* initiatives

Five of the stale-looking initiatives are **owned by other teams** and are active work, not outdated — they get **no banner from us**: PI-255 (Search/Valerii), PI-228 (Search/Valerii), PI-227 (MFX/Natalia), PI-234 (IDAM/Aurélien), PI-216 (SRE/Michael). PI-310 (Danilo, knowledge substrate) and PI-236 (memory MVP, in progress) are **kept** — no banner. We touch only what's ours and genuinely superseded.

---

## Group A — ours + clearly superseded → apply banner now

### PI-271 — Navigator Entry Points  → **REPLACED**

```
⚠️ OUTDATED — REPLACED. Superseded by the 4→7 Navigator bet reshape
(approved by Martin, 2026-05-21). The entry-point + news/podcast handover
scope now lives in PI-309 (NAV-BET-07 — Search ⇄ Navigator); the
context-aware "knows which page you're on" scope lives in PI-152
(NAV-BET-01 — Conversation 2.0, §1.6). Kept for reporting history; no
further work tracked here. — noted 2026-06-04
```

### PI-267 — MEMORY + SERVICE / API (MEMORY.MD)  → **PARTIALLY OUTDATED**

```
⚠️ PARTIALLY OUTDATED. The mem0 / supermemory SaaS integration scope is
dropped (Seven Bets kill list, 2026-05-21). The file-based MEMORY.md MVP
continues under PI-236 ([C&C] Employee Context / Memory MVP), which relates
to PI-152 (NAV-BET-01) continuity. This initiative is kept for history and
deduplicated against PI-236. — noted 2026-06-04
```

### PI-275 — Workflows as part of Collections  → **DEPRIORITIZED** (not outdated)

```
⏸️ DEPRIORITIZED / PUSHED LATER. Still valid — not outdated. The no-code
Workflows wedge (forms + inbox, Navigator-driven multi-step automation) is
deprioritized in the current planning cycle and slated to be revisited as a
future bet. No active development this cycle. — noted 2026-06-04
```

---

## Group B — ours-adjacent but owned by others → confirm owner, then apply

These two are the Forms/Springboard half of the Workflows cluster, owned by Inês and Axel. Recommend the banner below, but check with the owner before writing (or have Jasmina include them in her report).

### PI-277 — Springboard agentic interface (Axel)  → **DEPRIORITIZED w/ Workflows**

```
⏸️ DEPRIORITIZED. Part of the Workflows / internal-actions cluster, which is
deprioritized this cycle (see PI-275). Internal Staffbase actions in Navigator
(Forms / Tasks / Surveys) will be revisited alongside Workflows and the
Staffbase MCP surface (PI-308, NAV-BET-06). — noted 2026-06-04
```

### PI-312 — Re-build Forms: Springboard Plugin Framework (Inês)  → **DEPRIORITIZED w/ Workflows**

```
⏸️ DEPRIORITIZED. Tied to the Workflows wedge (PI-275), which is deprioritized
this cycle. Forms rebuild revisited when Workflows is picked back up.
— noted 2026-06-04
```

---

## Group C — leave untouched

| Key | Why no banner |
|-----|----------------|
| PI-310 | Kept — foundational knowledge-substrate R&D (Danilo); relates to BET-07 |
| PI-236 | Kept — memory MVP in progress (David Z.); survivor of the memory dedupe |
| PI-255, PI-228 | Active Search-team work (Valerii); relate to BET-05/07 + BET-03 — owner's call |
| PI-227 | Active MFX work (Natalia); Studio Analytics chatbot |
| PI-234 | Platform/IDAM infra (Aurélien) — not Navigator |
| PI-216 | SRE reliability (Michael) — not Navigator |

Done/closed already (no action): PI-209, 180, 143, 122, 82, 70, 67, 66, 30.

---

## Part 2 — Draft bets (thin → full template)

Full house-template write-ups for the two thin initiatives so all eight read consistently. Drafts only.

### PI-303 — NAV-BET-00 — Navigator Tech Enablement

## Bet 00 — Navigator Tech Enablement (cross-cutting)

**The engineering investment that no single bet owns but every bet depends on.** Voice transport, developer experience, production readiness, model cutover. KTLO with a face.

### Why this initiative

Every other bet assumes a foundation that today is shaky: voice transport breaks on mobile, there's no fast local loop to iterate on a prompt or agent endpoint, the model cutover is unmanaged, and design/product can't explore ideas without a full backend. Tech Enablement pays for that foundation once, centrally, instead of each bet re-solving it badly.

### What it does

* Gives developers a fast local loop to iterate on a prompt or agent endpoint without a full deploy
* Stabilises voice transport (shared with BET-01's push-to-talk retirement of VoiceLive)
* Lets Claude/agents reach Navigator locally to stress-test new functionality before it ships
* Gives design and product a local setup to explore ideas hands-on
* Owns the model cutover (GPT-4.1-mini → GPT-5-mini) so individual bets don't each carry migration risk
* Production-readiness plumbing: observability, eval-harness wiring

### Sub-topics (PRD ↔ Epic 1:1)

* 0.1 Local dev loop / DX for prompts + agent endpoints
* 0.2 Voice transport stabilisation (shared with BET-01 §1.2)
* 0.3 Local Claude/agent access for stress-testing
* 0.4 Design + product local exploration setup
* 0.5 Model cutover (GPT-4.1-mini → GPT-5-mini)
* 0.6 Production readiness (observability, eval-harness wiring)

### Dependencies

* 0.2 voice transport shared with NAV-BET-01 (§1.2 VoiceLive retirement)
* 0.6 eval-harness wiring supports NAV-BET-03 Evals 2.0 (§3.3)
* Loosely relates to PI-216 (SLOs & Error Budgets) for production-readiness signals

### MAU lever

Enabler. Doesn't move MAU directly; protects the bets that do.

---

### PI-306 — NAV-BET-04 — Navigator Concierge

*(keeps existing thesis + Why; fills the missing sections)*

### Boundary with Bet 02 (Assistants 2.0) and Bet 03 (Analytics)

* **Bet 02** = the ongoing capability — admins create, edit, target, govern assistants over their lifecycle.
* **Bet 04** = the *initial* setup and *continuous* auto-configuration — generates a starting set of assistants on day one from the customer's content, then keeps them current. Shares the AI-generation engine with Bet 02 (§2.2 ↔ §4.1); splits on temporal scope.
* **Bet 03** produces the signals (gaps, clusters, resolution state); **Bet 04** consumes them to update config without admin action.

### What it does

* Auto-generates a starting set of well-scoped assistants from existing intranet content — day-one, zero config
* Infers tone of voice, sources, and context from content instead of asking the admin to type them
* Continuously updates configuration as content changes — self-healing, not a one-time wizard
* Detects content/coverage gaps (consuming Bet 03 signals) and proposes or auto-applies fixes

### Sub-topics (PRD ↔ Epic 1:1)

* 4.1 Auto-generation of starting assistants from content (discovery wizard; shares infra with BET-02 §2.2)
* 4.2 Self-configuration — infer tone, sources, context (no admin fields)
* 4.3 Continuous learning — re-configure as content evolves
* 4.4 Gap detection + auto-fix (consumes BET-03 §3.1 and BET-07 §7.4)

### Key PRDs

* *(gap — to be written; discovery-wizard prototype lives in `NavigatorSetup` / Studio Setup tab)*

### Dependencies

* 4.1 shares discovery-wizard infra with NAV-BET-02 (§2.2)
* 4.3 / 4.4 consume NAV-BET-03 (§3.1) and NAV-BET-07 (§7.4)

### MAU lever

*(unchanged)* Activated tenants × 3+. The dormant base unlocks; quality stops being gated on admin attention.

---

## Next step

I apply Group A banners to Jira (additive, reversible), apply the two draft descriptions to PI-303 / PI-306, and hold Group B until you confirm with Inês/Axel. I'll show the exact before/after for each edit as I go.
