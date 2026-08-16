const mongoose = require('mongoose');

/**
 * TalentProfile — a materialised projection of a student's Talent Exchange
 * standing, recomputed by reputationService on `engagement.completed` and by a
 * nightly job. It is a cache: every field is derivable from Engagements +
 * TalentReviews (plus a legacy SkillRating seed), so it can be rebuilt at any
 * time. Kept materialised because the Discover feed and profile pages read it
 * on every request and cannot afford live aggregation.
 *
 * trustScore is produced by the reputation algorithm (Bayesian-weighted
 * rating, completion/on-time/response, verification, recency, fraud discount)
 * and only ever moves after completed engagements.
 */
const talentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    skills: [
      {
        name: { type: String, trim: true, maxlength: 40 },
        confirmedCount: { type: Number, default: 0 },
        verified: { type: Boolean, default: false },
      },
    ],

    completedCount: { type: Number, default: 0 },
    responseRatePct: { type: Number, min: 0, max: 100, default: null },
    completionRatePct: { type: Number, min: 0, max: 100, default: null },
    onTimePct: { type: Number, min: 0, max: 100, default: null },

    avgRating: { type: Number, min: 0, max: 5, default: null },
    ratingCount: { type: Number, default: 0 },
    // Seed prior carried over from legacy SkillRating so early trust scores are
    // not built on a single review. Excluded from "reviews received" lists.
    legacyRatingSeed: {
      avg: { type: Number, default: null },
      count: { type: Number, default: 0 },
    },

    trustScore: { type: Number, min: 0, max: 100, default: 0, index: true },

    // Full, explainable derivation of trustScore. reputationService writes this
    // every time it recomputes, so the score is never a black box: the profile
    // UI and any audit can show exactly which components produced it and how
    // much each contributed. `contribution` values sum (× volumeConfidence) to
    // trustScore. algoVersion lets us recompute/compare when weights change.
    trustBreakdown: {
      components: [
        {
          key: { type: String },        // 'quality' | 'reliability' | 'responsiveness' | 'verification' | 'consistency'
          label: { type: String },      // human-readable, for the UI
          raw: { type: Number },        // normalised 0..1 input value
          weight: { type: Number },     // weight applied
          contribution: { type: Number }, // points added to the 0..100 score
        },
      ],
      volumeConfidence: { type: Number, min: 0, max: 1, default: 0 }, // caps new/low-volume users
      fraudDiscount: { type: Number, min: 0, max: 1, default: 0 },    // reciprocal/self-dealing penalty applied
      algoVersion: { type: String, default: null },
      computedAt: { type: Date, default: null },
    },

    // Derived from thresholds by reputationService — never awarded manually.
    badges: { type: [String], default: [] },

    portfolioRefs: [
      {
        engagement: { type: mongoose.Schema.Types.ObjectId, ref: 'Engagement' },
        title: { type: String, trim: true, maxlength: 200 },
        url: { type: String, trim: true, maxlength: 500 },
      },
    ],
    linkedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],

    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TalentProfile', talentProfileSchema);
