# Navigator PRD Index & Format Conventions

*Live source: AW Confluence space (key `AW`, spaceId 6081642580). PRDs now live under per-bet folder pages. Verify titles/status live before quoting.*

## Where PRDs live now (UPDATED 2026-06-03)
The old **PRD Master Index (6808174603) is RETIRED** (stub → archived). PRDs are organized under **per-bet folder pages**, and the catalog entry point is the **Navigator 2026 — Initiative Map (6976798741)**.

File a new PRD as a **child of its bet folder**:

| Bet | Initiative | Folder page ID |
|---|---|---|
| Bet 00 — Tech Enablement | PI-303 | 6976274450 |
| Bet 01 — Conversation 2.0 | PI-152 | 6977126447 |
| Bet 02 — Assistants 2.0 | PI-304 | 6976897046 |
| Bet 03 — Actionable Analytics | PI-305 | 6976471051 |
| Bet 04 — Navigator Concierge | PI-306 | 6977126471 |
| Bet 05 — MCP + A2A Orchestration | PI-307 | 6976241684 |
| Bet 06 — Staffbase MCP | PI-308 | 6977323037 |
| Bet 07 — Search ⇄ Navigator | PI-309 | 6976798788 |

An **Archive 📦 folder (6977323062)** under the AW homepage holds Workmate-era and dead-exploration pages.

## Known active PRDs (snapshot — may have moved into bet folders)
- 6899990542 — PRD — Navigator MCP Platform (Atlassian Wave) [phases: 6898745517 P0, 6899302404 P1, 6899433493 P2, 6899990574 P3]
- 6862929948 — PRD — Scale to 100 Assistants & User/Group ACL
- 6862340141 — PRD — Context-Aware Navigator
- 6861750311 — PRD — Conversation Continuity, History & Session Management
- 6814236688 — PRD — SharePoint Knowledge Connector
- 6791364650 — Navigator Agent Network — Open Agent Integration via MCP
- 6807945226 — Event-Driven Actions & Entry Points
- 6808338450 — Aggregated Analytics & Conversation Intelligence
- 6807584770 — Action Integrations Framework
- 6807715856 — New Navigator UX — Mobile & Desktop
- 6809321479 — Production Readiness
- 6808633347 — ServiceNow Integration
- 6807912455 — Search Granular Controls
- 6807814148 — Navigator Assistants (Multi-Agent)
- 6806536224 — Next-Gen Employee Experience

**Biggest gap:** Bet 06 (Staffbase MCP) has **no whole-bet PRD yet** — write it before any Bet 06 Jira work.

## PRD format conventions
**PRD ↔ Epic is 1:1.** Each AW PRD maps to one Jira Epic in project **AIW**; the epic description carries `🔗 PRD: <url>`.

**Header block:** Owner (Zyad Abuzeid or co-owner) · Initiative (linked PI) · Pillar (one of the 5) · Status emoji (🔴 Draft / 🟡 In Review / 🟢 Approved / 🔵 Delivery / ✅ Done / ⚠️ At Risk) · Linked Jira Epic (AIW-XXX) · Updated date.

**Typical sections:** 1) Context/Problem (cite Pendo/feedback/customer) · 2) Goal/Outcome (with metric) · 3) Non-goals · 4) User stories/use cases · 5) Solution overview (mapped to a pillar) · 6) Detailed requirements (each → a Story) · 7) Dependencies · 8) Risks & open questions · 9) Rollout plan (gating, design partners, beta/GA) · 10) Success metrics (leading + lagging).

**Conventions:** default page format `markdown`; switch to `html` only for panels/columns/complex tables. Status emoji and pillar tag are non-optional. Before drafting, fetch 1–2 nearby PRDs in the same bet/pillar to match tone and depth.
