const { canAccessFeature, requireFeature } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const { isAtLeast, getRank } = require('../subscription/tierHierarchy');

const TIER_FEATURE_MAP = {
  free:  FEATURE.AI_CHAT,
  trial: FEATURE.AI_SUMMARISE,
  pro:   FEATURE.INTERVIEW_QUESTIONS,
  placement: FEATURE.KNOWLEDGE_GRAPH,
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
module.exports = checkTier;
