const router = require('express').Router();
const { generalLimiter } = require('../middleware/rateLimiters');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// Stricter rate limit for external API access
const API_RATE_LIMIT = { windowMs: 60 * 1000, max: 60 };

router.use(generalLimiter);
router.use(apiKeyAuth);

// GET /api/v1/me — return the authenticated user's profile
router.get('/me', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.apiUser).select('name email role tier').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// GET /api/v1/readiness — return the user's readiness score
router.get('/readiness', async (req, res, next) => {
  try {
    const UserMemory = require('../models/UserMemory');
    const mem = await UserMemory.findOne({ user: req.apiUser }).select('readinessScore strengths weaknesses').lean();
    if (!mem) return res.json({ readinessScore: null });
    res.json(mem);
  } catch (err) { next(err); }
});

// GET /api/v1/tasks — list user's tasks
router.get('/tasks', async (req, res, next) => {
  try {
    const Task = require('../models/Task');
    const tasks = await Task.find({ $or: [{ assignee: req.apiUser }, { createdBy: req.apiUser }] })
      .select('title status dueDate type')
      .sort({ dueDate: 1 })
      .limit(20)
      .lean();
    res.json({ tasks });
  } catch (err) { next(err); }
});

module.exports = router;
