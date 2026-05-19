-- Navigator Analytics: per-conversation summary + evaluator scores.
--
-- Two new tables back the Studio Analytics tab:
--
--   conversation_summary  — 1:1 with conversations. Holds the bucketed
--                            topic, resolution state, reported-issue status,
--                            device/mode/language, plus admin-visible
--                            intent reasoning. Sibling table (not columns
--                            on conversations) so the chat write hot path
--                            stays untouched and we can recompute summaries
--                            without locking conversations.
--
--   conversation_evals     — long form, one row per (conversation, dimension).
--                            Heterogeneous evaluator shapes survive (numeric
--                            0..1, categorical label, pass/fail flag) without
--                            nullable bloat. Adding a new evaluator ships
--                            without DDL.
--
-- The `unique (conversation_id, dimension, evaluator, evaluator_version)` key
-- lets us cleanly overwrite a seeded row when langfuse later writes the same
-- dimension with `source='langfuse'`.

create table if not exists conversation_summary (
  conversation_id    uuid primary key references conversations(id) on delete cascade,
  summary            text,
  primary_topic      text,
  resolution_state   text not null default 'processing'
                     check (resolution_state in ('resolved','processing','unresolved','escalated')),
  reported_issue     text not null default 'none'
                     check (reported_issue in ('none','inaccurate','unhelpful','inappropriate','other')),
  device             text,
  mode               text,
  language           text,
  intent_in_scope    boolean,
  intent_reasoning   text,
  message_count      integer not null default 0,
  tool_call_count    integer not null default 0,
  has_low_score      boolean not null default false,
  computed_at        timestamptz not null default now(),
  computed_version   text not null default 'v1'
);

create index if not exists conv_summary_topic_idx
  on conversation_summary (primary_topic);

create index if not exists conv_summary_resolution_idx
  on conversation_summary (resolution_state);

create index if not exists conv_summary_reported_issue_idx
  on conversation_summary (reported_issue)
  where reported_issue <> 'none';

create index if not exists conv_summary_low_score_idx
  on conversation_summary (has_low_score)
  where has_low_score = true;

create index if not exists conv_summary_lang_idx
  on conversation_summary (language);

create table if not exists conversation_evals (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references conversations(id) on delete cascade,
  dimension          text not null,
  score_type         text not null check (score_type in ('numeric','label','flag')),
  score_numeric      double precision,
  score_label        text,
  score_flag         boolean,
  reasoning          text,
  evaluator          text not null default 'seed_v1',
  evaluator_version  text not null default '1',
  source             text not null default 'seed'
                     check (source in ('seed','langfuse','manual')),
  created_at         timestamptz not null default now(),
  unique (conversation_id, dimension, evaluator, evaluator_version)
);

create index if not exists conv_evals_conv_dim_idx
  on conversation_evals (conversation_id, dimension);

create index if not exists conv_evals_dim_score_idx
  on conversation_evals (dimension, score_numeric)
  where score_numeric is not null;
