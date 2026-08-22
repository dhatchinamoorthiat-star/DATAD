/**
 * Phase 2 — Semantic Search API
 * High-level search over all content types.
 * Each search type fetches the hydrated docs after finding IDs via vector search.
 */

const { semanticSearch } = require('./vectorStore');
const Note    = require('../../models/Note');
const NewsItem = require('../../models/NewsItem');
const Company  = require('../../models/Company');
const DailyCase = require('../../models/DailyCase');
const Post     = require('../../models/Post');
const ResumeTip = require('../../models/ResumeTip');

const COLLECTIONS = {
  notes:    { model: Note,     fields: 'title subject content' },
  news:     { model: NewsItem, fields: 'title summary category publishedAt' },
  companies:{ model: Company,  fields: 'name sector overview' },
  cases:    { model: DailyCase,fields: 'title category scenario' },
  posts:    { model: Post,     fields: 'title body' },
  tips:     { model: ResumeTip,fields: 'title tip category' },
};

/**
 * Search across one or more content types.
 * @param {string}   query
 * @param {string[]} [collections] - Defaults to all
 * @param {number}   [k=5]
 * @param {string}   [userId]      - Scope notes to a user
 */
async function search({ query, collections, k = 5, userId }) {
  const targets = collections || Object.keys(COLLECTIONS);
  const results = {};

  await Promise.all(
    targets.map(async (col) => {
      const cfg = COLLECTIONS[col];
      if (!cfg) return;

      const hits = await semanticSearch({ query, collection: col, k, threshold: 0.25 });
      if (!hits.length) { results[col] = []; return; }

      const ids = hits.map((h) => h.docId);
      const filter = { _id: { $in: ids } };
      // Note ownership is `author`, not `user` — filtering on a field the
      // schema doesn't have matched nothing, so scoped note search silently
      // returned zero results for every student. Same defect that was already
      // fixed in ai/memory.js's bootstrapMemory() note count.
      //
      // Notes are private, and the vector index is shared across every student,
      // so this filter is the only thing keeping one student's note bodies out
      // of another's results. `userId` was optional: omitting it skipped the
      // filter and returned everyone's notes. Both current callers pass it, so
      // this closes a latent hazard rather than a live leak — but the failure
      // mode of a forgotten argument should be no results, not every result.
      if (col === 'notes') {
        if (!userId) { results[col] = []; return; }
        filter.author = userId;
      }

      const docs = await cfg.model
        .find(filter)
        .select(cfg.fields)
        .lean();

      // Re-attach scores
      const scoreMap = Object.fromEntries(hits.map((h) => [h.docId.toString(), h.score]));
      results[col] = docs
        .map((d) => ({ ...d, _score: scoreMap[d._id.toString()] || 0 }))
        .sort((a, b) => b._score - a._score);
    })
  );

  return results;
}

module.exports = { search, COLLECTIONS };
