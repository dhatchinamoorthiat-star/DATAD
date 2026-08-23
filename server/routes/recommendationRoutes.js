const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const recommendationEngine = require('../ai/recommendation-engine');
const livingSurface = require('../ai/recommendation-engine/livingSurface');
const workspace = require('../ai/recommendation-engine/workspace');
const intelligenceLayer = require('../ai/intelligence-layer');
const lifecycleManager = require('../ai/recommendation-engine/lifecycleManager');
const feedbackEngine = require('../ai/recommendation-engine/feedbackEngine');
const learningLoop = require('../ai/recommendation-engine/learningLoop');
const { generateDailyMission } = require('../ai/recommendation-engine/dailyMission');
const weeklyReview = require('../ai/recommendation-engine/weeklyReview');
const goalProgress = require('../ai/recommendation-engine/goalProgress');
const predictionLedger = require('../ai/predictions/ledger');

router.use(verifyToken);

// GET /api/recommendations — active recommendations for the user
router.get('/', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const recs = await recommendationEngine.getActiveRecommendations(uid);
    res.json({ recommendations: recs, count: recs.length });
  } catch (err) { next(err); }
});

// POST /api/recommendations/generate — force-regenerate all recommendations
router.post('/generate', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const profile = await intelligenceLayer.buildStudentProfile(uid);
    const recs = await recommendationEngine.generateRecommendations(uid, profile);
    const mission = await generateDailyMission(uid, recs, profile);
    if (mission) {
      await livingSurface.attachDailyMission(uid, mission);
    }
    res.json({ generated: recs.length, recommendations: recs, dailyMission: mission });
  } catch (err) { next(err); }
});

// DELETE /api/recommendations/:id — dismiss a single recommendation
router.delete('/:id', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const result = await recommendationEngine.dismissRecommendation(uid, req.params.id);
    if (!result) return res.status(404).json({ message: 'Recommendation not found' });
    res.json({ dismissed: true });
  } catch (err) { next(err); }
});

// DELETE /api/recommendations/type/:type — dismiss all of one type
router.delete('/type/:type', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    await recommendationEngine.dismissAllByType(uid, req.params.type);
    res.json({ dismissed: true });
  } catch (err) { next(err); }
});

// GET /api/recommendations/stream — living surface stream
router.get('/stream', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    let stream = await livingSurface.getStream(uid);
    if (!stream) {
      const profile = await intelligenceLayer.buildStudentProfile(uid);
      await recommendationEngine.generateRecommendations(uid, profile);
      stream = await livingSurface.hydrateStream(uid);
    }
    res.json(stream || { entries: [], todayFocus: null, topPriorities: [], dailyMission: null });
  } catch (err) { next(err); }
});

// GET /api/recommendations/workspace — workspace widget data
router.get('/workspace', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const [recs, quickActions, focus] = await Promise.all([
      workspace.getWorkspaceRecommendations(uid),
      workspace.getQuickActions(uid),
      workspace.getFocusBanner(uid),
    ]);
    res.json({ recommendations: recs, quickActions, focus });
  } catch (err) { next(err); }
});

// --- V2 Endpoints ---

// POST /api/recommendations/:id/lifecycle — transition lifecycle state
router.post('/:id/lifecycle', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const { toState } = req.body;
    if (!toState) return res.status(400).json({ message: 'toState is required' });
    const result = await lifecycleManager.transition(uid, req.params.id, toState);
    if (!result) return res.status(404).json({ message: 'Recommendation not found' });
    if (result.error) return res.status(400).json(result);
    res.json({ lifecycle: result.lifecycle });
  } catch (err) { next(err); }
});

// POST /api/recommendations/:id/feedback — record feedback
router.post('/:id/feedback', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const { type } = req.body;
    if (!type) return res.status(400).json({ message: 'Feedback type is required' });
    const result = await feedbackEngine.recordFeedback(uid, req.params.id, type);
    if (!result) return res.status(404).json({ message: 'Recommendation not found' });
    if (result.error) return res.status(400).json(result);
    // Fire the learning loop — analyzes patterns and adjusts generator weights
    learningLoop.processFeedback(uid).catch(() => {});
    res.json({ applied: true });
  } catch (err) { next(err); }
});

// GET /api/recommendations/feedback/stats — aggregate feedback stats
router.get('/feedback/stats', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const recs = await recommendationEngine.getActiveRecommendations(uid);
    const stats = feedbackEngine.getFeedbackStats(recs);
    res.json(stats);
  } catch (err) { next(err); }
});

// POST /api/recommendations/lifecycle/mark-seen — mark multiple as seen
router.post('/lifecycle/mark-seen', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: 'ids array is required' });
    await lifecycleManager.markSeen(uid, ids);
    res.json({ marked: ids.length });
  } catch (err) { next(err); }
});

// GET /api/recommendations/daily-mission — get today's daily mission
router.get('/daily-mission', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const result = await livingSurface.getDailyMission(uid);
    res.json(result || { mission: null });
  } catch (err) { next(err); }
});

// GET /api/recommendations/weekly-review — get or generate weekly review
router.get('/weekly-review', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    let review = await weeklyReview.getLatest(uid);
    if (!review) {
      review = await weeklyReview.generate(uid);
    }
    res.json(review || { message: 'No review available yet' });
  } catch (err) { next(err); }
});

// POST /api/recommendations/weekly-review/generate — force-regenerate
router.post('/weekly-review/generate', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const review = await weeklyReview.generate(uid);
    res.json(review);
  } catch (err) { next(err); }
});

// GET /api/recommendations/goal-progress — goal completion data
router.get('/goal-progress', async (req, res, next) => {
  try {
    const uid = req.user.userId;
    const progress = await goalProgress.compute(uid);
    res.json(progress);
  } catch (err) { next(err); }
});

// GET /api/recommendations/predictions — Dax's own track record.
// Read-only, and read-only on purpose: nothing a client sends may edit an
// outcome. The response includes misses in the same list as hits, unfiltered.
router.get('/predictions', async (req, res, next) => {
  try {
    const record = await predictionLedger.getAccuracy(req.user.userId);
    res.json(record);
  } catch (err) { next(err); }
});

module.exports = router;
