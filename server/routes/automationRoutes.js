const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const AutomationLog = require('../models/AutomationLog');
const RuntimeComparison = require('../models/RuntimeComparison');

const guard = [verifyToken, checkRole('admin')];

// GET /api/automation/logs — recent execution logs
router.get('/logs', ...guard, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const job = req.query.job;
    const filter = job ? { job } : {};
    const logs = await AutomationLog.find(filter)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (err) { next(err); }
});

// GET /api/automation/status — last run per job
router.get('/status', ...guard, async (req, res, next) => {
  try {
    const jobs = [
      'daily-case', 'daily-briefing', 'daily-reflection', 'resume-tip',
      'company-enrichment', 'interview-questions', 'moderation',
      'weekly-newsletter', 'news-refresh', 'market-refresh',
    ];
    const results = await Promise.all(
      jobs.map(async (job) => {
        const last = await AutomationLog.findOne({ job }).sort({ startedAt: -1 }).lean();
        return { job, last };
      })
    );
    res.json(results);
  } catch (err) { next(err); }
});

// POST /api/automation/trigger/:job — manually run a job
const JOB_MAP = {
  'daily-case':        () => require('../automation/cases/generateDailyCase').generateDailyCase(),
  'daily-briefing':    () => require('../automation/briefing/generateDailyBriefing').generateDailyBriefing(),
  'daily-reflection':  () => require('../automation/reflections/generateDailyReflection').generateDailyReflection(),
  'resume-tip':        () => require('../automation/resume/generateResumeTip').generateResumeTip(),
  'company-enrichment':() => require('../automation/companies/enrichCompanies').enrichCompanies(),
  'interview-questions':()=> require('../automation/interviews/generateInterviewQuestions').generateInterviewQuestions(),
  'moderation':        () => require('../automation/moderation/moderatePosts').moderatePosts(),
  'news-refresh':      () => require('../services/newsFetcher').refreshNews(),
  'market-refresh':    () => require('../services/marketFetcher').refreshMarket(),
  'stock-refresh':     () => require('../services/stockFetcher').refreshStocks(),
};

router.post('/trigger/:job', ...guard, async (req, res, next) => {
  try {
    const fn = JOB_MAP[req.params.job];
    if (!fn) return res.status(404).json({ message: 'Unknown job' });
    fn().catch((err) => console.error(`[manual-trigger:${req.params.job}]`, err.message));
    res.json({ message: `Job "${req.params.job}" triggered` });
  } catch (err) { next(err); }
});

// ── GET /api/automation/ai-center — Admin AI Dashboard (Phase 10) ─────────

router.get('/ai-center', ...guard, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    const sinceDays7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayLogs,
      weekLogs,
      pendingReviews,
      providerAgg,
      confidenceAgg,
      avgLatencyAgg,
    ] = await Promise.all([
      // Today's job stats
      AutomationLog.aggregate([
        { $match: { startedAt: { $gte: since } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          cost: { $sum: '$estimatedCostUsd' },
          avgDuration: { $avg: '$durationMs' },
        }},
      ]),

      // 7-day token + cost totals
      AutomationLog.aggregate([
        { $match: { startedAt: { $gte: sinceDays7 }, status: 'success' } },
        { $group: {
          _id: null,
          totalTokens: { $sum: '$tokensUsed' },
          totalCost: { $sum: '$estimatedCostUsd' },
          totalRuns: { $sum: 1 },
        }},
      ]),

      // Items in pending_review
      AutomationLog.countDocuments({ validationStatus: 'pending_review' }),

      // Per-provider usage
      AutomationLog.aggregate([
        { $match: { startedAt: { $gte: sinceDays7 }, provider: { $exists: true } } },
        { $group: { _id: '$provider', runs: { $sum: 1 }, tokens: { $sum: '$tokensUsed' }, cost: { $sum: '$estimatedCostUsd' } } },
        { $sort: { runs: -1 } },
      ]),

      // Confidence distribution
      AutomationLog.aggregate([
        { $match: { startedAt: { $gte: sinceDays7 }, confidence: { $exists: true } } },
        { $bucket: {
          groupBy: '$confidence',
          boundaries: [0, 0.4, 0.6, 0.75, 0.9, 1.01],
          default: 'other',
          output: { count: { $sum: 1 } },
        }},
      ]),

      // Average latency per job
      AutomationLog.aggregate([
        { $match: { startedAt: { $gte: sinceDays7 }, status: 'success' } },
        { $group: { _id: '$job', avgDurationMs: { $avg: '$durationMs' }, runs: { $sum: 1 } } },
        { $sort: { avgDurationMs: -1 } },
      ]),
    ]);

    // Flatten today stats
    const statusMap = {};
    for (const s of todayLogs) statusMap[s._id] = s;
    const week = weekLogs[0] || { totalTokens: 0, totalCost: 0, totalRuns: 0 };

    res.json({
      today: {
        success: statusMap.success?.count || 0,
        failed: statusMap.failed?.count || 0,
        running: statusMap.running?.count || 0,
        partial: statusMap.partial?.count || 0,
        tokensUsed: (statusMap.success?.tokens || 0) + (statusMap.partial?.tokens || 0),
        estimatedCostUsd: parseFloat(((statusMap.success?.cost || 0) + (statusMap.partial?.cost || 0)).toFixed(4)),
        avgGenerationMs: Math.round(statusMap.success?.avgDuration || 0),
      },
      week: {
        totalRuns: week.totalRuns,
        totalTokens: week.totalTokens,
        estimatedCostUsd: parseFloat((week.totalCost || 0).toFixed(4)),
      },
      pendingReviews,
      providerUsage: providerAgg,
      confidenceDistribution: confidenceAgg,
      latencyByJob: avgLatencyAgg,
    });
  } catch (err) { next(err); }
});

// ── GET /api/automation/health — Scheduler health (Phase 11) ─────────────

router.get('/health', ...guard, async (req, res, next) => {
  try {
    const jobNames = Object.keys(JOB_MAP);
    const cutoff24h = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h window for daily jobs
    const cutoff7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const health = await Promise.all(
      jobNames.map(async (job) => {
        const [last, failCount7d, successCount7d] = await Promise.all([
          AutomationLog.findOne({ job }).sort({ startedAt: -1 }).select('status startedAt durationMs confidence estimatedCostUsd').lean(),
          AutomationLog.countDocuments({ job, status: 'failed', startedAt: { $gte: cutoff7d } }),
          AutomationLog.countDocuments({ job, status: 'success', startedAt: { $gte: cutoff7d } }),
        ]);

        const totalRuns = failCount7d + successCount7d;
        const successRate = totalRuns > 0 ? Math.round((successCount7d / totalRuns) * 100) : null;

        return {
          job,
          lastStatus: last?.status || 'never_run',
          lastRun: last?.startedAt || null,
          lastDurationMs: last?.durationMs || null,
          lastConfidence: last?.confidence || null,
          failCount7d,
          successCount7d,
          successRate,
          healthy: last?.status === 'success' && (failCount7d === 0 || successRate >= 70),
        };
      })
    );

    const overallHealth = health.filter((h) => h.healthy).length / health.length;
    res.json({ overallHealthPct: Math.round(overallHealth * 100), jobs: health });
  } catch (err) { next(err); }
});

// ── GET /api/automation/cost-trends — 7-day cost chart data ─────────────

router.get('/cost-trends', ...guard, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const data = await AutomationLog.aggregate([
      { $match: { startedAt: { $gte: since } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
        totalCost: { $sum: '$estimatedCostUsd' },
        totalTokens: { $sum: '$tokensUsed' },
        runs: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);
    res.json(data);
  } catch (err) { next(err); }
});

// ── GET /api/automation/gateway-mode — View/change gateway execution mode ──
// V2/hybrid/shadow modes were removed in the Sprint 2 AI consolidation.
// The gateway now always uses V1-only execution. This endpoint returns a
// fixed response for backwards compatibility.

router.get('/gateway-mode', ...guard, async (req, res, next) => {
  try {
    res.json({
      mode: 'v1_only',
      availableModes: ['v1_only'],
      hybridV2Intents: [],
      message: 'Gateway mode is permanently v1_only as of Sprint 2 AI consolidation (July 2026). V2/hybrid/shadow modes were removed.',
    });
  } catch (err) { next(err); }
});

router.put('/gateway-mode', ...guard, async (req, res, next) => {
  try {
    res.status(400).json({
      message: 'Gateway mode changes are no longer supported. The gateway always uses v1_only after the Sprint 2 AI consolidation (July 2026).',
    });
  } catch (err) { next(err); }
});

// ── GET /api/automation/runtime-comparison — Runtime V1 vs V2 Dashboard ──

router.get('/runtime-comparison', ...guard, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      latencyByRuntime,
      selectionFreq,
      cacheHitRate,
      costPerFeature,
      modelPerformance,
      verificationSuccess,
      providerHealth,
      promptPerformance,
      modeUsage,
    ] = await Promise.all([

      // 1. Latency comparison V1 vs V2
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: null,
          v1AvgLatency: { $avg: '$v1.latencyMs' },
          v2AvgLatency: { $avg: '$v2.latencyMs' },
          v1Count: { $sum: { $cond: [{ $ne: ['$v1', null] }, 1, 0] } },
          v2Count: { $sum: { $cond: [{ $ne: ['$v2', null] }, 1, 0] } },
          v1AvgCost: { $avg: '$v1.estimatedCostUsd' },
          v2AvgCost: { $avg: '$v2.estimatedCostUsd' },
        }},
      ]),

      // 2. Runtime selection frequency
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$runtimeSelected', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // 3. Cache hit rate by runtime
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: '$runtimeSelected',
          total: { $sum: 1 },
          cacheHits: { $sum: { $cond: [{ $eq: ['$v1.cacheHit', true] }, 1, 0] } },
        }},
        { $project: {
          runtime: '$_id',
          total: 1,
          cacheHits: 1,
          cacheHitRate: {
            $cond: [{ $gt: ['$total', 0] }, { $divide: ['$cacheHits', '$total'] }, 0],
          },
        }},
      ]),

      // 4. Cost per feature (intent) by runtime
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since }, intent: { $exists: true } } },
        { $group: {
          _id: '$intent',
          v1Cost: { $avg: '$v1.estimatedCostUsd' },
          v2Cost: { $avg: '$v2.estimatedCostUsd' },
          v1Latency: { $avg: '$v1.latencyMs' },
          v2Latency: { $avg: '$v2.latencyMs' },
          count: { $sum: 1 },
        }},
        { $sort: { count: -1 } },
      ]),

      // 5. Model performance (avg confidence, latency by model)
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $facet: {
          v1Models: [
            { $match: { 'v1.model': { $exists: true } } },
            { $group: {
              _id: { model: '$v1.model', provider: '$v1.provider' },
              avgLatencyMs: { $avg: '$v1.latencyMs' },
              avgConfidence: { $avg: '$v1.confidence' },
              avgCost: { $avg: '$v1.estimatedCostUsd' },
              runs: { $sum: 1 },
            }},
          ],
          v2Models: [
            { $match: { 'v2.model': { $exists: true } } },
            { $group: {
              _id: { model: '$v2.model', provider: '$v2.provider' },
              avgLatencyMs: { $avg: '$v2.latencyMs' },
              avgConfidence: { $avg: '$v2.confidence' },
              avgCost: { $avg: '$v2.estimatedCostUsd' },
              runs: { $sum: 1 },
            }},
          ],
        }},
      ]),

      // 6. Verification success rate by runtime
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: '$runtimeSelected',
          total: { $sum: 1 },
          verified: { $sum: { $cond: [
            { $or: [
              { $eq: ['$v1.verificationStatus', 'published'] },
              { $eq: ['$v2.verificationStatus', 'published'] },
            ]}, 1, 0,
          ]}},
          pending: { $sum: { $cond: [
            { $or: [
              { $eq: ['$v1.verificationStatus', 'pending_review'] },
              { $eq: ['$v2.verificationStatus', 'pending_review'] },
            ]}, 1, 0,
          ]}},
          failed: { $sum: { $cond: [
            { $or: [
              { $eq: ['$v1.verificationStatus', 'failed'] },
              { $eq: ['$v2.verificationStatus', 'failed'] },
            ]}, 1, 0,
          ]}},
        }},
      ]),

      // 7. Provider health from RuntimeComparison
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $facet: {
          v1Providers: [
            { $match: { 'v1.provider': { $exists: true } } },
            { $group: {
              _id: '$v1.provider',
              avgLatencyMs: { $avg: '$v1.latencyMs' },
              runs: { $sum: 1 },
              avgCost: { $avg: '$v1.estimatedCostUsd' },
            }},
          ],
          v2Providers: [
            { $match: { 'v2.provider': { $exists: true } } },
            { $group: {
              _id: '$v2.provider',
              avgLatencyMs: { $avg: '$v2.latencyMs' },
              runs: { $sum: 1 },
              avgCost: { $avg: '$v2.estimatedCostUsd' },
            }},
          ],
        }},
      ]),

      // 8. Prompt performance by version
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $facet: {
          v1Prompts: [
            { $match: { 'v1.promptVersion': { $exists: true } } },
            { $group: {
              _id: '$v1.promptVersion',
              avgConfidence: { $avg: '$v1.confidence' },
              avgLatencyMs: { $avg: '$v1.latencyMs' },
              runs: { $sum: 1 },
            }},
          ],
          v2Prompts: [
            { $match: { 'v2.promptVersion': { $exists: true } } },
            { $group: {
              _id: '$v2.promptVersion',
              avgConfidence: { $avg: '$v2.confidence' },
              avgLatencyMs: { $avg: '$v2.latencyMs' },
              runs: { $sum: 1 },
            }},
          ],
        }},
      ]),

      // 9. Mode usage distribution
      RuntimeComparison.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$mode', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      latencyByRuntime: latencyByRuntime[0] || null,
      selectionFrequency: selectionFreq,
      cacheHitRate,
      costPerFeature,
      modelPerformance,
      verificationSuccessRate: verificationSuccess,
      providerHealth,
      promptPerformance,
      modeUsage,
      since,
    });
  } catch (err) { next(err); }
});

module.exports = router;
