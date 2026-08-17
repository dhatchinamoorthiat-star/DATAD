const AiUsage = require('../models/AiUsage');
const AiUsageEvent = require('../models/AiUsageEvent');
const User = require('../models/User');
const { getCreditCost } = require('./runtime-v2/costOptimizer');
const notificationService = require('../notifications/NotificationService');
const logger = require('../utils/logger');

// Daily credit allowances per tier. A request costs 1-5 credits depending on
// which model serves it.
//
// These are the authoritative numbers — client/src/utils/pricing.js must state
// exactly these, and previously did not: it advertised 30/250/800 against
// actual limits of 500/500/2000. Worse, trial and pro were both 500, so the
// paid tier offered no credit advantage at all over the free trial.
const CREDIT_LIMITS = { free: 0, trial: 150, pro: 500, placement: 2500 };

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Record a completed AI request: bump the user's daily credit rollup and
 * append a durable usage event for admin analytics.
 *
 * Fire-and-forget safe: never throws — a metering failure must never cost
 * the student a response they already have.
 */
async function chargeCredits({ userId, tier, model, provider, promptTokens, completionTokens, task, latencyMs }) {
  if (!userId) return null; // system/cron tasks are uncharged
  try {
    // Chat is metered separately by CHAT_QUOTAS (count-based) — it records a
    // zero-credit event so admin analytics still see model/provider usage,
    // but it never drains the shared AI credit pool.
    const isChat = task === 'chat';
    const credits = isChat ? 0 : getCreditCost(model, provider);

    if (!isChat) {
      const filter = { user: userId, dateKey: todayKey() };
      const update = { $inc: { creditsUsed: credits, count: 1 } };
      try {
        await AiUsage.findOneAndUpdate(filter, update, { upsert: true, setDefaultsOnInsert: true });
      } catch (err) {
        // Two first-requests-of-the-day can race the upsert; the loser gets a
        // duplicate-key error and simply retries as a plain increment.
        if (err.code === 11000) await AiUsage.findOneAndUpdate(filter, update);
        else throw err;
      }
    }

    await AiUsageEvent.create({
      user: userId,
      tier: tier || 'free',
      model: model || '',
      provider: provider || '',
      credits,
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      task: task || '',
      latencyMs: latencyMs || 0,
    });

    return credits;
  } catch (err) {
    logger.error('usageMeter.chargeCredits failed', { error: err.message, userId: String(userId), model });
    return null;
  }
}

/**
 * Pre-flight quota check. `tier` is optional — falls back to a DB read so
 * callers without refreshTier middleware still enforce the live tier.
 */
async function checkCredits(userId, tier) {
  let effectiveTier = tier;
  if (!effectiveTier) {
    const user = await User.findById(userId).select('tier tierExpiresAt').lean();
    effectiveTier = user?.tier || 'free';
    if (user?.tierExpiresAt && new Date() > new Date(user.tierExpiresAt)) effectiveTier = 'free';
  }
  const limit = CREDIT_LIMITS[effectiveTier] ?? 0;
  if (!limit) return { used: 0, limit: 0, remaining: 0, blocked: true, tier: effectiveTier };

  const usage = await AiUsage.findOne({ user: userId, dateKey: todayKey() }).select('creditsUsed').lean();
  const used = usage?.creditsUsed || 0;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    blocked: used >= limit,
    tier: effectiveTier,
  };
}

/**
 * Notify user when credits are running low or exhausted.
 * Call after charging credits so the most recent usage is reflected.
 */
async function checkAndNotifyCredits(userId, tier) {
  try {
    const status = await checkCredits(userId, tier);
    if (!status.limit || status.tier === 'free') return;

    if (status.blocked) {
      await notificationService.send(userId, {
        type: 'credit_alert',
        title: 'AI credits exhausted',
        body: `You've used all ${status.limit} daily AI credits. Upgrade to Pro for more, or come back tomorrow.`,
        link: '/subscribe',
      });
    } else if (status.remaining <= Math.ceil(status.limit * 0.1)) {
      await notificationService.send(userId, {
        type: 'credit_alert',
        title: 'AI credits running low',
        body: `${status.remaining} of ${status.limit} daily AI credits remaining`,
        link: '/subscribe',
      });
    }
  } catch (err) {
    logger.warn('[usageMeter] Failed to notify credits', { error: err.message, userId: String(userId) });
  }
}

module.exports = { chargeCredits, checkCredits, checkAndNotifyCredits, CREDIT_LIMITS };
