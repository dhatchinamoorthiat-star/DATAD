const { canAccessFeature } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const { todayKey, DAILY_AI_LIMITS } = require('../utils/quota');
const usageMeter = require('../ai/usageMeter');

// Pre-flight credit gate only — actual charging happens at the AI
// completion sites via usageMeter.chargeCredits, so a blocked request costs
// nothing and a request is never billed before it succeeds.
async function aiQuota(req, res, next) {
  try {
    if (canAccessFeature(req.user, FEATURE.ADMIN_STUDIO)) return next();

    const credits = await usageMeter.checkCredits(req.user.userId, req.user.tier);

    if (!credits.limit) {
      return res.status(403).json({
        message: 'AI features require a trial, Pro or the Placement Pass.',
        upgradeUrl: '/subscribe',
      });
    }

    if (credits.blocked) {
      return res.status(429).json({
        code: 'CREDITS_EXHAUSTED',
        message: `Daily AI credits used up (${credits.limit} on your plan). Resets at midnight UTC.`,
        credits,
        upgradeUrl: '/subscribe',
      });
    }

    res.set('X-AI-Credits-Used', String(credits.used));
    res.set('X-AI-Credits-Limit', String(credits.limit));
    next();
  } catch (err) {
    next(err);
  }
}

aiQuota.DAILY_LIMIT = DAILY_AI_LIMITS; // legacy export, kept one release
aiQuota.todayKey = todayKey;
module.exports = aiQuota;
