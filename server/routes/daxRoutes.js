const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { generalLimiter } = require('../middleware/rateLimiters');
const { requireFeature, canAccessFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const usageMeter = require('../ai/usageMeter');
const { getMinimumTier } = require('../subscription/featureRegistry');
const daxService = require('../ai/daxService');
const proposalService = require('../ai/proposalService');
const UserModelPref = require('../models/UserModelPref');
const { getAvailableModels, getDefaultModelId, parseModelId } = require('../ai/modelList');
const { CHAT_QUOTAS } = require('../subscription/subscriptionService');
const ChatMessage = require('../models/ChatMessage');

router.use(verifyToken);
router.use(refreshTier);
router.use(generalLimiter);

const TASK_FEATURES = {
  'summarise-note':       FEATURE.AI_SUMMARISE,
  'review-resume':        FEATURE.AI_RESUME_REVIEW,
  'planner-suggest':      FEATURE.AI_PLANNER_SUGGEST,
  'career-advice':        FEATURE.AI_CAREER_ADVICE,
  'interview-simulator':  FEATURE.AI_INTERVIEW_SIMULATOR,
  'compare-companies':    FEATURE.AI_COMPARE_COMPANIES,
  'flashcard-generate':   FEATURE.FLASHCARD_GENERATE,
  'quiz-generate':        FEATURE.QUIZ_GENERATE,
  'finance-assist':       FEATURE.FINANCE_ASSIST,
  'dashboard-insights':   FEATURE.DASHBOARD_INSIGHTS,
  'company-research':     FEATURE.COMPANY_RESEARCH,
  'resume-ats':           FEATURE.RESUME_ATS,
  search:                 FEATURE.SEMANTIC_SEARCH,
  'index-doc':            FEATURE.SEMANTIC_SEARCH,
};

/**
 * Tasks that are administrative rather than student-facing.
 *
 * `index-doc` writes straight into the shared vector store. Its arguments —
 * collection, docId, text — are all caller-supplied, and the store is keyed
 * uniquely on (sourceCollection, docId), so an ordinary member could overwrite
 * the embedding of any document in any collection: quietly remove a company or
 * a case from everyone's search results, or make a document of their choosing
 * surface for every query. Each call also spends a real embedding API call, and
 * this task is not in TASK_QUOTA, so nothing metered it.
 *
 * No client calls it — it is an ingest utility that was reachable by anyone
 * holding the semantic-search feature. Gating on role keeps it working for the
 * operators who need it and closes it to everyone else.
 */
const ADMIN_ONLY_TASKS = new Set(['index-doc']);

const TASK_QUOTA = new Set([
  'summarise-note',
  'review-resume',
  'planner-suggest',
  'career-advice',
  'interview-simulator',
  'compare-companies',
  'flashcard-generate',
  'quiz-generate',
  'finance-assist',
  'dashboard-insights',
  'company-research',
  'resume-ats',
]);

router.post('/', async (req, res, next) => {
  try {
    const { task } = req.body;
    if (!task) return res.status(400).json({ message: 'task is required' });

    if (ADMIN_ONLY_TASKS.has(task) && req.user.role !== 'admin') {
      // 404 rather than 403: there is no reason to confirm to a member that an
      // administrative task exists under this endpoint.
      return res.status(404).json({ message: 'Unknown task' });
    }

    const feature = TASK_FEATURES[task];

    if (feature && !canAccessFeature(req.user, feature)) {
      const minTier = getMinimumTier(feature);
      return res.status(403).json({
        message: `This feature requires ${minTier === 'placement' ? 'the Placement Pass' : minTier === 'pro' ? 'Pro' : minTier === 'trial' ? 'a trial' : 'an upgraded'} plan.`,
        requiredTier: minTier,
        upgradeUrl: '/subscribe',
      });
    }

    // Pre-flight credit gate — charging happens at the AI completion sites
    // (usageMeter.chargeCredits), weighted by which model actually served it.
    if (TASK_QUOTA.has(task) && req.user.role !== 'admin') {
      const credits = await usageMeter.checkCredits(req.user.userId, req.user.tier);
      if (credits.limit && credits.blocked) {
        return res.status(429).json({
          code: 'CREDITS_EXHAUSTED',
          message: `Daily AI credits used up (${credits.limit} on your plan). Resets at midnight UTC.`,
          credits,
          upgradeUrl: '/subscribe',
        });
      }
      if (credits.limit) {
        res.set('X-AI-Credits-Used', String(credits.used));
        res.set('X-AI-Credits-Limit', String(credits.limit));
      }
    }

    const result = await daxService.process(req.user.userId, task, req.body, req.user);

    if (result && result._error) {
      return res.status(result._error).json(result);
    }

    res.json(result);
  } catch (err) {
    if (err.name === 'NotFoundError') return res.status(err.statusCode).json({ message: err.message });
    if (err.name === 'ValidationError') return res.status(err.statusCode).json({ message: err.message });
    if (err.name === 'ForbiddenError') return res.status(err.statusCode).json({ message: err.message });
    if (err.message === 'AI not configured') return res.status(503).json({ message: 'AI features are not enabled on this server' });
    next(err);
  }
});

router.get('/memory', async (req, res, next) => {
  try {
    const result = await daxService.getMemory(req.user.userId);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/memory', async (req, res, next) => {
  try {
    const result = await daxService.patchMemory(req.user.userId, req.body);
    res.json(result);
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.delete('/memory', async (req, res, next) => {
  try {
    const result = await daxService.deleteMemory(req.user.userId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/chat/stream', async (req, res, next) => {
  const { message, modelId, conversationId, clientConversationId } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });

  try {
    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const gen = daxService.streamChat(req.user.userId, message, {
      signal: controller.signal,
      modelId,
      conversationId,
      clientConversationId,
    });

    // Peek the first yield before committing to SSE headers — a quota-
    // exceeded turn resolves as the very first (and only) yield, so it can
    // still be answered as a plain JSON 429, matching the non-streaming
    // route's error contract instead of forcing SSE framing on every error.
    const first = await gen.next();
    if (first.done) return res.json({ reply: '', remaining: 0 });
    if (first.value.done && first.value._error) {
      return res.status(first.value._error).json(first.value);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const sendEvent = (type, data) => {
      if (res.destroyed) return;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let chunk = first.value;
    while (true) {
      if (chunk.done) {
        // Cards ride the terminal frame: the client renders them once the
        // reply is complete, so a proposal never appears mid-sentence.
        for (const p of chunk.proposals || []) sendEvent('proposal', { proposal: p });
        sendEvent('done', chunk);
        break;
      }
      sendEvent('token', chunk);
      const next = await gen.next();
      if (next.done) break;
      chunk = next.value;
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) return next(err);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    } catch {}
  }
});

router.get('/chat/history', async (req, res, next) => {
  try {
    const result = await daxService.getChatHistory(req.user.userId, req.query.conversationId);
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/chat', async (req, res, next) => {
  try {
    const result = await daxService.clearChat(req.user.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// ── Conversations ─────────────────────────────────────────────
//
// Every handler is scoped by req.user.userId inside daxService, so a caller
// cannot reach another student's conversation by supplying its id — the
// lookup simply misses and 404s.

// Shared error mapping: the service layer throws typed errors, and without
// this they fall through to the generic handler as 500s.
function sendServiceError(err, res, next) {
  if (err.name === 'NotFoundError') return res.status(404).json({ message: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  return next(err);
}

// ── Proposed writes ───────────────────────────────────────────
//
// The confirm endpoint is the only path by which a Dax-suggested write reaches
// the database. It takes a proposal id and nothing else — the arguments were
// validated and stored server-side at propose time, so a tampered client cannot
// substitute different ones here, and a hallucinated tool call cannot mutate
// anything without a human first clicking Confirm.

router.get('/proposals', async (req, res, next) => {
  try {
    res.json(await proposalService.listPending(req.user.userId, req.query.conversationId));
  } catch (err) { sendServiceError(err, res, next); }
});

router.get('/proposals/:id', async (req, res, next) => {
  try {
    res.json({ proposal: await proposalService.get(req.user.userId, req.params.id) });
  } catch (err) { sendServiceError(err, res, next); }
});

router.post('/proposals/:id/confirm', async (req, res, next) => {
  try {
    res.json(await proposalService.confirm(req.user.userId, req.params.id));
  } catch (err) { sendServiceError(err, res, next); }
});

router.post('/proposals/:id/reject', async (req, res, next) => {
  try {
    res.json(await proposalService.reject(req.user.userId, req.params.id));
  } catch (err) { sendServiceError(err, res, next); }
});

router.post('/proposals/:id/undo', async (req, res, next) => {
  try {
    res.json(await proposalService.undo(req.user.userId, req.params.id));
  } catch (err) { sendServiceError(err, res, next); }
});

// ── Conversations ─────────────────────────────────────────────

router.get('/conversations', async (req, res, next) => {
  try {
    res.json(await daxService.listConversations(req.user.userId));
  } catch (err) { sendServiceError(err, res, next); }
});

router.post('/conversations', async (req, res, next) => {
  try {
    res.status(201).json(await daxService.createConversation(req.user.userId, req.body));
  } catch (err) { sendServiceError(err, res, next); }
});

// One-time localStorage import. Idempotent on (user, clientId), so a client
// that retries — or a second device replaying the same local store — cannot
// duplicate a student's history.
router.post('/conversations/import', async (req, res, next) => {
  try {
    res.json(await daxService.importConversations(req.user.userId, req.body));
  } catch (err) { sendServiceError(err, res, next); }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    res.json(await daxService.getConversation(req.user.userId, req.params.id));
  } catch (err) { sendServiceError(err, res, next); }
});

router.patch('/conversations/:id', async (req, res, next) => {
  try {
    res.json(await daxService.updateConversation(req.user.userId, req.params.id, req.body));
  } catch (err) { sendServiceError(err, res, next); }
});

router.delete('/conversations/:id', async (req, res, next) => {
  try {
    res.json(await daxService.deleteConversation(req.user.userId, req.params.id));
  } catch (err) { sendServiceError(err, res, next); }
});

// ── Model Preference ──────────────────────────────────────────

router.get('/models', (req, res) => {
  res.json({ models: getAvailableModels() });
});

router.get('/model/preference', async (req, res, next) => {
  try {
    const pref = await UserModelPref.findOne({ user: req.user.userId }).lean();
    if (pref) {
      res.json({ provider: pref.provider, model: pref.model });
    } else {
      const def = getDefaultModelId();
      const parsed = parseModelId(def);
      res.json({ provider: parsed.provider, model: parsed.model });
    }
  } catch (err) { next(err); }
});

router.put('/model/preference', async (req, res, next) => {
  try {
    const { modelId } = req.body;
    if (!modelId) return res.status(400).json({ message: 'modelId is required' });

    const parsed = parseModelId(modelId);
    if (!parsed) return res.status(400).json({ message: 'Invalid modelId format' });

    await UserModelPref.findOneAndUpdate(
      { user: req.user.userId },
      { provider: parsed.provider, model: parsed.model },
      { upsert: true, new: true }
    );

    res.json({ provider: parsed.provider, model: parsed.model });
  } catch (err) { next(err); }
});

// ── Usage dashboard ────────────────────────────────────────────────────
// Returns today's AI usage: credits used, limit, remaining, and chat quota.
router.get('/usage', async (req, res, next) => {
  try {
    const credits = await usageMeter.checkCredits(req.user.userId, req.user.tier);
    const chatQuota = CHAT_QUOTAS[credits.tier] || 0;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = await ChatMessage.countDocuments({
      user: req.user.userId,
      role: 'user',
      createdAt: { $gte: new Date(today) },
    });

    res.json({
      tier: credits.tier,
      ai: { used: credits.used, limit: credits.limit, remaining: Math.max(0, credits.limit - credits.used) },
      chat: { used: todayCount, limit: chatQuota, remaining: Math.max(0, chatQuota - todayCount) },
      blocked: credits.blocked,
    });
  } catch (err) { next(err); }
});

module.exports = router;
