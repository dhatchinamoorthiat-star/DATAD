const mongoose = require('mongoose');

/**
 * ModerationCase — a report or dispute against a Talent Exchange entity.
 *
 * Opening a case on an Engagement freezes its escrow until an admin resolves
 * it (release / refund / split), keeping money movement and reputation
 * penalties auditable. Also used for spam / abuse reports on opportunities and
 * profiles.
 */
const MODERATION_SUBJECTS = ['opportunity', 'engagement', 'review', 'profile', 'user'];

const MODERATION_STATE = ['open', 'reviewing', 'resolved', 'dismissed'];

const MODERATION_RESOLUTION = [
  'release',
  'refund',
  'split',
  'warning',
  'removed',
  'no_action',
];

const moderationCaseSchema = new mongoose.Schema(
  {
    subjectType: { type: String, enum: MODERATION_SUBJECTS, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 1000, required: true },

    state: { type: String, enum: MODERATION_STATE, default: 'open', index: true },
    resolution: { type: String, enum: MODERATION_RESOLUTION, default: null },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },

    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Admin queue: open cases oldest first.
moderationCaseSchema.index({ state: 1, createdAt: 1 });

module.exports = mongoose.model('ModerationCase', moderationCaseSchema);
module.exports.MODERATION_SUBJECTS = MODERATION_SUBJECTS;
module.exports.MODERATION_STATE = MODERATION_STATE;
module.exports.MODERATION_RESOLUTION = MODERATION_RESOLUTION;
