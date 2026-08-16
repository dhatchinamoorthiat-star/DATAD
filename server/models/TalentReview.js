const mongoose = require('mongoose');

/**
 * TalentReview — a bidirectional rating attached to a completed Engagement.
 *
 * A review can only be written once per (engagement, rater), and only for an
 * engagement the rater took part in — enforced in reputationService before
 * create. This is the structural defence against self-review and rating
 * manipulation: no completed engagement ⇒ no review ⇒ no reputation change.
 *
 * Legacy SkillRating rows are NOT migrated into this collection (they have no
 * engagement); they seed TalentProfile.avgRating as a prior instead.
 */
const REVIEW_ROLE = ['as_requester', 'as_helper'];

const talentReviewSchema = new mongoose.Schema(
  {
    engagement: { type: mongoose.Schema.Types.ObjectId, ref: 'Engagement', required: true, index: true },
    rater: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ratee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Which side the rater was on — separates "rating my helper" from
    // "rating my requester" for the reputation algorithm.
    role: { type: String, enum: REVIEW_ROLE, required: true },

    rating: { type: Number, min: 1, max: 5, required: true },
    onTime: { type: Boolean, default: null },
    comment: { type: String, trim: true, maxlength: 1000 },
    skillsConfirmed: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One review per rater per engagement.
talentReviewSchema.index({ engagement: 1, rater: 1 }, { unique: true });
// Profile page: all reviews received, newest first.
talentReviewSchema.index({ ratee: 1, createdAt: -1 });

module.exports = mongoose.model('TalentReview', talentReviewSchema);
module.exports.REVIEW_ROLE = REVIEW_ROLE;
