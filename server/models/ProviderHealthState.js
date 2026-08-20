const mongoose = require('mongoose');

/**
 * Durable circuit-breaker state for one AI provider.
 *
 * The breaker (ai/runtime-v2/circuitBreaker.js) keeps its state in module
 * scope, which has two consequences that only show up in production:
 *
 *   1. It dies on restart. A provider benched at 2pm for exhausting its free
 *      daily quota is forgotten by the next deploy, and the chain goes back to
 *      paying a failed round-trip on every request until it re-learns.
 *   2. It is per-process. Render can run more than one instance, and each one
 *      independently rediscovers that a provider is rate-limited — so the
 *      wasted-request problem is multiplied by the instance count rather than
 *      solved.
 *
 * This collection is the shared, durable copy. It is deliberately NOT the
 * authority on the request path: reads there stay synchronous and in-memory,
 * and this is reconciled in the background. See ai/providerHealthStore.js for
 * the merge rule and why it errs toward keeping a provider benched.
 */
const providerHealthStateSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, unique: true, index: true },

    // 'closed' | 'open' | 'half_open' — mirrors circuitBreaker.STATE.
    circuitState: { type: String, required: true, default: 'closed' },

    consecutiveFailures: { type: Number, default: 0 },

    // When an open breaker becomes eligible for trial traffic again. This,
    // rather than circuitState alone, is what other instances act on: a stale
    // 'open' row left behind by a crashed process expires on its own instead
    // of benching a healthy provider forever.
    openUntil: { type: Date, default: null },

    lastFailureAt: { type: Date, default: null },
    lastFailureKind: { type: String, default: null },
    lastStateChange: { type: Date, default: Date.now },

    // Which process wrote this last — useful when two instances disagree.
    instanceId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ProviderHealthState ||
  mongoose.model('ProviderHealthState', providerHealthStateSchema);
