/**
 * Talent Exchange deterministic Matching Engine (Phase 3A).
 *
 * Public surface. No LLM, no reputation computation, no credits, no Dax, no
 * notifications — only "how suitable is this student for this opportunity?" as
 * structured, explainable, fully-repeatable data.
 */

const matchingEngine = require('./matchingEngine');
const cacheInvalidator = require('./cacheInvalidator');
const scoreCalculator = require('./scoreCalculator');
const reasonBuilder = require('./reasonBuilder');
const weightConfig = require('./weightConfig');
const { RULES } = require('./ruleSet');

module.exports = {
  // scoring
  scoreForUser: matchingEngine.scoreForUser,
  scoreMany: matchingEngine.scoreMany,
  scoreContext: matchingEngine.scoreContext,
  buildContext: matchingEngine.buildContext,
  // cache
  scoreAndCache: matchingEngine.scoreAndCache,
  getCachedOrCompute: matchingEngine.getCachedOrCompute,
  inputsHash: matchingEngine.inputsHash,
  // cache invalidation
  invalidator: cacheInvalidator,
  // internals (for tests / tuning)
  scoreCalculator,
  reasonBuilder,
  weightConfig,
  RULES,
  MODEL_VERSION: matchingEngine.MODEL_VERSION,
};
