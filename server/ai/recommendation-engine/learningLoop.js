/**
 * Learning Loop — detects feedback patterns and adjusts generator weights.
 *
 * This closes the first feedback loop in DATAD's recommendation system.
 * When a student dismisses recommendations from the same generator 3+ times,
 * that generator's weight is reduced for that student. If they consistently
 * act on another generator's recommendations, its weight increases.
 *
 * Weights persist in the GeneratorWeight collection and are read through a
 * short-lived in-process cache. getGeneratorWeight() stays synchronous because
 * it is called once per generator inside the recommendation loop; a database
 * round trip there would be eleven queries per generation. Callers that want
 * fresh weights await loadUserWeights(userId) once beforehand — see
 * recommendation-engine/index.js.
 */
const Recommendation = require('../../models/Recommendation');
const GeneratorWeight = require('../../models/GeneratorWeight');

// ── Configuration ─────────────────────────────────────────────────────

const DISMISS_THRESHOLD = 3;          // Dismissals before weight adjustment
const WEIGHT_PENALTY = -0.2;          // Per-threshold weight reduction
const ACT_THRESHOLD = 5;              // Act-ons before weight boost
const WEIGHT_BOOST = 0.1;             // Per-threshold weight increase
const MIN_WEIGHT = 0.0;               // Floor — never fully silence a generator
const MAX_WEIGHT = 2.0;               // Ceiling — never over-boost

// How long a loaded user's weights are trusted without re-reading. Weights
// change only on feedback, and the write path refreshes the cache itself, so
// this exists to catch changes made by *another* process, not by this one.
const CACHE_TTL_MS = 5 * 60 * 1000;

// Read-through cache. `${userId}:${generatorName}` → adjustment.
const _overrides = new Map();
// userId → epoch ms of its last load, so a miss can be told apart from a
// genuine "this user has no adjustments".
const _loadedAt = new Map();

// ── Cache plumbing ────────────────────────────────────────────────────

function _isFresh(userId) {
  const at = _loadedAt.get(String(userId));
  return at !== undefined && Date.now() - at < CACHE_TTL_MS;
}

function _cacheUser(userId, rows) {
  const prefix = `${userId}:`;
  for (const key of [..._overrides.keys()]) {
    if (key.startsWith(prefix)) _overrides.delete(key);
  }
  for (const row of rows) {
    if (row.adjustment) _overrides.set(`${userId}:${row.generator}`, row.adjustment);
  }
  _loadedAt.set(String(userId), Date.now());
}

/**
 * Pull this user's learned weights into the cache. Cheap and idempotent: a
 * no-op while the cached copy is fresh. Safe to call on every generation.
 */
async function loadUserWeights(userId) {
  if (!userId || _isFresh(userId)) return;
  try {
    const rows = await GeneratorWeight.find({ user: userId }).select('generator adjustment').lean();
    _cacheUser(userId, rows || []);
  } catch (err) {
    // A weights read failing must never cost the student their recommendations
    // — defaults are a perfectly good fallback.
    console.warn('[learning-loop] Failed to load weights:', err.message);
  }
}

/** Drop cached state. Test seam, and used after a reset. */
function _clearCache(userId) {
  if (userId === undefined) {
    _overrides.clear();
    _loadedAt.clear();
    return;
  }
  const prefix = `${userId}:`;
  for (const key of [..._overrides.keys()]) {
    if (key.startsWith(prefix)) _overrides.delete(key);
  }
  _loadedAt.delete(String(userId));
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Compute effective weight for a generator, factoring in learned overrides.
 * Reads the cache only — call loadUserWeights(userId) first if the weights
 * must reflect what is in the database right now.
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
      await _setOverride(userId, type, Math.max(MIN_WEIGHT - 1.0, totalPenalty));
    }
  }

  for (const [type, count] of Object.entries(actedOn)) {
    if (count >= ACT_THRESHOLD) {
      const boostCount = Math.floor(count / ACT_THRESHOLD);
      const totalBoost = WEIGHT_BOOST * boostCount;
      await _setOverride(userId, type, Math.min(MAX_WEIGHT - 1.0, totalBoost));
    }
  }
}

/**
 * Reset all learned overrides for a user.
 */
async function resetUser(userId) {
  _clearCache(userId);
  await GeneratorWeight.deleteMany({ user: userId });
}

/**
 * Reset a single generator's learned weight for a user.
 */
async function resetGenerator(userId, generatorName) {
  _overrides.delete(`${userId}:${generatorName}`);
  await GeneratorWeight.deleteOne({ user: userId, generator: generatorName });
}

async function _setOverride(userId, type, value) {
  // Clamp to allowed range
  const clamped = Math.max(MIN_WEIGHT - 1.0, Math.min(MAX_WEIGHT - 1.0, value));
  // Write through: the cache is updated with the value that reached the
  // database, so a reader in this process never sees a weight that a crash
  // between the two writes would have rolled back.
  if (clamped === 0) {
    _overrides.delete(`${userId}:${type}`);
    await GeneratorWeight.deleteOne({ user: userId, generator: type });
  } else {
    await GeneratorWeight.updateOne(
      { user: userId, generator: type },
      { $set: { adjustment: clamped }, $setOnInsert: { user: userId, generator: type } },
      { upsert: true }
    );
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
  loadUserWeights,
  processFeedback,
  handleFeedbackEvent,
  resetUser,
  resetGenerator,
  _clearCache,
  MIN_WEIGHT,
  MAX_WEIGHT,
};
