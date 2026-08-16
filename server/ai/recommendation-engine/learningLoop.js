/**
 * Learning Loop — detects feedback patterns and adjusts generator weights.
 *
 * This closes the first feedback loop in DATAD's recommendation system.
 * When a student dismisses recommendations from the same generator 3+ times,
 * that generator's weight is reduced for that student. If they consistently
 * act on another generator's recommendations, its weight increases.
 *
 * The weights are stored per-user in memory (MongoDB-backed in future).
 */
const Recommendation = require('../../models/Recommendation');

// ── Configuration ─────────────────────────────────────────────────────

const DISMISS_THRESHOLD = 3;          // Dismissals before weight adjustment
const WEIGHT_PENALTY = -0.2;          // Per-threshold weight reduction
const ACT_THRESHOLD = 5;              // Act-ons before weight boost
const WEIGHT_BOOST = 0.1;             // Per-threshold weight increase
const MIN_WEIGHT = 0.0;               // Floor — never fully silence a generator
const MAX_WEIGHT = 2.0;               // Ceiling — never over-boost

// In-memory weight overrides. Keyed by `${userId}:${generatorName}`.
// In a future version these will be persisted in a UserPrefs or similar model.
const _overrides = new Map();

// ── Public API ────────────────────────────────────────────────────────

/**
 * Compute effective weight for a generator, factoring in learned overrides.
 */
function getGeneratorWeight(userId, generatorName, defaultWeight = 1.0) {
  const key = `${userId}:${generatorName}`;
  const override = _overrides.get(key);
  if (override === undefined) return defaultWeight;
  return defaultWeight + override;
}

/**
 * Analyze feedback and update generator weights.
 * Called: (a) when feedback is recorded, (b) periodically by the worker.
 */
async function processFeedback(userId) {
  // Count feedback patterns by recommendation type
  const recs = await Recommendation.find({ user: userId }).lean();

  const dismissals = {};   // generatorName → count
  const actedOn = {};      // generatorName → count

  for (const rec of recs) {
    const type = rec.type;
    const feedbacks = rec.feedback || [];

    for (const fb of feedbacks) {
      if (fb.type === 'never-suggest' || fb.type === 'not-helpful') {
        dismissals[type] = (dismissals[type] || 0) + 1;
      }
      if (fb.type === 'helpful' || rec.lifecycle?.state === 'completed') {
        actedOn[type] = (actedOn[type] || 0) + 1;
      }
    }
  }

  // Apply penalties and boosts
  for (const [type, count] of Object.entries(dismissals)) {
    if (count >= DISMISS_THRESHOLD) {
      const penaltyCount = Math.floor(count / DISMISS_THRESHOLD);
      const totalPenalty = WEIGHT_PENALTY * penaltyCount;
      _setOverride(userId, type, Math.max(MIN_WEIGHT - 1.0, totalPenalty));
    }
  }

  for (const [type, count] of Object.entries(actedOn)) {
    if (count >= ACT_THRESHOLD) {
      const boostCount = Math.floor(count / ACT_THRESHOLD);
      const totalBoost = WEIGHT_BOOST * boostCount;
      _setOverride(userId, type, Math.min(MAX_WEIGHT - 1.0, totalBoost));
    }
  }
}

/**
 * Reset all learned overrides for a user.
 */
function resetUser(userId) {
  for (const key of _overrides.keys()) {
    if (key.startsWith(`${userId}:`)) _overrides.delete(key);
  }
}

/**
 * Reset a single generator's learned weight for a user.
 */
function resetGenerator(userId, generatorName) {
  _overrides.delete(`${userId}:${generatorName}`);
}

function _setOverride(userId, type, value) {
  // Clamp to allowed range
  const clamped = Math.max(MIN_WEIGHT - 1.0, Math.min(MAX_WEIGHT - 1.0, value));
  if (clamped === 0) {
    _overrides.delete(`${userId}:${type}`);
  } else {
    _overrides.set(`${userId}:${type}`, clamped);
  }
}

// ── Event bus integration ─────────────────────────────────────────────

/**
 * Handle a recommendation.feedback.recorded event.
 * Triggers pattern analysis and weight adjustment if threshold is crossed.
 */
async function handleFeedbackEvent(event) {
  const { userId } = event;
  if (!userId) return;
  await processFeedback(userId);

  // Emit a learning event if any weights were adjusted
  const adjusted = [];
  for (const [key, value] of _overrides) {
    if (key.startsWith(`${userId}:`)) {
      adjusted.push({ generator: key.split(':')[1], adjustment: value });
    }
  }
  if (adjusted.length > 0) {
    const events = require('../../events/index');
    await events.emit('generator.reweight', userId, {
      adjustments: adjusted,
    }).catch(() => {});
  }
}

module.exports = {
  getGeneratorWeight,
  processFeedback,
  handleFeedbackEvent,
  resetUser,
  resetGenerator,
};
