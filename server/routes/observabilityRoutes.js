const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

const telemetry = require('../ai/telemetry');
const providerHealthEngine = require('../ai/runtime-v2/providerHealthEngine');
const modelRegistry = require('../ai/runtime-v2/modelRegistry');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');

const guard = [verifyToken, checkRole('admin')];

// GET /api/admin/ai/runtime — Runtime dashboard summary
router.get('/runtime', ...guard, (req, res) => {
  const summary = telemetry.getRuntimeSummary();
  const allModels = modelRegistry.listAllModels();
  const availableModels = modelRegistry.getAvailableModels();

  res.json({
    runtime: 'v2',
    provider: 'nvidia',
    model: 'meta/llama-3.3-70b-instruct',
    latency: summary.averageLatencyMs,
    health: summary.successRate >= 80 ? 'healthy' : summary.successRate >= 50 ? 'degraded' : 'unhealthy',
    requests: summary.totalRequests,
    successRate: summary.successRate,
    averageLatency: summary.averageLatencyMs,
    totalTokens: summary.totalTokens,
    totalCost: summary.totalCost,
    fallbackCount: summary.fallbackCount,
    cacheHitCount: summary.cacheHitCount,
    failureCount: summary.failureCount,
    providerBreakdown: summary.providerStats,
    models: {
      total: allModels.length,
      available: availableModels.length,
      list: allModels.map((m) => ({
        key: m.key,
        provider: m.provider,
        model: m.model,
        reasoningScore: m.reasoningScore,
        codingScore: m.codingScore,
        writingScore: m.writingScore,
        speed: m.speed,
        cost: m.cost,
        contextWindow: m.contextWindow,
        visionSupport: m.visionSupport,
        embeddingSupport: m.embeddingSupport,
        availability: m.availability,
      })),
    },
  });
});

// GET /api/admin/ai/live — Live request stream (last 100)
router.get('/live', ...guard, (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 100, 500);
  const requests = telemetry.getRecentRequests(count);
  res.json({ count: requests.length, requests });
});

// GET /api/admin/ai/providers — Provider health
router.get('/providers', ...guard, (req, res) => {
  const providerHealth = providerHealthEngine.getAllHealth();
  const allModels = modelRegistry.listAllModels();

  const providers = {};
  for (const [name, health] of Object.entries(providerHealth)) {
    const models = allModels.filter((m) => m.provider === name);
    // Breaker state is what actually decides whether the failover chain will
    // call this provider on the next request, so it belongs next to the health
    // score rather than being inferred from it.
    const breaker = circuitBreaker.getState(name);

    providers[name] = {
      ...health,
      circuit: {
        state: breaker.currentState,
        consecutiveFailures: breaker.consecutiveFailureCount,
        lastFailureAt: breaker.lastFailureTime ? new Date(breaker.lastFailureTime).toISOString() : null,
        // Only meaningful while open; null once the provider is back in rotation.
        retryAt: breaker.currentState === 'open'
          ? new Date(breaker.lastStateChange + breaker.recoveryTimeout).toISOString()
          : null,
      },
      models: models.map((m) => ({
        model: m.model,
        key: m.key,
        contextWindow: m.contextWindow,
        visionSupport: m.visionSupport,
        embeddingSupport: m.embeddingSupport,
      })),
      // An open breaker means the chain is actively skipping this provider —
      // that outranks whatever the rolling health score says.
      status: breaker.currentState === 'open' ? 'benched'
        : health.healthScore >= 70 ? 'healthy'
        : health.healthScore >= 40 ? 'degraded'
        : 'unhealthy',
    };
  }

  res.json({ providers });
});

// GET /api/admin/ai/usage?days=7 — Credit usage analytics from the durable
// AiUsageEvent ledger (in contrast to /live, which is in-memory and ephemeral).
const AiUsageEvent = require('../models/AiUsageEvent');

router.get('/usage', ...guard, async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };

    const [byTier, topUsers, byModel] = await Promise.all([
      AiUsageEvent.aggregate([
        { $match: match },
        { $group: { _id: '$tier', credits: { $sum: '$credits' }, requests: { $sum: 1 } } },
        { $sort: { credits: -1 } },
      ]),
      AiUsageEvent.aggregate([
        { $match: match },
        { $group: { _id: '$user', credits: { $sum: '$credits' }, requests: { $sum: 1 } } },
        { $sort: { credits: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDoc' } },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        { $project: { credits: 1, requests: 1, name: '$userDoc.name', email: '$userDoc.email', tier: '$userDoc.tier' } },
      ]),
      AiUsageEvent.aggregate([
        { $match: match },
        { $group: { _id: '$model', credits: { $sum: '$credits' }, requests: { $sum: 1 }, provider: { $first: '$provider' } } },
        { $sort: { requests: -1 } },
        { $limit: 20 },
      ]),
    ]);

    res.json({ days, byTier, topUsers, byModel });
  } catch (err) { next(err); }
});

module.exports = router;
