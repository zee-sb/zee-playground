// Runtime hybrid retrieval over the knowledge_chunks index.
//
// Two arms, fused with Reciprocal Rank Fusion (RRF):
//   • semantic — pgvector cosine (`<=>`) via the HNSW index. Needs the query
//                embedded once per call (~150ms), wrapped in a timeout.
//   • keyword  — Postgres full-text (`websearch_to_tsquery`) over the weighted
//                `tsv` column. No embedding needed; always available.
//
// RRF is scale-agnostic (it fuses *ranks*, not raw scores) so it stays robust
// when one arm is empty — e.g. the embedding call times out and we fall back to
// keyword-only. `retrieve()` NEVER throws: any failure degrades to [] or to the
// surviving arm, so a flaky embedding API can't break a live demo turn.

import { sql, dbConfigured } from './db.mjs';
import { embed } from './embeddings.mjs';

const RRF_K = 60;             // standard RRF damping constant
const ARM_DEPTH = 24;         // rows to pull from each arm before fusing
const EMBED_TIMEOUT_MS = 2500; // cap the runtime query embed; fall back on miss
const SNIPPET_CHARS = 260;

function toVectorLiteral(vec) {
  // pgvector accepts a bracketed list cast to ::vector.
  return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(',')}]`;
}

async function embedQuery(query) {
  try {
    const race = await Promise.race([
      embed([query]),
      new Promise((resolve) => setTimeout(() => resolve(null), EMBED_TIMEOUT_MS)),
    ]);
    const vec = Array.isArray(race) ? race[0] : null;
    return Array.isArray(vec) && vec.length ? vec : null;
  } catch {
    return null;
  }
}

function snippetOf(body) {
  const s = String(body || '').replace(/\s+/g, ' ').trim();
  return s.length > SNIPPET_CHARS ? `${s.slice(0, SNIPPET_CHARS - 1).trimEnd()}…` : s;
}

// Main entry. Returns citation-ready passages, best-first:
//   { id, docId, title, snippet, body, url, sourceType, kbId, lastUpdated, score }
export async function retrieve(query, {
  limit = 5,
  branchId = '*',
  sourceTypes = null, // e.g. ['kb'] | ['staffbase'] | null (=all)
} = {}) {
  const q = String(query || '').trim();
  if (!q || !dbConfigured()) return [];

  const branch = branchId || '*';
  const typeFilter = Array.isArray(sourceTypes) && sourceTypes.length ? sourceTypes : null;

  // Run both arms in parallel; each is independently guarded.
  const [semantic, keyword] = await Promise.all([
    semanticArm(q, branch, typeFilter).catch(() => []),
    keywordArm(q, branch, typeFilter).catch(() => []),
  ]);

  // Reciprocal Rank Fusion over row id.
  const fused = new Map(); // rowId -> { row, score }
  const fold = (rows) => {
    rows.forEach((row, i) => {
      const prev = fused.get(row.id);
      const contrib = 1 / (RRF_K + i + 1);
      if (prev) prev.score += contrib;
      else fused.set(row.id, { row, score: contrib });
    });
  };
  fold(semantic);
  fold(keyword);

  // Dedup to one best chunk per source document, then take the top `limit`.
  const byDoc = new Map(); // docId -> { row, score }
  for (const entry of fused.values()) {
    const key = `${entry.row.source_type}:${entry.row.doc_id}`;
    const prev = byDoc.get(key);
    if (!prev || entry.score > prev.score) byDoc.set(key, entry);
  }

  return [...byDoc.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: row.doc_id,
      docId: row.doc_id,
      title: row.title,
      snippet: snippetOf(row.body),
      body: row.body,
      url: row.url || null,
      sourceType: row.source_type,
      kbId: row.kb_id || null,
      lastUpdated: row.last_updated || null,
      score: Number(score.toFixed(6)),
    }));
}

async function semanticArm(q, branch, typeFilter) {
  const vec = await embedQuery(q);
  if (!vec) return []; // embedding unavailable → let keyword carry the turn
  const lit = toVectorLiteral(vec);
  if (typeFilter) {
    return await sql`
      select id, doc_id, source_type, kb_id, title, url, body, last_updated
      from knowledge_chunks
      where embedding is not null
        and (staffbase_branch_id = ${branch} or staffbase_branch_id = '*')
        and source_type = any(${typeFilter})
      order by embedding <=> ${lit}::vector
      limit ${ARM_DEPTH}
    `;
  }
  return await sql`
    select id, doc_id, source_type, kb_id, title, url, body, last_updated
    from knowledge_chunks
    where embedding is not null
      and (staffbase_branch_id = ${branch} or staffbase_branch_id = '*')
    order by embedding <=> ${lit}::vector
    limit ${ARM_DEPTH}
  `;
}

async function keywordArm(q, branch, typeFilter) {
  if (typeFilter) {
    return await sql`
      select id, doc_id, source_type, kb_id, title, url, body, last_updated
      from knowledge_chunks
      where tsv @@ websearch_to_tsquery('english', ${q})
        and (staffbase_branch_id = ${branch} or staffbase_branch_id = '*')
        and source_type = any(${typeFilter})
      order by ts_rank(tsv, websearch_to_tsquery('english', ${q})) desc
      limit ${ARM_DEPTH}
    `;
  }
  return await sql`
    select id, doc_id, source_type, kb_id, title, url, body, last_updated
    from knowledge_chunks
    where tsv @@ websearch_to_tsquery('english', ${q})
      and (staffbase_branch_id = ${branch} or staffbase_branch_id = '*')
    order by ts_rank(tsv, websearch_to_tsquery('english', ${q})) desc
    limit ${ARM_DEPTH}
  `;
}
