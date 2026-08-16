const router = require('express').Router();
const jwt = require('jsonwebtoken');
const BetaEvent = require('../models/BetaEvent');

// Rate-limit for beta events: high ceiling since these fire on every interaction.
const rateLimit = require('express-rate-limit');
const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many events' },
});

// The client's primary send path is navigator.sendBeacon (chosen specifically
// because it's page-unload safe) — the Beacon API has no mechanism to set
// custom headers, so a standard verifyToken(Authorization header) middleware
// here can never succeed for that path: every event 401s, forever, on every
// page, regardless of what the client does. The token instead travels in the
// JSON body (see utils/analytics.js), which both sendBeacon and fetch can
// carry. Decoded best-effort — a missing or invalid token drops user
// attribution but must never fail the request; analytics is not allowed to
// error out the app or spam the console.
function decodeUserId(req) {
  const token = req.body?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch {
    return null;
  }
}

// POST /api/beta/events — record an analytics event.
// Body: { event, properties, sessionId, token }
router.post('/events', eventLimiter, async (req, res, next) => {
  try {
    const { event, properties, sessionId } = req.body;
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ message: 'Event name is required' });
    }

    const userId = decodeUserId(req);
    if (userId) {
      // Store the event (fire-and-forget — client doesn't wait). Anonymous
      // events (no/invalid token) are dropped rather than stored, since
      // BetaEvent.user is required — same effective behaviour as before,
      // just without rejecting the request.
      BetaEvent.create({
        user: userId,
        event: event.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        properties: properties || {},
        sessionId: sessionId || null,
        url: req.get('referer') || null,
      }).catch(() => {});
    }

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
