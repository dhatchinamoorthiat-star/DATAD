const rateLimit = require('express-rate-limit');
const router = require('express').Router();
const { generalLimiter } = require('../middleware/rateLimiters');
const apiKeyAuth = require('../middleware/apiKeyAuth');

/**
 * Stricter ceiling for external API access.
 *
 * These numbers were already written down here but never handed to anything —
 * the limit was declared as a plain object and left unused, so the public API
 * ran on generalLimiter alone (1000 requests per 15 minutes, per IP, shared
 * with the whole app). Keyed on the API key rather than the IP: the point is
 * to bound what one integration can do, and a single server-side integration
 * calls from one address for every one of its users.
 *
 * Applied after apiKeyAuth so req.apiKey exists to key on.
 */
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator normalises IPv6 to a /64, which express-rate-limit v8
  // requires of any key derived from an address.
  keyGenerator: (req) =>
    req.apiKey?._id ? `key:${req.apiKey._id}` : `ip:${rateLimit.ipKeyGenerator(req.ip)}`,
  message: { error: 'Rate limit exceeded for this API key (60 requests/minute)' },
});

router.use(generalLimiter);
router.use(apiKeyAuth);
router.use(apiKeyLimiter);

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
