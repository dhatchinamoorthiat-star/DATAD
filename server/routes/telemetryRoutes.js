/**
 * Intake for frontend runtime errors.
 *
 * A React component that throws renders the ErrorBoundary fallback and the
 * server never hears about it. So the class of bug a student actually
 * experiences — a white screen, a broken page — was invisible in exactly the
 * way the Phase 2 report described for 500s: the first you learn of it is
 * someone telling you.
 *
 * Three properties this endpoint needs that a server-side capture does not:
 *
 *   It is unauthenticated. An error that breaks the login page happens before
 *   there is a token, and those are the worst ones. The token is read if
 *   present, so an authenticated report still names the student.
 *
 *   It is rate limited, hard. The URL is in the client bundle, so it is public,
 *   and a public write endpoint that fans out to a paid error tracker is a way
 *   to spend someone else's quota. `heavyLimiter` is per-IP and deliberately
 *   tight — losing some duplicate reports from a broken page costs nothing,
 *   because the first one already told us.
 *
 *   It trusts nothing in the payload. Everything is treated as a string of
 *   bounded length and passed through the tracker's scrubber. A field here is
 *   attacker-controlled by definition.
 */

const router = require('express').Router();
const { heavyLimiter } = require('../middleware/rateLimiters');
const errorTracker = require('../observability/errorTracker');
const jwt = require('jsonwebtoken');

const MAX_FIELD = 4000;

const str = (value, max = 500) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

/** Best-effort identity. A report is worth having with or without one. */
function userIdFrom(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET)?.userId;
  } catch {
    return undefined;
  }
}

/**
 * POST /api/telemetry/error
 *
 * Always answers 204, even when the payload is unusable. The client is already
 * in a failure state; making it handle an error from the error reporter is both
 * useless and a good way to produce a loop.
 */
router.post('/error', heavyLimiter, (req, res) => {
  try {
    const { message, stack, source, line, column, url, componentStack, kind } = req.body || {};

    const err = new Error(str(message, MAX_FIELD) || 'Unknown client error');
    err.name = str(kind, 100) || 'ClientError';
    err.stack = str(stack, MAX_FIELD) || err.stack;

    errorTracker.capture(err, {
      source: 'client',
      context: {
        // `url` is where the student was, which is the single most useful fact
        // and is not otherwise recoverable from a client-side report.
        url: str(url, 500),
        origin: str(source, 500),
        line: Number.isFinite(line) ? line : undefined,
        column: Number.isFinite(column) ? column : undefined,
        componentStack: str(componentStack, MAX_FIELD),
        userAgent: str(req.get('user-agent'), 200),
        userId: userIdFrom(req),
      },
    });
  } catch {
    // Swallowed on purpose — see the 204 note above.
  }
  res.status(204).end();
});

module.exports = router;
