const User = require('../models/User');
const AiUsage = require('../models/AiUsage');
const ChatMessage = require('../models/ChatMessage');
const { getEffectiveTier, getAvailableCapabilities } = require('./permissionEngine');
const { isAtLeast } = require('./tierHierarchy');
const { FEATURE } = require('./featureRegistry');

const { CREDIT_LIMITS } = require('../ai/usageMeter');

const todayKey = () => new Date().toISOString().slice(0, 10);

// Legacy count-based limits — superseded by credit metering (CREDIT_LIMITS
// in ai/usageMeter.js); kept exported for one release for rollback safety.
const DAILY_AI_LIMITS = { free: 0, trial: 150, pro: 500, placement: 1500 };

// Chat is metered by message count, separately from credits, and costs zero
// credits. Free gets a genuinely usable allowance on purpose: the notes, feed
// and directory only get good with volume, so suppressing the free tier
// suppresses the content the paid tiers are sold on.
const CHAT_QUOTAS = { free: 20, trial: 50, pro: 200, placement: 500 };

// Credit-weighted: a request costs 1–5 credits depending on the model.
async function getRemainingAiQuota(userId, tier) {
  const limit = CREDIT_LIMITS[tier] ?? 0;
  if (!limit) return { used: 0, limit: 0, remaining: 0 };
  const usage = await AiUsage.findOne({ user: userId, dateKey: todayKey() }).select('creditsUsed').lean();
  const used = usage?.creditsUsed || 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

async function getRemainingChatQuota(userId, tier) {
  const limit = CHAT_QUOTAS[tier] ?? 0;
  const used = await ChatMessage.countDocuments({
    user: userId, role: 'user',
    createdAt: { $gte: new Date(todayKey()) },
  });
  return { used, limit, remaining: Math.max(0, limit - used) };
}

async function getSubscriptionStatus(userId) {
  const user = await User.findById(userId).select('tier tierExpiresAt trialStartedAt').lean();
  if (!user) return null;

  const tier = user.tier || 'free';
  const effectiveTier = getEffectiveTier(user);
  const capabilities = getAvailableCapabilities(user);
  const aiQuota = await getRemainingAiQuota(userId, effectiveTier);
  const chatQuota = await getRemainingChatQuota(userId, effectiveTier);

  return {
    tier,
    effectiveTier,
    tierExpiresAt: user.tierExpiresAt,
    trialUsed: !!user.trialStartedAt,
    capabilities,
    aiQuota,
    credits: aiQuota, // canonical name going forward; aiQuota kept for compat
    chatQuota,
    isActive: effectiveTier !== 'free',
    hasTrial: isAtLeast(effectiveTier, 'trial'),
    hasPro: isAtLeast(effectiveTier, 'pro'),
    hasPlacement: isAtLeast(effectiveTier, 'placement'),
    hasMax: isAtLeast(effectiveTier, 'placement'), // legacy alias, one release
  };
}

module.exports = {
  getRemainingAiQuota,
  getRemainingChatQuota,
  getSubscriptionStatus,
  DAILY_AI_LIMITS,
  CHAT_QUOTAS,
  CREDIT_LIMITS,
};
