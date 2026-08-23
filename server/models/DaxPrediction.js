/**
 * A forward-looking claim Dax made about a student, recorded so it can be
 * checked against what actually happened.
 *
 * This is the honesty ledger. Any assistant can say "you'll be ready in five
 * weeks"; almost none can be shown, five weeks later, to have been wrong. Every
 * prediction here is resolved against the student's own StudentProfileSnapshot
 * history and surfaced with its outcome — misses included, and shown as
 * prominently as hits. Softening or hiding a miss defeats the entire feature.
 */
const mongoose = require('mongoose');

const daxPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // The sentence as it was (or would be) said to the student. Stored verbatim
    // so the ledger can show the actual claim rather than a reconstruction of
    // it from the numbers.
    statement: { type: String, required: true, maxlength: 500 },

    // Which snapshot field settles this: a score field or a `signals.*` counter.
    // See ai/intelligence-layer/trends.js for the accepted names.
    metric: { type: String, required: true },
    predictedValue: { type: Number, required: true },
    comparator: { type: String, enum: ['gte', 'lte', 'eq'], required: true },

    horizonDays: { type: Number, required: true },
    predictedAt: { type: Date, default: Date.now },
    resolveBy: { type: Date, required: true },

    resolvedAt: { type: Date, default: null },
    actualValue: { type: Number, default: null },
    outcome: {
      type: String,
      enum: ['pending', 'hit', 'miss', 'partial', 'unresolvable'],
      default: 'pending',
    },

    // Where the claim came from — a Recommendation, a weekly review, etc.
    sourceTask: { type: String, default: null },
    // Only set when a model produced the claim. Predictions recorded from
    // deterministic paths leave these null, and that is the honest record:
    // attributing arithmetic to an LLM would misstate where the claim came from.
    model: { type: String, default: null },
    provider: { type: String, default: null },
  },
  { timestamps: true }
);

// The resolver's only query: everything still pending whose day has come.
daxPredictionSchema.index({ outcome: 1, resolveBy: 1 });
// The student-facing list, newest first.
daxPredictionSchema.index({ user: 1, predictedAt: -1 });

module.exports =
  mongoose.models.DaxPrediction
  || mongoose.model('DaxPrediction', daxPredictionSchema);
