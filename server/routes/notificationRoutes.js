const router = require('express').Router();
const c = require('../controllers/notificationController');
const verifyToken = require('../middleware/verifyToken');
const jwt = require('jsonwebtoken');
const { sseHandler } = require('../notifications/NotificationStream');

// SSE endpoint needs special auth — EventSource can't send custom headers
const sseAuth = (req, res, next) => {
  // Check Authorization header first (standard)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return verifyToken(req, res, next);
  }
  // Fall back to query param token (EventSource)
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/stream', sseAuth, sseHandler);

// All other routes require standard auth
router.use(verifyToken);
router.get('/', c.list);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', c.markRead);
router.delete('/:id', c.remove);

module.exports = router;
