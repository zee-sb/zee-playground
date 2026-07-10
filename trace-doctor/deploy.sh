#!/usr/bin/env bash
# One-shot: run the DB migration, commit the Trace Doctor feature, and push to
# main so Vercel auto-deploys. Run from the repo root on YOUR machine (git,
# Vercel, and Neon are all reachable there; the Cowork sandbox can't write .git
# or reach Vercel/Neon).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "==> 1/3  Running DB migration (creates trace_doctor_traces)…"
# Needs DATABASE_URL in .env.local (already used by the app). Idempotent.
node db/run-migration.mjs db/migrations/015_trace_doctor.sql

echo "==> 2/3  Committing the Trace Doctor feature…"
git checkout main
git pull --ff-only origin main
git add \
  "lib/trace-doctor-engine.mjs" \
  "lib/mcp-servers/trace-doctor.mjs" \
  "api/mcp/[flavor].mjs" \
  "api/trace-doctor.mjs" \
  "db/migrations/015_trace_doctor.sql" \
  "src/prototypes/TraceDoctor/TraceDoctorStudio.jsx" \
  "src/App.jsx" \
  "trace-doctor/SLACK-INTEGRATION.md" \
  "trace-doctor/APP-ROUTE.md" \
  "trace-doctor/deploy.sh"

git commit -m "Trace Doctor: in-app trace analyzer route + Slack MCP connector

- lib/trace-doctor-engine.mjs: shared analysis engine (single source of truth
  for the app route, the Slack MCP connector, and the skill).
- api/trace-doctor.mjs: analyze + persist (UPSERT dedupe by trace id, grouped by
  session+slug) + search/list/get. Static-password header gate.
- src/prototypes/TraceDoctor: password-gated UI — upload one/many traces, per-trace
  report + summary, search/browse existing traces grouped by session (no dupes).
- db/migrations/015_trace_doctor.sql: trace_doctor_traces table.
- lib/mcp-servers/trace-doctor.mjs: Slack connector, now importing the shared engine.
- Verified: engine parity vs Python skill (0 diffs), migration + dedupe UPSERT +
  search against real Postgres (PGlite), frontend build, API auth/routing."

echo "==> 3/3  Pushing to main…"
git push origin main

cat <<'NOTE'

Pushed. Vercel will build & deploy sb-navigator-proto from main.

In the app:  https://<your-prod-domain>/prototypes/trace-doctor
  Password:  Staffbase2026!!   (client-side gate, stored in localStorage)

Optional hardening (recommended before wide rollout — traces hold customer data):
  - Vercel → project → Settings → Environment Variables:
      TRACE_DOCTOR_PASS   = <the app password>            (defaults to Staffbase2026!!)
      TRACE_DOCTOR_TOKEN  = <random secret for the Slack connector>
    Redeploy after adding.
  - The Slack connector steps are in trace-doctor/SLACK-INTEGRATION.md.
NOTE
