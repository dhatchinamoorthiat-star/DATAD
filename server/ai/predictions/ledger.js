/**
 * The prediction ledger — recording, reading and scoring Dax's own forecasts.
 *
 * Recording is deliberately narrow. Predictions come only from the structured
 * places where Dax already produces forward-looking output on a deterministic
 * path (currently recommendation-engine/goalProgress.js and weeklyReview.js),
 * never from parsing free-form chat: a regex that mistakes "you should be ready
 * in a month" for a commitment would fill the ledger with claims Dax never made
 * and then score itself against them. Chat-sourced predictions are a later
 * phase and will need the model to emit a structured claim, not a parser to
 * guess at one.
 */
const DaxPrediction = require('../../models/DaxPrediction');
const { SCORE_METRICS, SIGNAL_METRICS } = require('../intelligence-layer/trends');

const VALID_METRICS = new Set([...SCORE_METRICS, ...SIGNAL_METRICS]);
const VALID_COMPARATORS = new Set(['gte', 'lte', 'eq']);

// A claim resolvable only against a snapshot cannot outrun the snapshot
// history, and a horizon so short that no snapshot lands inside it resolves as
// nothing but noise.
const MIN_HORIZON_DAYS = 3;
const MAX_HORIZON_DAYS = 180;

/**
 * Record one forward-looking claim.
 *
 * Idempotent per (user, metric, source) while a matching claim is still
 * pending: these callers run on every page load of a review or progress
 * screen, and one visit to a screen is not a new prediction.
 *
 * @returns the stored document, or null when the claim was malformed or a
 *          live one already covers it.
 */
async function recordPrediction({
  userId, statement, metric, predictedValue, comparator = 'gte',
  horizonDays, sourceTask = null, model = null, provider = null,
}) {
  if (!userId || !statement || !VALID_METRICS.has(metric)) return null;
  if (!VALID_COMPARATORS.has(comparator)) return null;
  if (typeof predictedValue !== 'number' || !Number.isFinite(predictedValue)) return null;

  const horizon = Math.round(horizonDays);
  if (!Number.isFinite(horizon) || horizon < MIN_HORIZON_DAYS || horizon > MAX_HORIZON_DAYS) return null;

  const existing = await DaxPrediction.findOne({
    user: userId, metric, sourceTask, outcome: 'pending',
  }).lean();
  if (existing) return null;

  const predictedAt = new Date();
  return DaxPrediction.create({
    user: userId,
    statement: String(statement).slice(0, 500),
    metric,
    predictedValue,
    comparator,
    horizonDays: horizon,
    predictedAt,
    resolveBy: new Date(predictedAt.getTime() + horizon * 24 * 60 * 60 * 1000),
    sourceTask,
    model,
    provider,
  });
}

/** Does `actual` satisfy the claim? */
function evaluate(comparator, actual, predicted) {
  if (comparator === 'gte') return actual >= predicted;
  if (comparator === 'lte') return actual <= predicted;
  return actual === predicted;
}

/**
 * Dax's track record for one student.
 *
 * `accuracy` counts hits against resolved predictions only — pending ones are
 * not evidence either way, and unresolvable ones say something about the
 * snapshot history, not about Dax's judgement. Misses are returned in full and
 * in the same list as hits; nothing here filters, ranks or softens them.
 */
async function getAccuracy(userId, { recentLimit = 10 } = {}) {
  if (!userId) return { total: 0, hits: 0, misses: 0, accuracy: null, recent: [] };

  const [rows, recent] = await Promise.all([
    DaxPrediction.find({ user: userId }).select('outcome').lean(),
    DaxPrediction.find({ user: userId, outcome: { $in: ['hit', 'miss', 'partial'] } })
      .sort({ resolvedAt: -1 })
      .limit(recentLimit)
      .lean(),
  ]);

  const count = (o) => rows.filter((r) => r.outcome === o).length;
  const hits = count('hit');
  const misses = count('miss');
  const partial = count('partial');
  const resolved = hits + misses + partial;

  return {
    total: rows.length,
    hits,
    misses,
    partial,
    pending: count('pending'),
    unresolvable: count('unresolvable'),
    resolved,
    // null, not 0 and not 100: with nothing resolved there is no track record
    // to report, and inventing one either way would be the dishonest option.
    accuracy: resolved > 0 ? Math.round((hits / resolved) * 100) : null,
    recent: recent.map((p) => ({
      statement: p.statement,
      metric: p.metric,
      predictedValue: p.predictedValue,
      comparator: p.comparator,
      actualValue: p.actualValue,
      outcome: p.outcome,
      predictedAt: p.predictedAt,
      resolvedAt: p.resolvedAt,
      horizonDays: p.horizonDays,
    })),
  };
}

module.exports = {
  recordPrediction,
  getAccuracy,
  evaluate,
  VALID_METRICS,
  MIN_HORIZON_DAYS,
  MAX_HORIZON_DAYS,
};
