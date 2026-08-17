const { canAccessFeature, requireFeature } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const { isAtLeast, getRank } = require('../subscription/tierHierarchy');

// A representative feature per tier, used only so the 403 names the plan the
// caller actually needs. Each entry MUST be a feature whose minimum tier is the
// key it sits under, or checkTier(x) silently enforces a different tier than it
// claims — which is what `pro: INTERVIEW_QUESTIONS` did while interview
// questions were a Placement feature: every checkTier('pro') route demanded the
// Pass. tests/pricing.test.js now asserts this map stays self-consistent.
const TIER_FEATURE_MAP = {
  free:  FEATURE.AI_CHAT,
  trial: FEATURE.AI_SUMMARISE,
  pro:   FEATURE.SEMANTIC_SEARCH,
  placement: FEATURE.AI_INTERVIEW_SIMULATOR,
};

function checkTier(minTier) {
  return (req, res, next) => {
    let tier = req.user?.tier || 'free';
    if (req.user?.tierExpiresAt && new Date() > new Date(req.user.tierExpiresAt)) {
      tier = 'free';
      require('mongoose').model('User').findByIdAndUpdate(req.user.userId, { tier: 'free' }).catch(() => {});
    }
    req.user.tier = tier;

    const feature = TIER_FEATURE_MAP[minTier];
    if (feature) return requireFeature(feature)(req, res, next);

    if (!isAtLeast(tier, minTier)) {
      return res.status(403).json({
        message: `This requires at least the ${minTier} plan.`,
        requiredTier: minTier,
        upgradeUrl: '/subscribe',
      });
    }
    next();
  };
}

checkTier.feature = checkTier;
checkTier.TIER_FEATURE_MAP = TIER_FEATURE_MAP; // asserted self-consistent in tests/pricing.test.js
module.exports = checkTier;
