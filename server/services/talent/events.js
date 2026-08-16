/**
 * Talent Exchange domain events.
 *
 * Phase 2 EMITS ONLY. There are deliberately no subscribers here yet:
 * notification delivery and analytics aggregation are later phases. The single
 * mechanism is the existing DATAD event bus (events/index.js → BusEvent), so
 * this is not a second architecture — it is the same emit() every other pillar
 * uses. Future notification/analytics handlers register against these types.
 *
 * Event type strings obey the BusEvent taxonomy regex
 *   /^[a-z]+\.[a-z]+(-[a-z]+)?$/
 * i.e. `domain.action`. Payloads carry the ids a future notification subscriber
 * needs (e.g. who to notify), so no handler will have to re-fetch to route a
 * notification.
 */

const bus = require('../../events');
const logger = require('../../utils/logger');

const EVENTS = {
  OPPORTUNITY_CREATED: 'opportunity.created',
  OPPORTUNITY_UPDATED: 'opportunity.updated',
  OPPORTUNITY_CLOSED: 'opportunity.closed',

  APPLICATION_SUBMITTED: 'application.submitted',
  APPLICATION_WITHDRAWN: 'application.withdrawn',
  APPLICATION_ACCEPTED: 'application.accepted',
  APPLICATION_REJECTED: 'application.rejected',

  ENGAGEMENT_STARTED: 'engagement.started',
  ENGAGEMENT_SUBMITTED: 'engagement.submitted',
  ENGAGEMENT_COMPLETED: 'engagement.completed',
  ENGAGEMENT_CANCELLED: 'engagement.cancelled',

  REVIEW_CREATED: 'review.created',
};

/**
 * Fire-and-forget emit. `actorUserId` is the user the event is attributed to
 * (BusEvent.userId is required and indexed). Never throws into the caller: a
 * failed emit must not roll back a committed business action, so it is logged
 * and swallowed.
 */
function emit(type, actorUserId, data = {}) {
  return Promise.resolve(bus.emit(type, actorUserId, data)).catch((err) => {
    logger.warn(`[talent/events] failed to emit ${type}: ${err.message}`);
  });
}

module.exports = { EVENTS, emit };
