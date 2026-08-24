/**
 * Phase 2 — Vector Store
 * MongoDB-backed vector storage and nearest-neighbour search.
 * Stores embeddings alongside the source document reference.
 * For datasets < 50k docs cosine similarity in JS is fast enough.
 * Upgrade path: replace with MongoDB Atlas Vector Search or Pinecone.
 */

const mongoose = require('mongoose');
const { embedWithMeta, cosineSimilarity } = require('./embed');

// ── Schema ─────────────────────────────────────────────────────────────────

const vectorEntrySchema = new mongoose.Schema({
  sourceCollection: { type: String, required: true, index: true }, // source collection name
  docId:      { type: mongoose.Schema.Types.ObjectId, required: true },
  text:       { type: String, maxlength: 8000 },
  vector:     { type: [Number], required: true },
  // Which model produced `vector`, and how wide it came out. Required, because
  // a vector whose space is unknown cannot be compared with anything: see the
  // header of embed.js. Rows written before this field existed have neither,
  // and are excluded from search rather than silently scored against a space
  // they do not belong to.
  embeddingModel: { type: String, required: true, index: true },
  dim:        { type: Number, required: true },
  metadata:   { type: Object, default: {} },
  updatedAt:  { type: Date, default: Date.now, index: true },
}, { collection: 'vectorstore' });

vectorEntrySchema.index({ sourceCollection: 1, docId: 1 }, { unique: true });
// Search always narrows to one collection within one embedding space.
vectorEntrySchema.index({ sourceCollection: 1, embeddingModel: 1 });

const VectorEntry = mongoose.models.VectorEntry
  || mongoose.model('VectorEntry', vectorEntrySchema);

// ── Write ──────────────────────────────────────────────────────────────────

/**
 * Upsert an embedding for a document.
 */
async function upsertEmbedding({ collection, docId, text, metadata = {} }) {
  const embedded = await embedWithMeta(text);
  if (!embedded) return null;

  const { vector, model, dim } = embedded;

  return VectorEntry.findOneAndUpdate(
    { sourceCollection: collection, docId },
    {
      $set: {
        sourceCollection: collection,
        text,
        vector,
        // Stored together, always. A vector written without its space is the
        // bug this field exists to prevent.
        embeddingModel: model,
        dim,
        metadata,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * Find the top-k most similar documents in a collection.
 * @param {string}   query      - Natural language query
 * @param {string}   collection - Which collection to search
 * @param {number}   [k=5]     - Number of results
 * @param {number}   [threshold=0.3] - Minimum similarity
 */
async function semanticSearch({ query, collection, k = 5, threshold = 0.3 }) {
  const embedded = await embedWithMeta(query);
  if (!embedded) return [];
  const { vector: queryVec, model } = embedded;

  // Only vectors from the same model are comparable, so the space is a query
  // condition rather than something checked after the fact. Previously every
  // row was loaded and scored: rows from another space with a different width
  // scored a flat 0 via cosineSimilarity's length guard, and rows from another
  // space with the *same* width scored a plausible-looking number that meant
  // nothing at all. The second is the more dangerous of the two.
  const candidates = await VectorEntry.find({ sourceCollection: collection, embeddingModel: model })
    .select('docId vector metadata text')
    .lean();

  // Whatever is left is in a space nothing can currently be compared against —
  // written by a previous key configuration, or before this field existed.
  // Silence here is what made the original defect invisible, so it is stated
  // plainly and with the remedy attached.
  if (!candidates.length) {
    const stranded = await VectorEntry.countDocuments({ sourceCollection: collection });
    if (stranded > 0) {
      console.warn(
        `[vectorStore] "${collection}": 0 of ${stranded} vectors are in the active `
        + `embedding space (${model}), so search cannot return anything. Re-embed the `
        + `collection, or restore the API key configuration that wrote the existing rows.`
      );
    }
    return [];
  }

  const scored = candidates
    .map((c) => ({ ...c, score: cosineSimilarity(queryVec, c.vector) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored.map((c) => ({
    docId: c.docId,
    score: parseFloat(c.score.toFixed(4)),
    metadata: c.metadata,
    snippet: (c.text || '').slice(0, 200),
  }));
}

module.exports = { upsertEmbedding, semanticSearch, VectorEntry };
