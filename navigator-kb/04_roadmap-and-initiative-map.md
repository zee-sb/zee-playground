# Navigator Roadmap & Jira Initiative Map

*Live source: AW Confluence "Navigator 2026 — Initiative Map" (page 6976798741). Verified 2026-06-09. For current epic/story status always check live Jira.*

## The eight initiatives (PI project)
Following Martin's 4→7 bet sign-off (2026-05-21), Jira moved from a single umbrella (PI-152) to eight initiatives — seven bets plus a Tech Enablement bucket. Each PRD lives 1:1 with an Epic underneath its bet.

| Key | Initiative | MAU lever |
|---|---|---|
| PI-152 | NAV-BET-01 — Conversation 2.0 | Returning users ×2 |
| PI-304 | NAV-BET-02 — Assistants 2.0 | Coverage ×10 |
| PI-305 | NAV-BET-03 — Actionable Analytics | Healthy tenants ×1.5 |
| PI-306 | NAV-BET-04 — Navigator Concierge (NEW) | Activated tenants ×3 |
| PI-307 | NAV-BET-05 — MCP + A2A Orchestration (NEW) | Use cases ×3+ |
| PI-308 | NAV-BET-06 — Staffbase MCP / Navigator surface (NEW) | Surface area ×5 |
| PI-309 | NAV-BET-07 — Search ⇄ Navigator (NEW) | Entry points ×5–10 |
| PI-303 | NAV-BET-00 — Navigator Tech Enablement | Enabler |

Naming convention `NAV-BET-0X — Name`; the numeric prefix is load-bearing for PI rollup sort order. PI-152 was **repurposed in place** as Bet 01 (keeps its ID for history + rollups). Bet owners are TBD (assigned at the discovery call); each initiative carries Zee as placeholder until then.

## External dependencies (owned by other teams — link "is blocked by", don't reparent)
| Key | Initiative | Owner | Feeds |
|---|---|---|---|
| PI-199 | Staffbase MCP Server (Ph 1, without OAuth) | Natalia Vigul | Bet 06 |
| PI-38 | Hybrid Search & AI summaries with OpenSearch (GA) | Valerii Geller | Bet 07 (MORI Phase 3) |
| PI-163 | Define AI Quality Gates & Production Readiness | Martin Seidel | Bet 03 (Evals 2.0) |

## Three-layer tracking
1. **Strategy** — AW 6918012931 (2026 Roadmap Q2 and beyond, the 7-bet narrative).
2. **Execution** — AW 6967787581 (2026 Bets Discovery Plan: sub-topics, owners, PRD status, deps).
3. **Tracking** — the Initiative Map (6976798741) + the eight PI initiatives + their PRD-1:1 epics in project **AIW**.

## Restructure status (as of 2026-05-26)
- [x] Phase 1 — repurpose PI-152, create 7 new initiatives, publish the map
- [ ] Phase 2 — re-parent 13 existing epics under the right initiatives
- [ ] Phase 3 — archive 4 obsolete epics (PI-155, PI-156, NAV-96, NAV-98)
- [ ] Phase 4 — bet owners write 26 new epics (PRD-first)
- [ ] Phase 5 — link external deps (PI-199, PI-38, PI-163) via "is blocked by"
- [ ] Phase 6 — refresh PRD index to the 7-bet shape

## Concierge (Bet 04) — Q3 2026 release scope
*Decisions 2026-06-05.* The Concierge **first version = the automatic content scan**, NOT Granular Controls. On activation Navigator scans existing Staffbase data (news, spaces, groups, profile fields, popular topics, glossary) and grounds itself — zero client-side setup. Scope: company/audience + structural scan + topics + glossary. Quick scan first; depth/refresh/suggested-Experts later.

- **NAV-1088** — Concierge Automatic Context, first version / the scan (Filip Pižl)
- **NAV-1089** — Navigator-in-Studio, test-as-you-configure (Christian Stehr)
- **NAV-1071** — Search Granular Controls V2 / content-scope controls (Zee) — a *separate* deliverable that folds into Concierge later, following shipped V1 (NAV-394).

**Q3 release facts:** quarterly release **July 30, 2026** (2026.3). Native feature freeze June 23 (Studio/admin web work not bound by it). Slug/opt-out lists + feature collections due July 22. Concierge ships as **Beta / Early Access** via a design-partner slug list (flagged), **no separate pricing** (bundled with Navigator).

## Pre-2.0 standalone items that survive
Most former Q2–Q3 items became consequences of the 2.0 architecture. The standalone items that remain are **MORI integration** and the **activation/Concierge wizard**.
