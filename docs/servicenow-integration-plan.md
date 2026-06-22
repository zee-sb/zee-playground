# ServiceNow Integration Plan — zee-playground

_Drafted 2026-06-22 · owner: Zee_

## 1. Do we have a ServiceNow demo account?

**Yes — confirmed working test account, plus a fallback instance and a prior backend PoC.**

| Instance | URL | Credentials | Owner / use |
|---|---|---|---|
| **Navigator dev instance** ⭐ | `https://ven08324.service-now.com/` (ESC portal at `/esc`) | Username **`desk.user`**; password held in Vercel env / 1Password — **not stored in this repo** | Confirmed test account. The one the AI Assistant team used for ServiceNow discovery. Best fit for our prototype. |
| Sales / SE instance | `dev223694.service-now.com` | 1Password → **"SE ServiceNow Instance"** | SE demos; usable as fallback. |

> ⚠️ **Secret handling:** the test-account password was shared directly but is intentionally kept out of this document and the repo. Put it in `SERVICENOW_PASSWORD` (Vercel env, see §4.8) and the 1Password "ven08324" entry only. Rotate it if it has been pasted anywhere committed.
>
> The instance lands on the **Employee Service Center** (`/esc`), which confirms it has the ESC/portal + Knowledge surface we need for the read-only KB-search demo.

Supporting context found in Confluence:

- **AW space — [ServiceNow Discovery results](https://mitarbeiterapp.atlassian.net/wiki/spaces/AW/pages/6628081787)**: a backend PoC ([Staffbase/backend PR #21701](https://github.com/Staffbase/backend/pull/21701)) already wired ServiceNow **Knowledge Base search** into the real AI Assistant via a ServiceNow tool. Scope was **read-only / search only** (use case 4). Ticket create/update was investigated but **not** built — the responsible team flagged most write actions as unsupported at the time.
- **GTA space — [ServiceNow config tutorial](https://mitarbeiterapp.atlassian.net/wiki/spaces/GTA/pages/4228677672)** and **[ServiceNow setup](https://mitarbeiterapp.atlassian.net/wiki/spaces/GTA/pages/4320428073)**: the customer-facing flow — get instance name + client id + client secret, install Knowledge API, create an endpoint. Confirms the production pattern is **per-tenant OAuth app registered inside the customer's instance**.
- Customer-facing docs: [ServiceNow-to-Staffbase](https://support.staffbase.com/hc/en-us/sections/15296686796178-ServiceNow-to-Staffbase).

**Takeaway:** we don't need to stand anything up. Use `ven08324` with the 1PW service credential for the prototype.

## 2. What already exists in the prototype

ServiceNow is already a **UI stub** but has **no backend**:

- `src/prototypes/Navigator/tabs/AddConnectorModal.jsx` — ServiceNow listed (id `servicenow`, category ITSM).
- `src/prototypes/AIAssistant/PlatformConnectionsHub.jsx` — ServiceNow card (logo, `tool_server` type, "Ticket lifecycle operations", risk note "ITSM actions can change production records").
- `src/chat-widget/scenarios.jsx` — a scripted "ServiceNow Incident Created" demo moment.

There is **no** `servicenow` provider in `api/connections.mjs`, **no** `lib/servicenow.mjs` client, and **no** `servicenow` MCP flavor in `api/mcp/[flavor].mjs`. Closest reference implementation is the simulated **`lib/mcp-servers/it.mjs`** (Acme IT Helpdesk) — same shape we'll mirror, but pointed at the real dev instance.

## 3. Recommended approach

Two layers, decoupled so we can demo fast and harden later.

### Decision: don't use the native MCP Server Console for the prototype
The platform-native MCP server needs **Zurich P9 / Australia P2 + Now Assist** (see prior research). The free `ven08324` dev instance almost certainly isn't on that patch line and won't have the SKU. So for the prototype we call the **ServiceNow REST API directly** from a new MCP flavor — exactly what the backend PoC did. We keep the native-MCP path as the *production* target (documented in §6).

### Auth for the prototype: shared service credential, not per-user
Per-user OAuth (our Connection Broker model) is the right production design, but it requires an OAuth app registered inside each customer instance. For a single shared demo instance that's overkill. So:

- Store one credential for `ven08324` in env: `SERVICENOW_INSTANCE_URL=https://ven08324.service-now.com`, `SERVICENOW_USER=desk.user`, `SERVICENOW_PASSWORD=<from 1PW, set in Vercel only>` (basic auth, or a client id/secret if we register an OAuth app on the dev instance).
- The `servicenow` MCP flavor uses it server-side. All demo users share the dev instance's data (which is fine — it's a sandbox).
- The UI "Connect" button flips a `connected` row (optimistic, like the Campsite connector) so the experience looks real without a per-user redirect.

This keeps the per-user Connection Broker seam intact for when we move to real customer tenants (§6).

## 4. Implementation steps

1. **`lib/servicenow.mjs`** — REST client for the dev instance. Functions: `searchKnowledge(query)`, `listIncidents({assignedTo, state})`, `getIncident(number)`, `(stretch) createIncident({short_description, ...})`. Basic-auth header from env; thin wrappers over `/api/now/table/incident` and `/api/now/table/kb_knowledge`.
2. **`lib/mcp-servers/servicenow.mjs`** — new MCP flavor mirroring `it.mjs` (StreamableHTTP + Bearer + zod tool schemas). Expose read-only tools first: `servicenow_search_kb`, `servicenow_list_incidents`, `servicenow_get_incident`. Gate `servicenow_create_incident` behind a flag.
3. **`api/mcp/[flavor].mjs`** — import the handler and add `servicenow` to the `HANDLERS` map.
4. **`vercel.json`** — add `/api/mcp-servicenow → /api/mcp/servicenow` rewrite (match existing ordering rules; don't disturb auth/connections/companion rewrites).
5. **`api/connections.mjs`** — add `serviceNowConnect` (optimistic connect, Campsite-style) and a `disconnect` provider entry. Skip a real OAuth callback for now.
6. **Wire the UI stub** — point the existing ServiceNow card in `PlatformConnectionsHub.jsx` / `AddConnectorModal.jsx` at the new connect endpoint and surface the three read tools.
7. **Register the MCP server** in the orchestrator/connector registry so the employee chat can route ServiceNow intents to it (`lib/connector-registry.mjs`, orchestrator config).
8. **Env + secrets** — add the `SERVICENOW_*` vars to Vercel: `SERVICENOW_INSTANCE_URL=https://ven08324.service-now.com`, `SERVICENOW_USER=desk.user`, `SERVICENOW_PASSWORD` (from 1PW "ven08324 - ServiceNow News Central"). Never commit the password.

## 5. Demo scope (phase 1)

Read-only, matching the proven PoC: **search the KB**, **see my open incidents**, **look up an incident by number** — driven through the Navigator employee chat. Incident creation is a phase-2 stretch behind a flag (write actions hit production-like records — keep it off for live demos).

## 6. Production path (later, not prototype)

When we target real customer tenants: switch the `servicenow` connector from the shared service credential to the **per-user OAuth 2.1 authorization-code flow** against the **native MCP Server Console** (Zurich P9+ / Now Assist). Tokens stored per `(user, tenant, connector)` in the `connections` table, refreshed by the Connection Broker — identical mechanics to the Atlassian connector, just with a per-tenant registered OAuth app. ServiceNow then enforces each user's own roles/ACLs on every tool call.

## 7. Open questions

- Confirm `ven08324`'s patch level + whether the Knowledge API is installed (the GTA tutorial requires it). The live `/esc` portal suggests Knowledge is present; verify the REST endpoint with a quick `curl` against `/api/now/table/kb_knowledge` using `desk.user`.
- Confirm `desk.user`'s roles — an ESC end-user account may be read-limited (good for the read-only demo, but would block incident-create in phase 2).
- Decide basic-auth vs. registering an OAuth app on the dev instance (OAuth is closer to production and avoids storing a password).
- Confirm we want write actions (incident create) demoable at all, given the production-record risk note already in the UI.
