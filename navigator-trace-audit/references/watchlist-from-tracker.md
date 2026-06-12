# Deriving the audit watchlist from the pilot tracker

Used in scheduled/watchlist mode (no single slug given) and to look up a
customer's region.

## Source
Closed Beta + Navigator Pilot Tracker — Drive file id
`1leioeQ4bh05HRTu-gKlz4HFpG2hckiQQl3FCGgxIp7w`.
Read it with `read_file_content` (it's large; if the result is truncated to a
file, parse that file with a script).

## How to build the list
1. Read the tracker. Each customer row has a **slug** (often in the Customer
   cell as `slug xyz` or `(slug xyz)`), a **Region** column (`DACH`, `EU`,
   `NOBE`, `NA`, …), and an **Activation/Rollout** status.
2. **Keep** customers that are live enough to have traces: Activation = TRUE, or
   status indicating testing / rollout / active beta / pilot. **Skip** rows that
   are only "interested", "ingested", waiting-list, or have no slug.
3. **Region → instance:** `NA` (and US states) → **us1**; everything else
   (`DACH`, `EU`, `NOBE`, UK) → **de1** (see `langfuse-instances.md`).
4. Cap the run at a sensible number of customers per week (e.g. the most active
   / highest-priority 8–12) so the scheduled job stays bounded. Prioritise:
   customers with open feedback this week, renewal/strategic-risk accounts, and
   any with a pasted conversation ID.

## Manual overrides
The user asked for tracker-derived (auto) seeding. If they later want to force-
include or exclude specific slugs, keep a short list here:

```
INCLUDE: (none yet)
EXCLUDE: (none yet)
```

## Already-documented (avoid duplicate cases)
Check the handover hub case index (page `7027621889`) before creating a case.
As of 2026-06-10 the hub contains:
- RJ Corman — news recency & coverage (`rjcorman`, us1).

For an already-documented customer, append new traces to the existing case
rather than creating a second page.
