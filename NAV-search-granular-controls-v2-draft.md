# Search Granular Controls V2 — Content Scope Controls

**Type:** Epic · **Project:** Navigator (NAV) · **Initiative:** PI-306 — NAV-BET-04 Navigator Concierge
**Follows:** NAV-394 (Search granular controls V1)
**Status:** Draft

---

## Problem

Navigator searches everything in the intranet by default. For many customers that means the assistant retrieves from old, broken, or simply irrelevant content — outdated news posts, archived pages, draft material — which surfaces as wrong or low-confidence answers. Admins have no way to tell Navigator "only look here, and ignore anything stale."

V1 (NAV-394) delivered the governance/permission spine: role-based filtering and data-source access control. **V2 gives admins direct, content-level control over what Navigator actually searches** — so they can cut the noise without touching permissions or data governance.

This is a Concierge concern: a self-configuring assistant is only as good as the content it draws from. Scope controls are the manual lever that complements Concierge's automatic content inference — and the same scope signals (what admins exclude, what's stale) feed back into Concierge's source-quality model.

## Goal

Give admins a simple way to **limit the scope of Navigator's content search** so the assistant avoids old, broken, or irrelevant content and answers from a curated, trustworthy slice of the intranet.

## In scope

1. **Customers without Spaces.** Scope controls must work for tenants that aren't organized into Spaces (flat / legacy intranets). When no Spaces exist, scoping falls back gracefully to channel- and page-level controls instead of failing or hiding the feature.
2. **News channel include/exclude + exclude-all-news.** Admins choose which news channels Navigator searches, with a master toggle to exclude *all* news in one click (news is the most common source of time-sensitive, quickly-stale noise).
3. **Page include/exclude.** Admins include or exclude specific pages from the search scope.
4. **Freshness / last-modified cutoff.** Admins exclude content older than a chosen date or rolling timeframe (e.g. "nothing not modified in the last 18 months"), based on the last-modified timestamp.

## Out of scope

- Permission / ACL changes (owned by V1, NAV-394).
- Automatic, content-inferred scoping with no admin input (that is Concierge core — V2 is the explicit, admin-driven lever).
- Per-end-user scope overrides; V2 is configured at the assistant/tenant level.

## Success criteria

- An admin can exclude all news, or a named subset of news channels, and Navigator stops retrieving from them.
- An admin can include/exclude specific pages.
- An admin can set a last-modified cutoff and stale content drops out of results.
- All of the above is usable on a tenant that has **no Spaces**.
- Measurable: reduction in answers citing excluded/stale sources; admin can verify what's in scope.

## Proposed breakdown (PRD ↔ Epic, work split FE / BE)

**Backend**
- Content-scope configuration model & Admin API — persist include/exclude rules (news channels, pages, last-modified cutoff) per assistant; CRUD + validation.
- Apply scope filters in the Navigator retrieval pipeline — channel/page include-exclude resolution + exclude-all-news at query time.
- Last-modified staleness filter — exclude content older than a date or rolling timeframe across retrieval.
- No-Spaces tenant scope resolution — resolve scope when a tenant has no Spaces; fall back to channel/page granularity.

**Frontend**
- News channel scope controls — include/exclude list + "exclude all news" master toggle.
- Page include/exclude picker.
- Content freshness control — date picker / rolling-timeframe selector for the last-modified cutoff.
- No-Spaces tenant configuration experience — adapt the scope UI when no Spaces are present.

## Notes / open questions

- Default behaviour when nothing is configured = search everything (no regression vs. today).
- Confirm whether the freshness cutoff is a hard exclude or a ranking de-prioritization (draft assumes hard exclude; worth validating with the retrieval team).
- Confirm scope is per-assistant (aligns with Assistants 2.0 / PI-304) vs. per-tenant default with per-assistant override.
