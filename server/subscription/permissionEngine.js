const { getRank, isAtLeast } = require('./tierHierarchy');
const { getMinimumTier } = require('./featureRegistry');
const User = require('../models/User');

function getUserTier(user) {
  if (!user) return 'free';
  return user.tier || 'free';
}

function getEffectiveTier(user) {
  const tier = getUserTier(user);
  if (user?.tierExpiresAt && new Date() > new Date(user.tierExpiresAt)) {
    return 'free';
  }
  return tier;
}

function canAccessFeature(user, feature) {
  if (user?.role === 'admin') return true;

  const effectiveTier = getEffectiveTier(user);
  const minTier = getMinimumTier(feature);

  if (!minTier) return false;
  if (minTier === 'admin') return false;

  return isAtLeast(effectiveTier, minTier);
}

function requireFeature(feature) {
  return (req, res, next) => {
    if (canAccessFeature(req.user, feature)) return next();

    const minTier = getMinimumTier(feature);
    const label = minTier === 'placement' ? 'the Placement Pass'
      : minTier === 'pro' ? 'Pro'
      : minTier === 'trial' ? 'a trial'
      : 'an upgraded';

    return res.status(403).json({
      message: `This feature requires ${label} plan.`,
      requiredTier: minTier === 'admin' ? undefined : minTier,
      feature,
      upgradeUrl: '/subscribe',
    });
  };
}

function getAvailableCapabilities(user) {
  const effectiveTier = getEffectiveTier(user);
  const { getFeaturesForTier } = require('./featureRegistry');
  return getFeaturesForTier(effectiveTier);
}

// The JWT bakes in `tier` at login time and can go stale for up to its
// expiry (7d) if the user's subscription changes mid-session. Refresh it
// from the DB before any feature-gate check so req.user.tier is live.
async function refreshTier(req, res, next) {
  try {
    if (req.user?.userId) {
      const dbUser = await User.findById(req.user.userId).select('tier tierExpiresAt role').lean();
      if (dbUser) {
        req.user.tier = dbUser.tier;
        req.user.tierExpiresAt = dbUser.tierExpiresAt;
        req.user.role = dbUser.role || req.user.role;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { canAccessFeature, requireFeature, getEffectiveTier, getUserTier, getAvailableCapabilities, refreshTier };
