# Claude-in-Chrome trace-extraction prompt (standard, reusable)

Paste this into the **Claude-in-Chrome** agent (the browser agent that has full page
access — it can expand the tool-call I/O that the Cowork `chrome-control` connector can't).
Fill the four inputs. It returns a FIXED format that pastes straight into a handover-hub
case (see `references/confluence-targets.md`), so the publish step is mechanical.

Why a separate agent: in Cowork, `Get Page Content` (read-only) reads the focused tab's text
but cannot expand the collapsed retrieval-param JSON; `Execute JavaScript` is often admin-locked.
The Claude-in-Chrome agent can expand observations, so use it for param-level digs. For
symptom-level evidence (answer language, citations, refusals, stale sources) the Cowork
focused-tab read is enough on its own.

---

```text
You are auditing Staffbase Navigator Langfuse traces for ONE customer and producing a
structured retrieval-quality analysis. Work only from what the traces actually show, and
return the result in the FIXED OUTPUT FORMAT at the bottom — no extra prose.

INPUTS (fill in):
- Customer slug (Langfuse `environment`): {{SLUG}}
- Region: {{REGION}}            # "us" -> us1, anything else (DACH/EU/NOBE/UK) -> de1
- Date range: {{RANGE|default 14d}}
- Focus symptom (optional): {{FOCUS}}        # e.g. "wrong language", "old news", "cites hidden file"
- Specific conversation/trace IDs (optional): {{IDS}}

STEP 1 — Open the filtered trace list (replace REGION/RANGE/SLUG):
https://langfuse-{{REGION}}1.staffbase.com/project/ai-assistant/traces?dateRange={{RANGE}}&filter=environment;stringOptions;;any of;{{SLUG}}&pageSize=50
Confirm the rows' environment = {{SLUG}}. (A pasted Staffbase "conversation id" is a 24-char
hex ObjectId, NOT the 32-char Langfuse trace id — find it by timestamp/session, don't open it as /traces/<id>.)

STEP 2 — Pick 6–10 representative traces: always include any provided IDs; prioritise ones
matching the focus symptom plus a spread of search/recency/question queries. Open each.

STEP 3 — For each trace, EXPAND the retrieval/search tool-call observation and read BOTH its
input and output (click to expand the JSON — do not rely on the collapsed preview). Capture:
- trace_id / date
- user_query (+ any follow-ups in the session)
- search params: searchType, semanticQuery, publishedAfter, any type/channel/locale filter, top-k
- result_count
- result_type_breakdown: post / page / file
- top_results: title or filename + content date (flag clearly stale ones)
- duplicate_chunks (same item as multiple entries): yes/no
- answer_language vs user/profile language: match / mismatch
- refusal? / 0 results? / error? / high latency?
- verdict: one line — what went wrong, or "correct"

STEP 4 — Classify each problem against this taxonomy (cite the code):
F1 publishedAfter keys off ingestion date, not publish date (old content passes the recency filter)
F2 no type:"post" gate — files/pages crowd out news posts in the top-k
F3 page-source scoping excludes the news index (selecting page sources drops news)
F4 recency intent not detected / date window too wide
F5 visibility/permission leakage — cites hidden or out-of-permission content
F6 stale index — deleted or unreferenced files still returned
F7 indexing latency — 0 results for known-published content; inconsistent across days
F8 duplicate chunks consume the result cap
F9 wrong-language results vs the user's profile language
F10 PDF/table or embedded-link extraction gaps
F11 structured people/org sources (Profile widget / OrgChart / Employee Directory) not retrievable
Out of scope — NOTE but do NOT file as a search issue: tool-call/agent reliability (tool returns
correctly but model errors), prompt/assistant-config UX, pure content-governance/content-quality.

INTEGRITY: Quote exact param values, filenames and dates from the traces. If a value isn't
visible, write "not shown" — never invent a param you didn't see. You may infer a root cause from
outputs, but label it "(inferred)". If nothing is wrong, say so plainly.

=== FIXED OUTPUT FORMAT (return exactly this, markdown) ===
## Navigator Trace Audit — {{Customer}} ({{SLUG}}, {{REGION}}1)
Date range: <…> · Traces examined: <N> · Auditor: Claude-in-Chrome · Date: <YYYY-MM-DD>

### Traces examined
| Date | Query | Trace ID |
|------|-------|----------|
| … | "…" | … |

### Findings
**Issue 1 — <short title> [F#]**
- Evidence: <exact params / result types / filenames / dates>
- Traces: <ids>
(repeat per issue; if none: "No retrieval issues found.")

### Root cause summary
| Issue | Evidence | Root cause (F#) | Confidence (observed / inferred) |
|-------|----------|-----------------|----------------------------------|

### Recommended fixes (Search team)
1. <fix> …

### Out-of-scope noted
- <item + who owns it>  (or "none")

### Sources
- Langfuse filter: <the STEP 1 URL>
- Conversation IDs: <…>
```

---

## Handing the result back

Paste the agent's output to the Cowork session. Because it already matches the case
structure, publishing is mechanical: create the case as a child of the handover hub
(page 7027621889), copy the Traces/Findings/Root-cause/Fixes/Sources sections into the
template, add the hub index row (Status = "Open — needs Search triage"), and append the
customer to any systemic-findings rows they newly evidence. See `references/confluence-targets.md`.
