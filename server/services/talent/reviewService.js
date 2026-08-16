/**
 * ReviewService — bidirectional reviews on a COMPLETED engagement.
 *
 * Phase 2 only records the review and emits review.created. The reputation
 * recompute that consumes it is Phase 3; there is deliberately no trust-score
 * maths here.
 *
 * Anti-manipulation is structural: a review requires a completed engagement the
 * rater took part in, the ratee is derived (never client-supplied), and the
 * unique index {engagement, rater} blocks a second review — so self-review and
 * double-review are impossible by construction.
 */

const TalentReview = require('../../models/TalentReview');
const Engagement = require('../../models/Engagement');
const { badRequest, forbidden, notFound, conflict } = require('./errors');
const { EVENTS, emit } = require('./events');

async function create(userId, engagementId, { rating, comment, onTime, skillsConfirmed } = {}) {
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    throw badRequest('Rating must be a whole number from 1 to 5');
  }

  const eng = await Engagement.findOne({ _id: engagementId, deletedAt: null });
  if (!eng) throw notFound('Engagement not found');
  if (eng.status !== 'completed') throw badRequest('You can only review a completed engagement');

  const isRequester = eng.requester.equals(userId);
  const isHelper = eng.helper.equals(userId);
  if (!isRequester && !isHelper) throw forbidden('You are not part of this engagement');

  // ratee is the OTHER party — derived, never taken from the request.
  const ratee = isRequester ? eng.helper : eng.requester;
  const role = isRequester ? 'as_requester' : 'as_helper';

  let review;
  try {
    review = await TalentReview.create({
      engagement: eng._id,
      rater: userId,
      ratee,
      role,
      rating: numRating,
      onTime: typeof onTime === 'boolean' ? onTime : undefined,
      comment: comment ? String(comment).slice(0, 1000) : undefined,
      skillsConfirmed: Array.isArray(skillsConfirmed)
        ? skillsConfirmed.filter((s) => typeof s === 'string').slice(0, 20)
        : undefined,
    });
  } catch (err) {
    if (err.code === 11000) throw conflict('You have already reviewed this engagement');
    throw err;
  }

  // REPUTATION(Phase 3): a subscriber recomputes ratee's TalentProfile here.
  emit(EVENTS.REVIEW_CREATED, userId, {
    reviewId: review._id,
    engagementId: eng._id,
    ratee,
    rating: numRating,
  });
  return review;
}

/** Public reviews received by a user. Excludes soft-deleted. */
async function listForUser(targetUserId, { limit = 30 } = {}) {
  return TalentReview.find({ ratee: targetUserId, deletedAt: null })
    .populate('rater', 'name avatarUrl')
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 30)))
    .lean();
}

module.exports = { create, listForUser };
