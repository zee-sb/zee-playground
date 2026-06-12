# Confluence targets, IDs & case template

All pages live in the Atlassian Cloud site **mitarbeiterapp.atlassian.net**.

## Fixed IDs
- **cloudId:** `f21a160d-83b9-4390-8be5-c52e332d0043`
- **Space:** key `AW` ("AI Assistant"), **spaceId** `6081642580`
- **Search Team Handover hub** (parent for new cases): page **`7027621889`**
  — "Search Team Handover — Navigator Retrieval Cases"
- **Customer Feedback hub** (per-customer pages live under here): page **`6975946857`**
- **Pilot tracker** (Drive): file id `1leioeQ4bh05HRTu-gKlz4HFpG2hckiQQl3FCGgxIp7w`
- Reference case to copy the format from: **RJ Corman trace analysis** page `7027556353`.

## MCP tools
- Create: `createConfluencePage` (cloudId, spaceId, parentId, title, body, contentFormat:"html").
- Read current body before editing: `getConfluencePage` (contentFormat:"html").
- Update: `updateConfluencePage` (needs the FULL body — fetch, edit surgically, write back; include a versionMessage).
- Find a customer's existing page: `getConfluencePageDescendants` on `6975946857`, match by title.

## HTML conventions (this MCP's storage dialect)
- Headings `<h1>`–`<h3>`, paragraphs `<p>`, `<strong>`, `<em>`, `<code>`, tables `<table><thead><tr><th>…</tr></thead><tbody>…</tbody></table>`.
- Panels: `<div data-type="panel-info|warning|note|success|error"><p>…</p></div>`.
- Status lozenge: `<span data-type="status" data-color="green|red|yellow|blue|neutral|purple">Label</span>`.
- Task list: `<ul data-type="task-list"><li data-type="task-item"><input type="checkbox"> …</li></ul>`.
- Links: `<a href="URL">text</a>`. Internal page links can use the full `/wiki/spaces/AW/pages/<id>` URL.
- Escape `&` as `&amp;` inside text/URLs.

## Case page template (child of hub 7027621889)
Title: `<Customer> — <short symptom> (Langfuse trace analysis, <Mon YYYY>)`

```html
<div data-type="panel-info"><p>Deep-dive of Langfuse traces from the <CUSTOMER> instance (<code><SLUG></code>, <REGION> = langfuse-<region>1) explaining <SYMPTOM> raised <DATE>. Companion to the <a href="<CUSTOMER_PAGE_URL>"><CUSTOMER> customer page</a>, indexed in the <a href="https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/7027621889">Search Team Handover</a> hub. <strong>Audience: Search / Hybrid Search team.</strong></p></div>
<h2>Summary</h2><p>…one paragraph: symptom + the concrete retrieval behaviours found…</p>
<h2>Traces examined</h2>
<table><thead><tr><th><p>Date</p></th><th><p>Query</p></th><th><p>Trace ID</p></th></tr></thead><tbody>
<tr><td><p>YYYY-MM-DD</p></td><td><p>"query"</p></td><td><p><code>id…</code></p></td></tr>
</tbody></table>
<h2>Issue N — <title> (maps to F#)</h2><p>…evidence: exact params, result types, dates, file names…</p>
<h2>Root cause summary</h2>
<table><thead><tr><th><p>Issue</p></th><th><p>Evidence</p></th><th><p>Root cause (taxonomy F#)</p></th></tr></thead><tbody>…</tbody></table>
<h2>Recommended fixes (for Search team)</h2><ol><li><p>…</p></li></ol>
<h2>Sources</h2><ul><li><p>Langfuse traces (<SLUG>, langfuse-<region>1), <range> — IDs above.</p></li><li><p>Customer feedback: <a href="SLACK_URL">Slack — …</a></p></li></ul>
<p><em>Owner: Zee. Analysis date: YYYY-MM-DD. Source: Langfuse trace review (Claude in Chrome).</em></p>
```

## After creating the case page, update the hub (page 7027621889)
1. **Case index table** — add a row: Case (link to new page), Customer, Symptom, Root-cause area (list F# short names), Status `<span data-type="status" data-color="red">Open — needs Search triage</span>`.
2. **Systemic findings table** — for each finding the customer newly evidences, append "<Customer>" to that finding's evidence cell. If you found a brand-new finding, add a new row (Finding / Evidence / Proposed direction) and give it the next F# in `failure-taxonomy.md` too.
3. Bump the hub footer "Last updated" date.

## Cross-link the customer page (under hub 6975946857)
If a per-customer page exists, add a one-line link to the new case in its feedback log, and (matching the RJ Corman pattern) consider nesting the case under the customer page as well as indexing it in the hub. Keep edits surgical — fetch full body, insert, write back.
