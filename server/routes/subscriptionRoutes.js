const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { heavyLimiter } = require('../middleware/rateLimiters');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const User = require('../models/User');
const { notify } = require('../controllers/notificationController');
const { getSubscriptionStatus, getRemainingAiQuota } = require('../subscription/subscriptionService');
const { getEffectiveTier } = require('../subscription/permissionEngine');

const razorpay = require('../payments/razorpay');
const { activateSubscription, rejectSubscription } = require('../subscription/activation');
const logger = require('../utils/logger');

const { priceFor, cyclesFor } = require('../subscription/pricing');

/**
 * Resolve a requested plan against the server's own price table.
 *
 * Shared by the manual-UPI and Razorpay paths so there is exactly one place
 * that decides what a plan costs. The client never gets a say: an amount a
 * browser claims is not evidence of anything, and with a gateway involved it
 * would be an open invitation to buy the Placement Pass for ₹1.
 */
function resolvePlan(body) {
  const { tier } = body;
  if (!['pro', 'placement'].includes(tier)) {
    return { error: 'Invalid plan. Must be pro or placement.' };
  }
  // Default per tier rather than trusting the client: placement is only ever
  // sold as a one-time pass, Pro only as monthly or yearly.
  const allowedCycles = cyclesFor(tier);
  const billing = allowedCycles.includes(body.billing) ? body.billing : allowedCycles[0];

  const amount = priceFor(tier, billing);
  if (amount === null) {
    return { error: 'That plan and billing combination is not available.' };
  }
  return { tier, billing, amount };
}

// GET /api/subscription/config — which checkout the client should render.
// The key id is public by design (Checkout needs it in the browser), but it
// lives here rather than in a VITE_ variable so the server stays the single
// source of truth for whether the gateway is actually usable.
router.get('/config', verifyToken, (req, res) => {
  res.json({
    gateway: razorpay.isConfigured() ? 'razorpay' : 'manual',
    keyId: razorpay.isConfigured() ? razorpay.publicKeyId() : null,
    testMode: razorpay.isTestMode(),
  });
});

// POST /api/subscription/order — open a Razorpay order for the chosen plan
router.post('/order', verifyToken, heavyLimiter, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({ message: 'Card/UPI checkout is not available yet. Please pay by UPI transfer instead.' });
    }

    const plan = resolvePlan(req.body);
    if (plan.error) return res.status(400).json({ message: plan.error });

    const order = await razorpay.createOrder({
      amountPaise: plan.amount * 100,
      receipt: `sub_${Date.now().toString(36)}_${String(req.user.userId).slice(-8)}`,
      notes: { userId: String(req.user.userId), tier: plan.tier, billing: plan.billing },
    });

    // Recorded as pending up front so an abandoned checkout still leaves a
    // trail, and so the webhook has a row to find even if the browser closes
    // between paying and confirming.
    const request = await SubscriptionRequest.create({
      user: req.user.userId,
      tier: plan.tier,
      billing: plan.billing,
      amountPaid: plan.amount,
      provider: 'razorpay',
      razorpayOrderId: order.id,
      paymentRef: order.id,
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpay.publicKeyId(),
      requestId: request._id,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscription/verify — confirm a payment the browser just completed.
// The webhook is the authority; this exists so a student who paid successfully
// gets access in the same second rather than whenever the webhook lands.
router.post('/verify', verifyToken, heavyLimiter, async (req, res, next) => {
  try {
    const orderId = req.body.razorpay_order_id;
    const paymentId = req.body.razorpay_payment_id;
    const signature = req.body.razorpay_signature;

    if (!razorpay.verifyCheckoutSignature({ orderId, paymentId, signature })) {
      logger.warn('Rejected Razorpay checkout with a bad signature', {
        user: String(req.user.userId), orderId,
      });
      return res.status(400).json({ message: 'Could not verify that payment. Nothing has been charged twice — contact support with your payment id.' });
    }

    // Scoped to the caller: a valid signature proves the payment is real, not
    // that it belongs to whoever is presenting it.
    const request = await SubscriptionRequest.findOne({
      razorpayOrderId: orderId,
      user: req.user.userId,
    });
    if (!request) return res.status(404).json({ message: 'Order not found' });

    if (request.status === 'approved') {
      // The webhook got there first. Not an error.
      const user = await User.findById(req.user.userId).select('tier tierExpiresAt').lean();
      return res.json({ message: 'Payment already confirmed.', tier: user?.tier, expiresAt: user?.tierExpiresAt });
    }

    request.razorpayPaymentId = paymentId;
    request.paymentRef = paymentId;
    const { activated, expiresAt } = await activateSubscription(request, { reviewNote: 'Razorpay checkout' });

    res.json({
      message: activated ? 'Payment confirmed — your plan is active.' : 'Payment recorded.',
      tier: request.tier,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscription/webhook — Razorpay's server-to-server confirmation.
 *
 * Unauthenticated by necessity: Razorpay has no session. The signature over the
 * raw body is the authentication, so this must run before anything that could
 * make the parsed body and the raw bytes disagree.
 *
 * Always answers 200 for anything it understood, including events it ignores —
 * a non-2xx makes Razorpay retry the same event for hours.
 */
router.post('/webhook', async (req, res) => {
  if (!razorpay.isWebhookConfigured()) {
    logger.warn('Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is unset');
    return res.status(503).json({ message: 'Webhooks not configured' });
  }

  if (!razorpay.verifyWebhookSignature(req.rawBody, req.get('x-razorpay-signature'))) {
    logger.warn('Rejected Razorpay webhook with a bad signature');
    return res.status(400).json({ message: 'Invalid signature' });
  }

  try {
    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    if (!payment?.order_id) return res.json({ ok: true, ignored: event });

    const request = await SubscriptionRequest.findOne({ razorpayOrderId: payment.order_id });
    if (!request) {
      logger.warn('Razorpay webhook for an unknown order', { orderId: payment.order_id, event });
      return res.json({ ok: true });
    }

    if (event === 'payment.captured') {
      // The order was created with the price from our own table, so this should
      // never diverge — but money that does not match the plan is not something
      // to grant access on and then discover later.
      if (payment.amount !== request.amountPaid * 100) {
        logger.error('Razorpay payment amount does not match the plan', {
          orderId: payment.order_id, paid: payment.amount, expected: request.amountPaid * 100,
        });
        return res.json({ ok: true, mismatch: true });
      }
      request.razorpayPaymentId = payment.id;
      request.paymentRef = payment.id;
      await activateSubscription(request, { reviewNote: 'Razorpay webhook' });
    } else if (event === 'payment.failed') {
      request.razorpayPaymentId = payment.id;
      await rejectSubscription(request, {
        reviewNote: payment.error_description || 'Payment failed at the gateway',
      });
    }

    res.json({ ok: true });
  } catch (err) {
    // Swallowed on purpose: an exception here would answer 5xx and put Razorpay
    // into a retry loop over a bug of ours. The event is logged for replay from
    // the dashboard instead.
    logger.error('Razorpay webhook handler failed', { error: err.message });
    res.json({ ok: true, handled: false });
  }
});

// POST /api/subscription/request — submit a payment reference for review
router.post('/request', verifyToken, heavyLimiter, async (req, res, next) => {
  try {
    const { paymentRef, upiId, note } = req.body;

    const plan = resolvePlan(req.body);
    if (plan.error) return res.status(400).json({ message: plan.error });
    const { tier, billing, amount: amountPaid } = plan;

    if (!paymentRef?.trim()) {
      return res.status(400).json({ message: 'Payment reference number is required.' });
    }

    // Prevent duplicate pending requests for the same ref
    const existing = await SubscriptionRequest.findOne({
      paymentRef: paymentRef.trim(),
      status: 'pending',
    });
    if (existing) {
      return res.status(409).json({ message: 'This payment reference is already submitted and pending review.' });
    }

    const request = await SubscriptionRequest.create({
      user: req.user.userId,
      tier,
      billing,
      amountPaid,
      provider: 'upi_manual',
      paymentRef: paymentRef.trim(),
      upiId: upiId?.trim() || undefined,
      note: note?.trim() || undefined,
    });

    res.status(201).json({
      message: 'Payment reference submitted. The admin will verify and activate your plan within 24 hours.',
      requestId: request._id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/subscription/me — current user's requests + tier
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const status = await getSubscriptionStatus(req.user.userId);
    if (!status) return res.status(404).json({ message: 'User not found' });

    const requests = await SubscriptionRequest.find({ user: req.user.userId })
      .sort({ createdAt: -1 }).limit(10).lean();

    res.json({
      tier: status.tier,
      effectiveTier: status.effectiveTier,
      // So the page can describe how payment actually works right now rather
      // than hard-coding "manually verified within 24 hours".
      gateway: razorpay.isConfigured() ? 'razorpay' : 'manual',
      tierExpiresAt: status.tierExpiresAt,
      trialUsed: status.trialUsed,
      requests,
      aiUsage: status.aiQuota,
      credits: status.credits,
      chatQuota: status.chatQuota,
      capabilities: status.capabilities,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscription/trial — self-service 14-day trial activation
router.post('/trial', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('tier trialStartedAt').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.trialStartedAt) {
      return res.status(400).json({ message: 'You have already used your free trial.' });
    }
    if (getEffectiveTier(user) !== 'free') {
      return res.status(400).json({ message: 'Trial is only available on the free plan. Downgrade first if you want to try again.' });
    }

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(req.user.userId, {
      tier: 'trial',
      trialStartedAt: new Date(),
      tierExpiresAt: trialEnd,
    });

    notify({ user: req.user.userId, type: 'subscription', title: '14-day Pro trial activated!', body: `Full access until ${trialEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, link: '/subscribe' }).catch(() => {});
    res.json({ message: 'Trial activated! You have 14 days of Pro features.', expiresAt: trialEnd });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
