/**
 * Precomputed, k-anonymous aggregates for one cohort.
 *
 * This is what lets Dax say something a general-purpose chatbot structurally
 * cannot — "students in your batch who converted this drive had more
 * applications in by this point than you do" — without any student's data
 * leaving their own account.
 *
 * Three properties are load-bearing and are enforced upstream in
 * ai/cohort/cohortInsights.js:
 *   - no document is ever written for a cohort below COHORT_MIN_MEMBERS;
 *   - a document holds counts and averages only, never a user reference, name,
 *     or any per-student row;
 *   - a converted/unconverted split is written only when *both* sides clear the
 *     minimum on their own, because a split of 8 into 7 and 1 describes that 1.
 */
const mongoose = require('mongoose');

// Averages for one group of students. Every field is a mean over `members`.
const aggregateSchema = new mongoose.Schema(
  {
    members: { type: Number, required: true },
    careerReadiness: { type: Number, default: null },
    applicationsCount: { type: Number, default: null },
    resumeCompletion: { type: Number, default: null },
    consistency: { type: Number, default: null },
    streak: { type: Number, default: null },
    studyMinutes: { type: Number, default: null },
  },
  { _id: false }
);

const cohortInsightSchema = new mongoose.Schema(
  {
    // The cohort's identity — public dimensions only. `cohortKey` is their
    // normalised join, and the idempotency key for the nightly rebuild.
    cohortKey: { type: String, required: true, unique: true },
    batch: { type: String, default: '' },
    college: { type: String, default: '' },
    program: { type: String, default: '' },

    memberCount: { type: Number, required: true },

    // Everyone in the cohort with a usable snapshot.
    overall: { type: aggregateSchema, required: true },
    // The interesting comparison, and null whenever either side is too small
    // to be reported without describing an individual.
    converted: { type: aggregateSchema, default: null },
    notConverted: { type: aggregateSchema, default: null },
    // Share of the cohort with an accepted or received offer, as a percentage.
    conversionPct: { type: Number, default: null },

    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

cohortInsightSchema.index({ batch: 1, college: 1, program: 1 });

module.exports =
  mongoose.models.CohortInsight
  || mongoose.model('CohortInsight', cohortInsightSchema);
