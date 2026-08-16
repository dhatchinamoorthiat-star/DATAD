/**
 * PlacementOutcome — the outcome vault.
 *
 * Records the result of a student's placement attempt. This is the single
 * most defensible dataset DATAD can collect: linking student profile →
 * preparation behavior → actual hiring outcome.
 *
 * Only aggregate, anonymized cohort data is ever shown to anyone other than
 * the student and the placement office. Individual outcomes are never shared
 * with employers or third parties.
 *
 * Product Constitution P7 — "The Outcome Vault is the Moat":
 * If data is not captured the first time, there is no second chance.
 * The longitudinal moat starts with a gap.
 *
 * Collected by: admin placement office (or self-reported by student).
 * Consumed by: cohort intelligence, readiness prediction, employer analytics.
 */
const mongoose = require('mongoose');

const placementOutcomeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    package: {
      type: String,
      trim: true,
      default: '',
    },
    stageReached: {
      type: String,
      enum: ['applied', 'shortlisted', 'gdk', 'interview', 'final-round', 'offered', 'rejected'],
      required: true,
    },
    outcome: {
      type: String,
      enum: ['offer_received', 'rejected', 'withdrew', 'in_progress'],
      required: true,
    },
    offerAccepted: {
      type: Boolean,
      default: false,
    },
    placementDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Optional link to the placement drive in the platform
    drive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      default: null,
    },
    // Verified by admin — unverified outcomes are self-reported and flagged
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One student can have multiple outcomes (applied to multiple companies)
placementOutcomeSchema.index({ user: 1, company: 1 });
// Aggregate queries: by company, by outcome, by date
placementOutcomeSchema.index({ company: 1, outcome: 1 });
placementOutcomeSchema.index({ placementDate: -1 });

module.exports = mongoose.model('PlacementOutcome', placementOutcomeSchema);
