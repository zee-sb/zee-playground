# Navigator retrieval failure taxonomy

Classify each problem trace against these known findings. These mirror the
"Systemic findings for the Search team" table on the handover hub — when you
evidence one, add the customer to that finding's evidence cell. If a symptom
fits none of these, name a **new** finding (and add a row to the hub).

Each finding: **how to recognise it in a trace** → **the likely root cause** → **proposed direction** (for the case page's "Recommended fixes").

### F1 — Date filter keys off ingestion date, not publication date
- **Recognise:** `publishedAfter` is set to a recent date, yet results include clearly old content (PDFs/posts from years before the cutoff).
- **Root cause:** `publishedAfter` matches the document's ingestion/index timestamp, not the content's real `published_at`. Anything re-ingested after the cutoff passes.
- **Direction:** Map `publishedAfter` to the post/document's actual `published_at`; re-index the date field.

### F2 — No content-type gate (files/pages crowd out news posts)
- **Recognise:** A "news/latest" query returns mostly `type: file` or `type: page`; few or zero `type: post`. Often all 10 results are files.
- **Root cause:** Search uses `searchType: "CONTENT"` with no `type` restriction; dense keyword overlap on static docs out-ranks posts within the result cap.
- **Direction:** Support a `type: ["post"]` filter; apply it on detected news/recency intent.

### F3 — News index unreachable when page sources are scoped
- **Recognise:** Selecting page sources in the KB → news disappears; deselecting → news returns.
- **Root cause:** Page-source scoping restricts to selected sources; news channels aren't selectable, so any page-source selection excludes the news index.
- **Direction:** Make news channels selectable, or keep the news index in scope alongside selected page sources.

### F4 — Recency intent not detected / window too wide
- **Recognise:** "recent", "latest", "what's new", "past week" queries run with a huge `publishedAfter` window (e.g. 2 years) and don't prioritise recent posts.
- **Root cause:** No intent-based default for date window or post prioritisation.
- **Direction:** On recency intent, default to a 14–30 day window and prioritise `type: post`.

### F5 — Visibility / permission trimming leakage
- **Recognise:** Results include content the user/assistant shouldn't see — hidden content, a source explicitly told to stay hidden, or content outside the user's space permissions.
- **Root cause:** Known AI Navigator + Search visibility issue (Igor). Includes the assistant citing a "hidden internal reference" file, and branch-wide-accessible space content leaking.
- **Direction:** Honour hidden-content flags + space permissions in retrieval; don't append/cite sources flagged hidden.

### F6 — Stale index: deleted / unreferenced files still returned
- **Recognise:** Results include files that were deleted (older versions) or are no longer referenced/embedded anywhere.
- **Root cause:** Deletion/unreference not propagated to the index.
- **Direction:** Remove deleted + unreferenced files from the index; reconcile on delete.

### F7 — Indexing latency
- **Recognise:** A known-published post returns 0 results on day X but is discoverable a day or two later; inconsistent coverage across sessions.
- **Root cause:** Ingestion lag between publish and index availability.
- **Direction:** Target near-real-time indexing (seconds/minutes); document expected lag.

### F8 — Duplicate chunks consume the result cap
- **Recognise:** The same item appears as multiple result entries (different chunks), shrinking unique coverage within the 10-result cap.
- **Root cause:** No dedup before applying the result cap.
- **Direction:** Deduplicate by item before capping results.

### F9 — Wrong-language results
- **Recognise:** User profile language is X but results/answer come back in language Y (e.g. en_US users get German results, or vice versa); workaround is asking the bot to translate.
- **Root cause:** Locale not applied in retrieval/answer; sometimes compounded by a missing translation string.
- **Direction:** Apply user profile language to retrieval + response; fix missing translation strings.

### F10 — PDF / table extraction gaps
- **Recognise:** Answers from tabular PDFs are wrong/empty; links inside page tables aren't surfaced even when the page is the source.
- **Root cause:** Table/embedded-link content lost during ingestion/chunking.
- **Direction:** Improve table + embedded-link extraction.

### F11 — Structured people/org sources not ingested
- **Recognise:** "Who is the CEO / who leads the company?" fails; Profile Widget, OrgChart, Employee Directory content not retrievable.
- **Root cause:** These structured widgets aren't ingested into the search context.
- **Direction:** Ingest profile/org/directory entities (or expose them to retrieval).

---
## Out of scope (note, but do NOT file as Search cases)
- **Tool-call / agent reliability** — e.g. a Workday/merge tool call returns correctly but the model answers with an error; latency or numeric-format confusing the model. Owner: Navigator agent/runtime team.
- **Prompt / assistant-config UX** — slogan length, "Ask AI anything" text, source-management list view, conversation-starter routing. Owner: Navigator product.
- **Pure content governance** — customer content quality, editor upload rights. Owner: CSM + customer.
