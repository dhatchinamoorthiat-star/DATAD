const mongoose = require('mongoose');

/**
 * Application — a helper expressing interest in an Opportunity.
 *
 * One person may apply to an opportunity at most once (unique index), which is
 * the structural guard against application spam. Accepting an Application is
 * what creates an Engagement (see engagementService); the Application itself
 * never moves money.
 */
const APPLICATION_STATUS = ['pending', 'shortlisted', 'accepted', 'declined', 'withdrawn'];

const applicationSchema = new mongoose.Schema(
  {
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    pitch: { type: String, trim: true, maxlength: 2000 },
    proposedCredits: { type: Number, min: 0, default: null },

    status: { type: String, enum: APPLICATION_STATUS, default: 'pending', index: true },

    // Deterministic compatibility snapshot at apply time (0..100), copied from
    // the matching engine so the requester sees why this applicant surfaced.
    matchScore: { type: Number, min: 0, max: 100, default: null },
    matchReasons: { type: [String], default: [] },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One application per person per opportunity — blocks duplicate applications.
applicationSchema.index({ opportunity: 1, applicant: 1 }, { unique: true });
// Requester's view: applicants to my opportunity, best match first.
applicationSchema.index({ opportunity: 1, matchScore: -1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUS = APPLICATION_STATUS;
