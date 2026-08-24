/**
 * Text → vector, with the identity of whatever produced the vector.
 *
 * There are three possible sources here and they are three different vector
 * spaces, not three ways of doing the same thing. A cosine similarity between a
 * vector from one and a vector from another is a meaningless number — and when
 * the dimensions also differ (NVIDIA's e5 is not 1536-wide, OpenAI's
 * text-embedding-3-small is) cosineSimilarity's length guard returns a flat 0,
 * so a whole search quietly returns nothing and logs nothing.
 *
 * Which source runs depends on which API keys happen to be set, so the space
 * can change between one deploy and the next without a single line of code
 * changing. Every vector therefore travels with the id of the model that made
 * it, and the store compares only within one space. See vectorStore.js.
 */
const OpenAI = require('openai');

// Width of the TF-IDF fallback only. The hosted models pick their own.
const EMBEDDING_DIM = 1536;

// Stable ids, persisted on every stored vector. Changing one of these strings
// invalidates the vectors already written under it — which is the intended
// behaviour, since a renamed model is a different space until proven otherwise.
const EMBEDDING_MODELS = Object.freeze({
  nvidia: 'nvidia:nv-embedqa-e5-v5',
  openai: 'openai:text-embedding-3-small',
  tfidf: 'tfidf:v1',
});

let _openai = null;
let _nvidia = null;

function _getOpenAI() {
  if (_openai) return _openai;
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function _getNvidia() {
  if (_nvidia) return _nvidia;
  _nvidia = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });
  return _nvidia;
}

/**
 * Embed text and say what produced the result.
 *
 * @returns {Promise<{ vector: number[], model: string, dim: number }|null>}
 *   null only when there is nothing to embed.
 */
async function embedWithMeta(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim().slice(0, 8000);
  if (!clean) return null;

  const tag = (vector, model) => ({ vector, model, dim: vector.length });

  // Prefer NVIDIA embeddings when NVIDIA_API_KEY is set
  if (process.env.NVIDIA_API_KEY) {
    try {
      const res = await _getNvidia().embeddings.create({
        model: 'nvidia/nv-embedqa-e5-v5',
        input: clean,
      });
      return tag(res.data[0].embedding, EMBEDDING_MODELS.nvidia);
    } catch (err) {
      console.warn('[embed] NVIDIA embedding failed, falling back:', err.message);
    }
  }

  // Fallback to OpenAI embeddings
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await _getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: clean,
      });
      return tag(res.data[0].embedding, EMBEDDING_MODELS.openai);
    } catch (err) {
      console.warn('[embed] OpenAI embedding failed, falling back to TF-IDF:', err.message);
    }
  }

  // Deterministic TF-IDF fallback
  return tag(_tfidfVector(clean, EMBEDDING_DIM), EMBEDDING_MODELS.tfidf);
}

/**
 * The vector alone.
 *
 * Prefer embedWithMeta() anywhere the result is stored or compared: a bare
 * vector cannot be checked against the space it has to be comparable with.
 */
async function embed(text) {
  const result = await embedWithMeta(text);
  return result ? result.vector : null;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function _tfidfVector(text, dims) {
  const vec = new Array(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  for (const [token, count] of Object.entries(freq)) {
    const idx = _hashStr(token) % dims;
    vec[idx] += count / tokens.length;
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function _hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

module.exports = { embed, embedWithMeta, cosineSimilarity, EMBEDDING_DIM, EMBEDDING_MODELS };
