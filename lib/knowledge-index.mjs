// Builds the knowledge_chunks index that lib/retrieval.mjs searches at runtime.
//
// Shared by scripts/index-knowledge.mjs (build-time, wired into vercel-build)
// and navigator-config?action=reindex (on-demand). Two source types:
//   • kb        — data/kb-documents.mjs, global ('*'), always indexed.
//   • staffbase — live Campsite pages/posts, per tenant, BEST-EFFORT (a flaky
//                 Staffbase API must never fail the build; KB alone still ships
//                 a fully working "knows everything" demo).
//
// Re-index is delete-then-insert per (source_type[, branch]) so it's idempotent.

import crypto from 'node:crypto';
import { sql, dbConfigured } from './db.mjs';
import { embed } from './embeddings.mjs';
import { chunkDocument } from './chunking.mjs';
import { KB_DOCUMENTS } from '../data/kb-documents.mjs';
import { listTenants, getTenantContext } from './tenants.mjs';
import { getConfig, saveConfig } from './workspace-config.mjs';
import { CONNECTIONS } from './seed.mjs';
import {
  withStaffbaseContext, listPages, listRecentPosts, getPost, stripHtml,
} from './staffbase.mjs';

const KNOWLEDGE_CONNECTION = CONNECTIONS.find((c) => c.id === 'knowledge');

const EMBED_BATCH = 64;

function sha(s) { return crypto.createHash('sha256').update(String(s || '')).digest('hex'); }
function vecLiteral(vec) { return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(',')}]`; }

// Embed an array of texts in batches (embed() trims each to 8000 chars).
async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    // eslint-disable-next-line no-await-in-loop
    const vecs = await embed(batch);
    for (const v of vecs) out.push(v);
  }
  return out;
}

// Insert pre-embedded chunk records. `records` = [{ doc_id, chunk_ix, title,
// url, tags, body, last_updated, embedding }]. One INSERT per row keeps this
// robust with the Neon HTTP client; the corpus is small (hundreds of chunks).
async function insertChunks(branchId, sourceType, kbId, records) {
  for (const r of records) {
    // Either a bracketed literal (→ ::vector) or JS null (→ NULL::vector = NULL).
    const emb = Array.isArray(r.embedding) && r.embedding.length ? vecLiteral(r.embedding) : null;
    // eslint-disable-next-line no-await-in-loop
    const tagStr = (r.tags || []).join(' ');
    await sql`
      insert into knowledge_chunks
        (staffbase_branch_id, source_type, kb_id, doc_id, chunk_ix, title, url, tags, body, last_updated, content_hash, embedding, tsv)
      values
        (${branchId}, ${sourceType}, ${kbId}, ${r.doc_id}, ${r.chunk_ix}, ${r.title}, ${r.url || null},
         ${r.tags || []}, ${r.body}, ${r.last_updated || null}, ${sha(r.body)},
         ${emb}::vector,
         setweight(to_tsvector('english', ${r.title || ''}), 'A') ||
         setweight(to_tsvector('english', ${tagStr}), 'B') ||
         setweight(to_tsvector('english', ${r.body || ''}), 'C'))
      on conflict (staffbase_branch_id, source_type, doc_id, chunk_ix)
      do update set title = excluded.title, url = excluded.url, tags = excluded.tags,
                    body = excluded.body, last_updated = excluded.last_updated,
                    content_hash = excluded.content_hash, embedding = excluded.embedding,
                    tsv = excluded.tsv, updated_at = now()
    `;
  }
}

// Turn a list of source documents into embedded chunk records.
async function buildRecords(docs) {
  const records = [];
  const texts = [];
  for (const doc of docs) {
    const chunks = chunkDocument(doc.body);
    chunks.forEach((chunkText, ix) => {
      records.push({
        doc_id: doc.id,
        chunk_ix: ix,
        title: doc.title,
        url: doc.url || null,
        tags: doc.tags || [],
        body: chunkText,
        last_updated: doc.lastUpdated || null,
      });
      // Embed title + chunk so the vector carries the topic even for a
      // body-only fragment.
      texts.push(`${doc.title}\n${chunkText}`);
    });
  }
  const vecs = await embedAll(texts);
  records.forEach((r, i) => { r.embedding = vecs[i] || null; });
  return records;
}

// ── KB docs (global) ─────────────────────────────────────────────────────────
export async function indexKb() {
  if (!dbConfigured()) throw new Error('DATABASE_URL not configured');
  const docs = [];
  for (const [kbId, list] of Object.entries(KB_DOCUMENTS)) {
    for (const d of list) docs.push({ ...d, kbId });
  }
  // Group by kbId so we can carry kb_id onto each record.
  const byKb = new Map();
  for (const d of docs) {
    if (!byKb.has(d.kbId)) byKb.set(d.kbId, []);
    byKb.get(d.kbId).push(d);
  }
  await sql`delete from knowledge_chunks where source_type = 'kb'`;
  let total = 0;
  for (const [kbId, list] of byKb.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const records = await buildRecords(list);
    // eslint-disable-next-line no-await-in-loop
    await insertChunks('*', 'kb', kbId, records);
    total += records.length;
  }
  return { sourceType: 'kb', docs: docs.length, chunks: total };
}

// ── Live Staffbase content (per tenant, best-effort) ─────────────────────────
export async function indexStaffbaseForBranch(branchId) {
  const ctx = await getTenantContext(branchId);
  if (!ctx) return { sourceType: 'staffbase', branchId, skipped: 'no_tenant', chunks: 0 };

  const docs = await withStaffbaseContext(ctx, async () => {
    const out = [];
    // Pages — reference docs / handbooks.
    try {
      const pages = await listPages({ limit: 60 });
      for (const p of pages) {
        const body = stripHtml(p.content || p.body || p.excerpt || p.teaser || '');
        if (!body || body.length < 40) continue;
        out.push({ id: `page:${p.id}`, title: p.title || '(untitled page)', body, url: p.url || null, tags: ['campsite', 'page'], lastUpdated: p.published || null });
      }
    } catch (e) { console.warn('[knowledge-index] listPages:', e.message); }

    // Posts — index the recent set; fetch full content for the top slice.
    try {
      const posts = await listRecentPosts({ limit: 40 });
      const enrichCount = Math.min(posts.length, 20);
      for (let i = 0; i < posts.length; i++) {
        const p = posts[i];
        let body = p.teaser || '';
        if (i < enrichCount) {
          try { const full = await getPost(p.id); body = full.content || full.teaser || body; } catch { /* keep teaser */ }
        }
        body = stripHtml(body || '');
        if (!body || body.length < 40) continue;
        out.push({ id: `post:${p.id}`, title: p.title || '(untitled post)', body, url: p.url || null, tags: ['campsite', 'post', p.channel?.title].filter(Boolean), lastUpdated: p.published || null });
      }
    } catch (e) { console.warn('[knowledge-index] listRecentPosts:', e.message); }

    return out;
  });

  await sql`delete from knowledge_chunks where source_type = 'staffbase' and staffbase_branch_id = ${branchId}`;
  if (!docs.length) return { sourceType: 'staffbase', branchId, docs: 0, chunks: 0 };
  const records = await buildRecords(docs);
  await insertChunks(branchId, 'staffbase', null, records);
  return { sourceType: 'staffbase', branchId, docs: docs.length, chunks: records.length };
}

// Ensure the ambient 'knowledge' search connection exists in a tenant's config
// so the orchestrator's ambient catalog picks it up WITHOUT waiting for a
// client-triggered reseed. Idempotent: no-op if already present. Non-destructive:
// appends to the existing connections, preserving everything else. Best-effort —
// a CAS miss or missing config row just skips (client reseed still covers it).
export async function ensureKnowledgeConnection(branchId) {
  if (!KNOWLEDGE_CONNECTION) return { branchId, skipped: 'no_seed_def' };
  const cfg = await getConfig(branchId).catch(() => null);
  if (!cfg) return { branchId, skipped: 'no_config_row' };
  const has = (cfg.connections || []).some((c) => c.id === 'knowledge');
  if (has) return { branchId, ensured: false };
  try {
    await saveConfig({
      branchId,
      baseRevision: cfg.revision,
      config: {
        connections: [KNOWLEDGE_CONNECTION, ...(cfg.connections || [])],
        workflows: cfg.workflows || [],
        tenantOverrides: cfg.tenantOverrides || {},
      },
    });
    return { branchId, ensured: true };
  } catch (e) {
    return { branchId, skipped: `save_failed: ${e.message}` };
  }
}

// Index everything. KB is required; Staffbase is best-effort per tenant.
export async function indexAll({ includeStaffbase = true } = {}) {
  const results = { kb: null, staffbase: [] };
  results.kb = await indexKb();
  if (includeStaffbase) {
    let tenants = [];
    try { tenants = await listTenants(); } catch (e) { console.warn('[knowledge-index] listTenants:', e.message); }
    results.ensured = [];
    for (const t of tenants) {
      try {
        // eslint-disable-next-line no-await-in-loop
        results.ensured.push(await ensureKnowledgeConnection(t.branchId));
      } catch (e) {
        results.ensured.push({ branchId: t.branchId, skipped: e.message });
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        results.staffbase.push(await indexStaffbaseForBranch(t.branchId));
      } catch (e) {
        console.warn(`[knowledge-index] staffbase ${t.branchId}:`, e.message);
        results.staffbase.push({ sourceType: 'staffbase', branchId: t.branchId, error: e.message });
      }
    }
  }
  return results;
}
