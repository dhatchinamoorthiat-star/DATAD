/**
 * Every stored vector carries the model that produced it, and search compares
 * only within one space.
 *
 * The defect this guards against was silent in both directions. embed() picked
 * NVIDIA, OpenAI or a TF-IDF fallback purely on which API keys were set, so the
 * space could change between deploys with no code change. Vectors from
 * different spaces then met in cosineSimilarity, which either returned a flat 0
 * on a width mismatch (search returns nothing, logs nothing) or — worse — a
 * plausible number when the widths happened to agree.
 *
 * safeEnv strips every provider key, so embedding here always resolves to the
 * deterministic TF-IDF path. That is the point: the assertions are about
 * provenance and filtering, not about any hosted model.
 *
 * No database, no network.
 */

const { embed, embedWithMeta, EMBEDDING_MODELS, EMBEDDING_DIM } = require('../ai/embeddings/embed');
const { upsertEmbedding, semanticSearch, VectorEntry } = require('../ai/embeddings/vectorStore');

const OBJECT_ID = require('mongoose').Types.ObjectId;

/** Stand in for the three chained calls vectorStore makes on a find(). */
function mockFind(rows) {
  return () => ({ select: () => ({ lean: async () => rows }) });
}

let warnings = [];
beforeEach(() => {
  warnings = [];
  jest.spyOn(console, 'warn').mockImplementation((msg) => warnings.push(String(msg)));
});
afterEach(() => jest.restoreAllMocks());

describe('embedWithMeta', () => {
  it('names the model that produced the vector', async () => {
    const result = await embedWithMeta('discounted cash flow');

    expect(result.model).toBe(EMBEDDING_MODELS.tfidf);
    expect(Array.isArray(result.vector)).toBe(true);
  });

  it('reports the width it actually produced, not an assumed one', async () => {
    const result = await embedWithMeta('discounted cash flow');

    expect(result.dim).toBe(result.vector.length);
    expect(result.dim).toBe(EMBEDDING_DIM);
  });

  it('returns null when there is nothing to embed', async () => {
    expect(await embedWithMeta('')).toBeNull();
    expect(await embedWithMeta('   ')).toBeNull();
    expect(await embedWithMeta(null)).toBeNull();
  });

  it('still exposes the bare vector for callers that only need one', async () => {
    const vector = await embed('discounted cash flow');
    expect(Array.isArray(vector)).toBe(true);
    expect(await embed('')).toBeNull();
  });
});

describe('upsertEmbedding', () => {
  it('persists the space alongside the vector', async () => {
    let written = null;
    VectorEntry.findOneAndUpdate = async (_filter, update) => {
      written = update.$set;
      return written;
    };

    await upsertEmbedding({ collection: 'notes', docId: new OBJECT_ID(), text: 'valuation basics' });

    expect(written.embeddingModel).toBe(EMBEDDING_MODELS.tfidf);
    expect(written.dim).toBe(written.vector.length);
  });

  it('writes nothing when there is nothing to embed', async () => {
    let called = false;
    VectorEntry.findOneAndUpdate = async () => { called = true; };

    const result = await upsertEmbedding({ collection: 'notes', docId: new OBJECT_ID(), text: '  ' });

    expect(result).toBeNull();
    expect(called).toBe(false);
  });
});

describe('semanticSearch stays inside one embedding space', () => {
  it('asks the database for the active space rather than filtering afterwards', async () => {
    let filter = null;
    VectorEntry.find = (f) => { filter = f; return { select: () => ({ lean: async () => [] }) }; };
    VectorEntry.countDocuments = async () => 0;

    await semanticSearch({ query: 'valuation', collection: 'notes' });

    expect(filter).toEqual({ sourceCollection: 'notes', embeddingModel: EMBEDDING_MODELS.tfidf });
  });

  it('scores the rows that are in the active space', async () => {
    const { vector } = await embedWithMeta('valuation basics');
    const docId = new OBJECT_ID();
    VectorEntry.find = mockFind([
      { docId, vector, metadata: {}, text: 'valuation basics' },
    ]);
    VectorEntry.countDocuments = async () => 1;

    const hits = await semanticSearch({ query: 'valuation basics', collection: 'notes' });

    expect(hits).toHaveLength(1);
    expect(hits[0].docId).toBe(docId);
    expect(hits[0].score).toBeGreaterThan(0.9);
  });

  it('says so loudly when every stored vector is in a different space', async () => {
    // What a key change looks like from here: rows exist, none are comparable.
    VectorEntry.find = mockFind([]);
    VectorEntry.countDocuments = async () => 42;

    const hits = await semanticSearch({ query: 'valuation', collection: 'notes' });

    expect(hits).toEqual([]);
    const warning = warnings.find((w) => w.includes('vectorStore'));
    expect(warning).toBeDefined();
    // The count, the active space and the remedy — enough to act on without
    // reading this file.
    expect(warning).toContain('42');
    expect(warning).toContain(EMBEDDING_MODELS.tfidf);
    expect(warning).toMatch(/re-embed/i);
  });

  it('stays quiet when the collection is simply empty', async () => {
    VectorEntry.find = mockFind([]);
    VectorEntry.countDocuments = async () => 0;

    const hits = await semanticSearch({ query: 'valuation', collection: 'notes' });

    expect(hits).toEqual([]);
    expect(warnings.filter((w) => w.includes('vectorStore'))).toHaveLength(0);
  });
});
