-- Trace Doctor: stored Langfuse trace analyses for the in-app /trace-doctor route.
--
-- One row per analyzed trace. Dedupe is by `dedupe_key` (the Langfuse trace id
-- when present, else a synthesized session:env:hash), so re-uploading the same
-- trace UPSERTs instead of creating a duplicate. Traces that share a
-- (session_id, environment) — i.e. the same session + slug — are grouped in the
-- UI into one session so the list shows no duplicates.
--
-- raw_trace is kept so a report can be regenerated if the engine improves.

create table if not exists trace_doctor_traces (
  id            uuid primary key default gen_random_uuid(),
  dedupe_key    text not null unique,
  trace_id      text,
  session_id    text,
  environment   text,                    -- the Langfuse "slug" / tenant
  user_id       text,
  question      text,                    -- trace.input (the user's opening message)
  trace_ts      timestamptz,             -- original trace timestamp
  status        text not null,           -- HEALTHY | MINOR | NEEDS_FIX | UNSCORABLE
  summary       text,                    -- one-line verdict + root-cause layer
  findings      jsonb not null default '[]'::jsonb,
  signals       jsonb not null default '{}'::jsonb,
  report_md     text,                    -- full single-trace markdown report
  raw_trace     jsonb,                   -- original export (for re-analysis)
  uploaded_by   text,                    -- free-form uploader label (optional)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_tdt_session_env on trace_doctor_traces (session_id, environment);
create index if not exists idx_tdt_env         on trace_doctor_traces (environment);
create index if not exists idx_tdt_status      on trace_doctor_traces (status);
create index if not exists idx_tdt_created     on trace_doctor_traces (created_at desc);
create index if not exists idx_tdt_trace_id    on trace_doctor_traces (trace_id);
