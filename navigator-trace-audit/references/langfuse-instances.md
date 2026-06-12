# Langfuse instances & browser navigation

Navigator runs two Langfuse instances, split by where the customer is hosted.

| Region | Instance | Base traces URL |
| --- | --- | --- |
| North America / US-hosted | **us1** | `https://langfuse-us1.staffbase.com/project/ai-assistant/traces` |
| DACH, EU, NOBE/Nordics, UK (everything else) | **de1** | `https://langfuse-de1.staffbase.com/project/ai-assistant/traces` |

The project is always `ai-assistant`. Append `?dateRange=30d` (or `7d`, `14d`, `90d`) to scope the window:
`https://langfuse-de1.staffbase.com/project/ai-assistant/traces?dateRange=30d`

Open a single trace directly when you have its ID:
`https://langfuse-<region>.staffbase.com/project/ai-assistant/traces/<TRACE_ID>`

## Choosing the region
1. If the caller said "us"/"de", use that.
2. Else derive from the pilot tracker Region column (`references/watchlist-from-tracker.md`): `NA` / US states → **us1**; `DACH` / `EU` / `NOBE` / UK → **de1**.
3. If still unknown, open **de1** first, filter by slug; if zero traces, try **us1**. A slug only exists in one instance.

## Browser tools (authenticated session required)
Langfuse is behind SSO and is client-rendered, so `WebFetch` returns an empty shell — you must use the Claude-in-Chrome browser tools (the user must be logged into Langfuse in Chrome):

- Navigate: `mcp__Control_Chrome__open_url` (or the equivalent `navigate` tool).
- Read rendered content: `mcp__Control_Chrome__get_page_content` (or `get_page_text`).
- Interact with filters / expand spans / click into traces: `mcp__Control_Chrome__execute_javascript`, plus the click/scroll tools.

If the browser tools aren't available or Chrome isn't logged in, stop and tell the user — don't try to fetch traces another way.

## Filtering by slug
The customer slug identifies the branch/instance and appears in trace **metadata/tags** (commonly the branch slug or instance identifier). To isolate one customer:
- Use the Langfuse traces **filter / search** UI on the metadata field, or paste the slug into the search box.
- If the filter field name isn't obvious, open one trace, find which metadata key holds the slug, then filter on that key.
- Verify the result set belongs only to the target customer before analysing (slugs can be substrings of each other — match exactly).

## What to open inside a trace
A Navigator trace has the LLM spans plus the **search/retrieval tool call**. The retrieval bug is almost always in that tool call, so always expand it and read BOTH its **input** (params like `searchType`, `semanticQuery`, `publishedAfter`, any `type`/channel filter) and its **output** (the returned results: their `type`, content dates, duplicates). The final assistant message alone won't reveal the root cause.
