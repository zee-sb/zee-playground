# Trace Doctor → Claude in Slack

Trace Doctor is exposed as a **remote MCP connector** so Claude in Slack can run
it. Someone drops a Langfuse trace into a Slack thread, `@Claude` it, and Claude
calls the `analyze_trace` tool and posts the diagnostic report back — same engine
and same verdicts as the `trace-doctor` skill (verified byte-for-byte on the 8
sample traces).

## What was added to zee-playground

- `lib/mcp-servers/trace-doctor.mjs` — the Node port of the analyzer + an MCP
  (JSON-RPC) handler exposing one tool, `analyze_trace`.
- `api/mcp/[flavor].mjs` — registered the `trace-doctor` flavor.
- No `vercel.json` change needed: the existing `/api/mcp-:flavor` rewrite already
  maps the endpoint.

**Endpoint** (after deploy):

```
POST https://<your-deployment>/api/mcp-trace-doctor
```

It speaks bare JSON-RPC (`initialize`, `tools/list`, `tools/call`) exactly like
the other MCP flavors in this repo.

The tool:

| Tool | Input | Output |
|---|---|---|
| `analyze_trace` | `trace`: one Langfuse trace (object or pasted JSON string) **or** an array of traces; `format`: `markdown` (default) or `json` | Single-trace deep-dive, or a batch/fleet aggregate when given an array |

## Connect it to Claude in Slack

Custom connectors are configured once at the **organization level** in Claude
settings (needs a Claude org admin), and then become available to Claude across
surfaces, including Slack.

1. In Claude (web), as an org admin: **Settings → Connectors → Add custom
   connector** (a.k.a. "remote MCP server").
2. Name: `Trace Doctor`. URL: `https://<your-deployment>/api/mcp-trace-doctor`.
3. Save, then enable it for the workspace/org. (If Claude in Slack scopes tools
   per user, each user enables "Trace Doctor" once from the connectors list.)
4. Test in Slack:
   > `@Claude use Trace Doctor to analyze this trace:` *(paste the trace JSON, or
   > attach the .json file)*

   Claude will call `analyze_trace` and reply with the report. For several traces
   at once, paste a JSON array or attach multiple and ask for a fleet view.

> Product UI names shift over time — if "Add custom connector" isn't where the
> steps say, look under Settings for *Connectors / MCP / Integrations*. The only
> thing Slack needs is that the connector is enabled for the org.

## Security note (before wider rollout)

Like the other MCP flavors in this prototype, `/api/mcp-trace-doctor` is currently
**unauthenticated** and does no data storage — it only transforms the trace JSON
you send it into a report. Traces can contain customer content, so before opening
this beyond the team, add an auth check (shared secret header or the same
connection-broker auth the other connectors use) and confirm where the connector
traffic egresses. Nothing is logged or persisted by the handler itself.

## Reality check: slash command vs. @mention

You asked for a `/trace-doctor` **slash command**. Slash commands belong to a
Slack app *you* own — Anthropic's Claude app can't host a custom one, so with
official Claude in Slack the trigger is an **@mention** as above.

If the slash-command UX matters, it's a small add-on: a thin Slack app (one Vercel
function handling the slash command + `file_shared` event) that calls this **same**
`analyze_trace` tool/engine and posts the result. The engine work is already done;
that would just be the Slack-app plumbing (manifest, signing-secret verification,
`chat.postMessage`). Say the word and I'll scaffold it.

## Local sanity check

```bash
curl -s -X POST http://localhost:3456/api/mcp-trace-doctor \
  -H 'content-type: application/json' \
  -d '{"id":1,"method":"tools/call","params":{"name":"analyze_trace","arguments":{"trace": <PASTE_TRACE_JSON> }}}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["content"][0]["text"])'
```
