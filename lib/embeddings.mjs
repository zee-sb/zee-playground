// OpenAI text embeddings for semantic matching.
//
// Used by the Navigator Setup discovery to embed every Page (so Templates
// and the AI Creator can rank Pages by relevance to a topic without
// re-fetching the source content), and to embed the topic at match-time.
//
// Model: text-embedding-3-small (1536 dims, ~$0.02 per 1M tokens). Cheap
// enough that we don't gate the embedding pass behind a feature flag.

import OpenAI from 'openai';

const MODEL = 'text-embedding-3-small';
const DIM = 1536;

let _client;
function client() {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// Embed a batch of texts. Returns Array<number[1536]> in the same order.
// Trims each input to ~8000 chars (well within the model's 8192-token limit
// for typical English text) to avoid 400s on accidentally-huge pages.
export async function embed(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const trimmed = texts.map((t) => String(t || '').slice(0, 8000));
  const res = await client().embeddings.create({
    model: MODEL,
    input: trimmed,
  });
  return res.data.map((d) => d.embedding);
}

// Cosine similarity between two vectors. Both must be the same length;
// fast path assumes 1536 dims.
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

// Rank a list of {id, vec, …} entries by cosine sim against a topic vector.
// Returns the top `limit` entries, each annotated with `score` ∈ [-1, 1].
export function rankByTopic(topicVec, items, limit = 5) {
  if (!topicVec || !Array.isArray(items)) return [];
  return items
    .map((it) => ({ ...it, score: cosineSim(topicVec, it.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const EMBEDDING_MODEL = MODEL;
export const EMBEDDING_DIM = DIM;
