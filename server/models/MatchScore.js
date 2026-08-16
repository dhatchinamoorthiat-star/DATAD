const mongoose = require('mongoose');

/**
 * MatchScore — cached deterministic compatibility between a user and an
 * opportunity, produced by the matching engine (NOT the LLM). Dax only phrases
 * the `reasons` strings; it never generates the `score`.
 *
 * Cached because the Discover feed ranks many opportunities per request and the
 * signals (intelligence-graph scores, track record) change slowly.
 *
 * ── Cache invalidation rules (authoritative) ────────────────────────────────
 * A cached row is served only if it is BOTH unexpired (expiresAt > now, TTL)
 * AND fresh (inputsHash matches the current inputs). It is invalidated /
 * recomputed when any of the following happens:
 *
 *   1. TTL lapse            — expiresAt passes (default horizon: 24h). Backstop
 *                             so slow-moving signals can't go stale forever.
 *   2. inputsHash mismatch  — the fingerprint of the scoring inputs changed:
 *                               • the user's intelligence-graph profileVersion
 *                                 (bumped on profile.refreshed), or
 *                               • the opportunity's updatedAt (edited skills,
 *                                 price, category, status), or
 *                               • the scoring modelVersion (algorithm change).
 *                             matchingEngine recomputes inputsHash per request;
 *                             a mismatch forces a recompute regardless of TTL.
 *   3. Opportunity closed    — on status → matched/completed/cancelled/expired,
 *                             engagementService/opportunityService delete this
 *                             user's rows for it (it can no longer be applied to).
 *   4. Completed engagement  — the reputation recompute bumps profileVersion,
 *                             which changes inputsHash for every future read.
 *
 * Writes use upsert on the unique (user, opportunity) key, so a recompute
 * overwrites rather than duplicating. Rows are never mutated in place beyond
 * that upsert.
 */
const matchScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },

    score: { type: Number, min: 0, max: 100, required: true },
    // Human-readable, factual reasons assembled from data (e.g.
    // "Finance profile + 4 completed data gigs"). Deterministic, not generated.
    reasons: { type: [String], default: [] },

    modelVersion: { type: String, default: null },

    // Freshness fingerprint — see "Cache invalidation rules" above. Composed by
    // matchingEngine from profileVersion + opportunity.updatedAt + modelVersion.
    // Served only when it equals the recomputed hash for the current inputs.
    inputsHash: { type: String, default: null },
    profileVersion: { type: Number, default: null },
    opportunityUpdatedAt: { type: Date, default: null },

    // TTL anchor — see index below.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// One cached score per (user, opportunity).
matchScoreSchema.index({ user: 1, opportunity: 1 }, { unique: true });
// Feed ranking: my best matches first.
matchScoreSchema.index({ user: 1, score: -1 });
// Auto-expire stale scores.
matchScoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MatchScore', matchScoreSchema);
