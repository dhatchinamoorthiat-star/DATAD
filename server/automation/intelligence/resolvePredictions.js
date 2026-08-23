/**
 * Daily job — settle every prediction whose day has come.
 *
 * Reality is read from the student's own StudentProfileSnapshot history, never
 * recomputed live: a prediction made for the 23rd must be judged against the
 * 23rd, not against whenever the resolver happened to run.
 *
 * When no snapshot exists near the horizon the prediction is marked
 * `unresolvable`. That is deliberate and it is the whole discipline of this
 * file: guessing at the answer, or quietly extending the deadline until the
 * numbers agree, would turn the accuracy figure into decoration.
 */
const { runJob } = require('../jobRunner');
const DaxPrediction = require('../../models/DaxPrediction');
const StudentProfileSnapshot = require('../../models/StudentProfileSnapshot');
const { evaluate } = require('../../ai/predictions/ledger');
const { fieldPath } = require('../../ai/intelligence-layer/trends');

// How far either side of resolveBy a snapshot may sit and still count as
// evidence for that date. Wide enough to absorb a missed cron run or a student
// who was inactive for a couple of days; narrow enough that the reading is
// still about the moment the claim was aimed at.
const SNAPSHOT_WINDOW_DAYS = parseInt(process.env.PREDICTION_SNAPSHOT_WINDOW_DAYS || '3', 10);

const dayMs = 24 * 60 * 60 * 1000;
const toKey = (d) => new Date(d).toISOString().slice(0, 10);

function readMetric(snapshot, metric) {
  const path = fieldPath(metric);
  if (!path) return null;
  const value = path.startsWith('signals.') ? snapshot.signals?.[metric] : snapshot[metric];
  return typeof value === 'number' ? value : null;
}

/**
 * The snapshot nearest `resolveBy` inside the window that actually carries a
 * reading for this metric. A snapshot that exists but recorded null for the
 * metric is not evidence.
 */
async function findNearestSnapshot(userId, resolveBy, metric) {
  const target = new Date(resolveBy);
  const rows = await StudentProfileSnapshot.find({
    user: userId,
    dateKey: {
      $gte: toKey(target.getTime() - SNAPSHOT_WINDOW_DAYS * dayMs),
      $lte: toKey(target.getTime() + SNAPSHOT_WINDOW_DAYS * dayMs),
    },
  }).lean();

  const usable = rows.filter((r) => readMetric(r, metric) !== null);
  if (!usable.length) return null;

  const targetKey = toKey(target);
  return usable.sort((a, b) =>
    Math.abs(new Date(a.dateKey) - new Date(targetKey))
    - Math.abs(new Date(b.dateKey) - new Date(targetKey))
  )[0];
}

/** Settle one prediction. Returns its new outcome. */
async function resolveOne(prediction) {
  const snapshot = await findNearestSnapshot(prediction.user, prediction.resolveBy, prediction.metric);

  if (!snapshot) {
    await DaxPrediction.updateOne(
      // The outcome guard is what makes a re-run safe: a prediction another
      // pass already settled no longer matches, so it cannot be resolved twice.
      { _id: prediction._id, outcome: 'pending' },
      { $set: { outcome: 'unresolvable', resolvedAt: new Date() } }
    );
    return 'unresolvable';
  }

  const actualValue = readMetric(snapshot, prediction.metric);
  const outcome = evaluate(prediction.comparator, actualValue, prediction.predictedValue)
    ? 'hit'
    : 'miss';

  await DaxPrediction.updateOne(
    { _id: prediction._id, outcome: 'pending' },
    { $set: { outcome, actualValue, resolvedAt: new Date() } }
  );
  return outcome;
}

async function resolvePredictions() {
  return runJob('prediction-resolve', async () => {
    const due = await DaxPrediction.find({
      outcome: 'pending',
      resolveBy: { $lte: new Date() },
    }).lean();

    const counts = { hit: 0, miss: 0, unresolvable: 0, failed: 0 };

    for (const prediction of due) {
      try {
        counts[await resolveOne(prediction)] += 1;
      } catch (err) {
        counts.failed += 1;
        console.warn(`[prediction-resolve] ${prediction._id} failed: ${err.message}`);
      }
    }

    console.log(
      `[prediction-resolve] ${due.length} due: ${counts.hit} hit, ${counts.miss} miss, `
      + `${counts.unresolvable} unresolvable, ${counts.failed} failed`
    );
    return { itemsProcessed: due.length, meta: counts };
  });
}

module.exports = { resolvePredictions, resolveOne, findNearestSnapshot, SNAPSHOT_WINDOW_DAYS };
