# Trace Doctor — in-app route

A standalone, password-gated page in the prototype app where anyone on the team
can upload Langfuse traces and get a root-cause report per trace, plus search and
browse every trace the team has analyzed.

- **URL:** `/prototypes/trace-doctor` (also a card on the gallery home page)
- **Password:** `Staffbase2026!!` — a client-side gate stored in `localStorage`
  (`traceDoctorPass`) and echoed to the API as the `x-td-pass` header. Override
  the expected value with the `TRACE_DOCTOR_PASS` env var.

## What it does

- **Upload** one or many `.json` traces (drag-drop or file picker) or paste trace
  JSON. A file may hold a single trace or a JSON array of traces.
- **Per-trace report:** status (HEALTHY / MINOR / NEEDS_FIX / UNSCORABLE), a
  one-line summary with the root-cause layer, the eval scores (unreliable ones
  struck through), findings as cards (layer, severity, evidence, recommended
  fix), and the full markdown report.
- **Search & browse:** every stored trace, newest first, filterable by text
  (question / environment / trace id / session id / summary), status, and
  environment. Results are grouped by **session + slug** so re-uploads and traces
  from the same session show as one group, never duplicates.
- **Dedupe / merge:** each trace is stored under a dedupe key (the Langfuse trace
  id, or a `session:env:hash` fallback). Re-uploading the same trace **updates**
  the existing row instead of adding a duplicate (verified: uploading 8 traces
  twice leaves exactly 8 rows).

## Pieces

| File | Role |
|---|---|
| `src/prototypes/TraceDoctor/TraceDoctorStudio.jsx` | The UI (gate, upload, search, report). Registered in `src/App.jsx`. |
| `api/trace-doctor.mjs` | Backend: `analyze` (+persist/dedupe), `list` (search), `get`, `delete`. |
| `lib/trace-doctor-engine.mjs` | Shared analysis engine (also used by the Slack MCP connector). |
| `db/migrations/015_trace_doctor.sql` | `trace_doctor_traces` table. |

## Setup / deploy

1. Run the migration (idempotent): `node db/run-migration.mjs db/migrations/015_trace_doctor.sql`
2. Deploy (push to `main`; Vercel auto-builds). `trace-doctor/deploy.sh` does both.
3. Optional env vars on Vercel: `TRACE_DOCTOR_PASS` (app password),
   `TRACE_DOCTOR_TOKEN` (Slack connector secret).

Notes: persistence requires `DATABASE_URL` (the app's existing Neon connection);
without it the route returns a clear "DB not configured" message. This adds one
Vercel serverless function (`api/trace-doctor.mjs`) — fine on the Team plan.
