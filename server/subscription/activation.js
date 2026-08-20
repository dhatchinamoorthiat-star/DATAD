/**
 * Turning a confirmed payment into access.
 *
 * Two things now grant a paid tier — an admin reviewing a manual UPI transfer,
 * and Razorpay confirming a captured payment — and they must agree exactly on
 * what a purchase buys. This used to live inline in the admin review route, so
 * adding a gateway would have meant a second copy free to drift from the first.
 */
const User = require('../models/User');
const notificationService = require('../notifications/NotificationService');
const { expiryFor } = require('./pricing');
const logger = require('../utils/logger');

const fmtDate = (d) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * When the new access should end.
 *
 * A renewal stacks on top of whatever is left rather than replacing it. Under
 * manual review this was mostly theoretical — a student had no reason to pay
 * early. With a gateway it is not: renewing a monthly plan on day 25 would
 * otherwise silently burn the last five days the student already paid for.
 * Stacking only applies within the same tier; switching plans starts fresh.
 */
function nextExpiry(user, tier, billing, now = new Date()) {
  const current = user?.tierExpiresAt ? new Date(user.tierExpiresAt) : null;
  const sameTierStillRunning = user?.tier === tier && current && current > now;
  return expiryFor(tier, billing, sameTierStillRunning ? current : now);
}

/**
 * Approve a pending SubscriptionRequest and grant the tier it paid for.
 *
 * Idempotent: a request that is no longer pending is left untouched and
 * reported as `{ activated: false }`. Both callers can be invoked twice for the
 * same payment — an admin double-click, or Razorpay's webhook arriving after
 * the browser already confirmed the same payment — and neither may extend the
 * subscription a second time.
 *
 * @param {import('mongoose').Document} request  a pending SubscriptionRequest
 * @returns {Promise<{activated: boolean, expiresAt?: Date}>}
 */
async function activateSubscription(request, { reviewedBy = null, reviewNote = '' } = {}) {
  if (!request || request.status !== 'pending') {
    return { activated: false, expiresAt: request?.status === 'approved' ? request.reviewedAt : undefined };
  }

  // `user` may already be populated (the admin route fetches name/email for its
  // response), so reduce it to an id before anything queries on it.
  const userId = request.user?._id || request.user;

  const user = await User.findById(userId).select('tier tierExpiresAt').lean();
  if (!user) {
    logger.error('Cannot activate subscription: user missing', { request: String(request._id) });
    return { activated: false };
  }

  const expiresAt = nextExpiry(user, request.tier, request.billing);

  request.status = 'approved';
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date();
  request.reviewNote = reviewNote || '';
  await request.save();

  await User.findByIdAndUpdate(userId, {
    $set: { tier: request.tier, subscriptionRef: request.paymentRef, tierExpiresAt: expiresAt },
  });

  await notificationService.send(userId, {
    type: 'billing',
    title: 'Subscription activated! 🎉',
    body: `Your ${request.tier} plan is now active — valid until ${fmtDate(expiresAt)}`,
    link: '/subscribe',
  });

  logger.info('Subscription activated', {
    request: String(request._id),
    tier: request.tier,
    billing: request.billing,
    provider: request.provider,
    expiresAt,
  });

  return { activated: true, expiresAt };
}

/**
 * Reject a pending request and tell the student why. Also idempotent.
 */
async function rejectSubscription(request, { reviewedBy = null, reviewNote = '' } = {}) {
  if (!request || request.status !== 'pending') return { rejected: false };

  request.status = 'rejected';
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date();
  request.reviewNote = reviewNote || '';
  await request.save();

  await notificationService.send(request.user?._id || request.user, {
    type: 'billing',
    title: 'Payment review update',
    body: reviewNote
      ? `Your payment was not approved: ${reviewNote}`
      : 'Your payment request was not approved. Please submit a new payment reference.',
    link: '/subscribe',
  });

  return { rejected: true };
}

module.exports = { activateSubscription, rejectSubscription, nextExpiry };
