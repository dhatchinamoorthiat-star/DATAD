/**
 * CacheInvalidator — deletes stale MatchScore rows so the next read recomputes.
 *
 * The engine already refuses a cached row whose inputsHash no longer matches, so
 * these deletions are an eager complement: they clear rows the moment a driving
 * input changes, rather than waiting for the next read to notice.
 *
 * Invalidation triggers (per Phase 3A spec) → which rows to drop:
 *   Resume updated      → this user's rows           (invalidateForUser)
 *   SIG updated         → this user's rows           (invalidateForUser)
 *   Skill changes       → this user's rows           (invalidateForUser)
 *   Review added        → the reviewed user's rows   (invalidateForUser ratee)
 *   Engagement completed→ both participants' rows     (invalidateForUsers)
 *   Opportunity updated → that opportunity's rows     (invalidateForOpportunity)
 *
 * This module only knows how to invalidate. Wiring it to the event bus is left
 * to an integration step (no bus subscribers are registered here), but
 * `handleEvent` maps a domain event to the right call for that wiring/tests.
 */

const MatchScore = require('../../models/MatchScore');

async function invalidateForUser(userId) {
  if (!userId) return { deletedCount: 0 };
  return MatchScore.deleteMany({ user: userId });
}

async function invalidateForUsers(userIds = []) {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return { deletedCount: 0 };
  return MatchScore.deleteMany({ user: { $in: ids } });
}

async function invalidateForOpportunity(opportunityId) {
  if (!opportunityId) return { deletedCount: 0 };
  return MatchScore.deleteMany({ opportunity: opportunityId });
}

/** Map a domain event (or synthetic trigger) to the correct invalidation. */
async function handleEvent(type, data = {}) {
  switch (type) {
    case 'opportunity.updated':
    case 'opportunity.closed':
      return invalidateForOpportunity(data.opportunityId);

    case 'review.created':
      return invalidateForUser(data.ratee);

    case 'engagement.completed':
      return invalidateForUsers([data.requester, data.helper]);

    // SIG / resume / skill changes surface as these (or callers invoke
    // invalidateForUser directly).
    case 'profile.refreshed':
    case 'profile.refresh-needed':
    case 'resume.updated':
    case 'skills.changed':
      return invalidateForUser(data.userId);

    default:
      return { deletedCount: 0, skipped: true };
  }
}

module.exports = {
  invalidateForUser,
  invalidateForUsers,
  invalidateForOpportunity,
  handleEvent,
};
