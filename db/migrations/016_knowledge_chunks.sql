-- Runtime hybrid-retrieval index ("Navigator knows everything").
--
-- One row per chunk of retrievable content. Two source types share the table:
--   'kb'        — hand-written policy docs (data/kb-documents.mjs). Global, so
--                 staffbase_branch_id = '*' (a sentinel meaning "all tenants").
--   'staffbase' — live Campsite pages/posts, tenant-scoped by branch id.
--
-- The retrieval query (lib/retrieval.mjs) runs two arms and fuses them:
--   • semantic — pgvector cosine (`<=>`) over `embedding`, ANN via HNSW.
--   • keyword  — full-text over the generated, weighted `tsv` (title > tags > body).
-- Pushing both arms into Postgres keeps the wire payload to the top-K rows
-- instead of streaming every 1536-float vector into the Vercel function.
--
-- Re-indexing (scripts/index-knowledge.mjs) is delete-then-insert per source,
-- so `content_hash` is advisory only (lets a future incremental pass skip
-- unchanged chunks).

create extension if not exists vector;

create table if not exists knowledge_chunks (
  id                  uuid primary key default gen_random_uuid(),
  staffbase_branch_id text not null default '*',   -- '*' = global (KB docs)
  source_type         text not null,               -- 'kb' | 'staffbase'
  kb_id               text,                         -- e.g. 'kb-hr' (kb sources only)
  doc_id              text not null,                -- stable source document id
  chunk_ix            integer not null default 0,   -- position within the doc
  title               text not null,
  url                 text,                         -- deep link back to the source, when known
  tags                text[] not null default '{}',
  body                text not null,                -- the chunk text (what gets cited)
  last_updated        text,                         -- source's own "last updated" label
  content_hash        text,                         -- sha of body, for incremental re-index
  embedding           vector(1536),                 -- text-embedding-3-small; null if embed failed

  -- Weighted lexical vector: title (A) > tags (B) > body (C). Populated at
  -- insert time by the indexer (a GENERATED column can't use to_tsvector with a
  -- text config — not immutable). Re-index is delete-then-insert, so it stays fresh.
  tsv                 tsvector,

  updated_at          timestamptz not null default now(),

  unique (staffbase_branch_id, source_type, doc_id, chunk_ix)
);

-- ANN index for the semantic arm. HNSW builds instantly at this corpus size and
-- degrades gracefully (planner falls back to a scan) if it can't be used.
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Inverted index for the keyword arm.
create index if not exists knowledge_chunks_tsv_idx
  on knowledge_chunks using gin (tsv);

-- Branch-scoped reads (global rows share the '*' sentinel).
create index if not exists knowledge_chunks_branch_idx
  on knowledge_chunks (staffbase_branch_id, source_type);
