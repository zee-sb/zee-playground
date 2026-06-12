---
name: navigator-trace-audit
description: >-
  Audit Staffbase Navigator Langfuse traces for a customer and publish a
  search-team handover case to Confluence. Use this whenever someone wants to
  investigate, debug, or "dig into" Navigator / AI Assistant retrieval, search,
  recency, ranking, indexing, source-scoping, visibility, or wrong-language
  problems for a specific customer or slug — e.g. "check the langfuse traces for
  <slug>", "why is Navigator returning old content for <customer>", "audit the
  search behaviour for <customer>", "run a trace audit", "look into the news
  recency issue", or "turn these traces into a search-team case". Also use it as
  the engine behind the weekly Navigator trace-audit watchlist. Trigger even if
  the user doesn't say "Langfuse" — any request to diagnose Navigator search
  behaviour from real conversations belongs here.
---

# Navigator Trace Audit

Turn raw Navigator Langfuse traces into an evidence-backed **Search-team handover case** in Confluence, using the same structure as the RJ Corman case. This skill encodes the whole loop so it runs the same way every time: pick the right Langfuse instance for the customer's region → filter by slug → read each trace against a fixed extraction schema → classify failures against a known taxonomy → publish a case page to the handover hub and update the index + systemic-findings table.

The hard part a human keeps re-doing is reading traces consistently and mapping symptoms to root causes. That's what this automates. The browser step needs an authenticated Langfuse session (the UI is client-rendered and behind SSO, so `WebFetch` can't see it) — drive it with the Claude-in-Chrome browser tools.

## Inputs

Gather these before starting. Ask only for what's missing — infer the rest.

- **Customer slug** (required) — e.g. `rjcorman`, `mistercarwash`. This is the instance/branch slug, not the display name.
- **Region** → which Langfuse instance. `us` / North-America-hosted → **us1**; everything else (DACH, EU, NOBE/Nordics, UK) → **de1**. If unknown, derive it from the pilot tracker (see `references/watchlist-from-tracker.md`) or try de1 first, then us1. See `references/langfuse-instances.md`.
- **Date range** (optional, default 30 days) — Langfuse URL takes `?dateRange=30d`.
- **Focus / known symptom** (optional) — e.g. "news recency", "wrong language", "cites hidden file". Narrows which traces to prioritise.
- **Specific conversation/trace IDs** (optional) — if a CSM pasted one (e.g. Mr. Carwash `6a1dec703949cb6e22d2b1b9`), open it directly first.

## Procedure

### 1. Resolve target + load context
- Map region → Langfuse base URL (`references/langfuse-instances.md`).
- Read `references/confluence-targets.md` for the cloudId, space, hub page ID, and the case template.
- If the customer already has a feedback page or handover case, note it so you append/cross-link rather than duplicate.

### 2. Open Langfuse and filter by slug
- Navigate (Chrome tool) to the instance traces URL with the date range, e.g.
  `https://langfuse-de1.staffbase.com/project/ai-assistant/traces?dateRange=30d`.
- Filter to the customer's slug. The slug lives in trace metadata/tags (commonly the branch slug / instance identifier). Use the Langfuse filter UI or search box; if filtering is fiddly, sort by time and scan. Confirm you're seeing this customer's traces only.
- Build a shortlist of traces to open: anything matching the focus symptom, plus a spread of recency/search queries. Aim for 5–8 representative traces (more if cheap). Always open any user-supplied conversation IDs.

### 3. Read each trace against the extraction schema
For every trace opened, capture this fixed schema (read the search tool-call input AND output spans, not just the final answer — the bug is almost always in the retrieval call):

```
- date / trace id
- user query (and any follow-ups in the session)
- search call params: searchType, semanticQuery, publishedAfter (and any type/channel filter)
- result count returned
- result TYPE breakdown: post / page / file
- top results with their content dates (flag any clearly stale ones)
- duplicate chunks of the same item? (y/n)
- wrong-language results vs. user profile language? (y/n)
- tool-call errors / empty (0) results / latency red flags
- 1-line read: what went wrong (or "looks correct")
```

Keep the raw evidence — exact param values, file names, dates. Concrete evidence is what lets the Search team act without re-investigating.

### 4. Classify against the failure taxonomy
Map each problem trace to one or more known findings in `references/failure-taxonomy.md` (e.g. *date filter keys off ingestion date*, *no `type:"post"` gate*, *page-source scoping excludes news index*, *visibility/permission leakage*, *indexing latency*, *chunk dedup*, *PDF table parsing*, *wrong-language*). If a symptom doesn't fit any existing finding, name a **new** finding and flag it — these are the most valuable outputs.

### 5. Publish the case to Confluence (auto-publish)
Using the template in `references/confluence-targets.md`:
- **Create the case page** as a child of the Search Team Handover hub. Title: `<Customer> — <short symptom> (Langfuse trace analysis, <Mon YYYY>)`. Body: Summary → Traces examined (table) → per-issue evidence → Root-cause table → Recommended fixes (for Search) → Sources. Audience is the Search/Hybrid-Search team — keep it engineering-facing.
- **Add an index row** to the hub's case table (Case link, Customer, Symptom, Root-cause area, Status = "Open — needs Search triage").
- **Update the Systemic findings table**: add the customer to the evidence cell of any finding they newly evidence; add a new finding row if you found one.
- **Cross-link**: if the customer has a per-customer feedback page, link the case from it (and the case back). Nest the case under the customer page too if that's the established pattern (RJ Corman did both: child of the customer page, indexed in the hub).
- Always set the page footer `Owner` + `Last updated` and use a clear version message.

Updating Confluence requires the full page body — fetch current body (`contentFormat: html`), make surgical edits, write it back. See `references/confluence-targets.md` for IDs and the exact HTML conventions (panels, status lozenges, tables).

### 6. Report
Post a short summary in chat: traces examined, what was found, which findings are new vs. recurring, and the link to the published case. If nothing actionable was found, say so plainly and don't create a noise page — note it and stop.

## Scope guardrails
- This skill is for **retrieval / indexing / ranking / scoping / visibility / language** issues — the Search (Hybrid Search) team's domain. Tool-call/agent reliability (e.g. a Workday/merge tool returning an error despite a correct call), prompt/assistant-config UX, and pure content-governance asks are **out of scope** — note them for the relevant owner but don't file them as Search cases.
- Don't duplicate an existing case for the same customer+symptom — append new traces to it instead.
- Never invent trace evidence. If a trace doesn't show what was claimed, say so. Every root-cause claim must point to an observed param value, result, or date.

## Watchlist / scheduled mode
When run for the weekly watchlist (no single slug given): derive the active slug+region list from the pilot tracker per `references/watchlist-from-tracker.md`, run steps 2–5 for each, then post one consolidated digest plus any new/updated cases. Keep per-customer cases separate; roll shared root causes into the systemic-findings table.
