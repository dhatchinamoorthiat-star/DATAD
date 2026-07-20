const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { heavyLimiter } = require('../middleware/rateLimiters');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const User = require('../models/User');
const { notify } = require('../controllers/notificationController');
const { getSubscriptionStatus, getRemainingAiQuota } = require('../subscription/subscriptionService');
const { getEffectiveTier } = require('../subscription/permissionEngine');

const PRICES = { pro: 299, max: 499 };

// POST /api/subscription/request — submit a payment reference for review
router.post('/request', verifyToken, heavyLimiter, async (req, res, next) => {
  try {
    const { tier, paymentRef, upiId, note } = req.body;

    if (!['pro', 'max'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier. Must be pro or max.' });
    }
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
      amountPaid: PRICES[tier],
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
