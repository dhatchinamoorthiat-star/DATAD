/**
 * Error tracking — the aggregation layer the logging never had.
 *
 * The Phase 2 report scored this HIGH as an operational risk and it is worth
 * being precise about why, because "add Sentry" is the wrong summary. The
 * logging here is genuinely good: structured JSON, a correlation id carried
 * through AsyncLocalStorage, crash capture on both fatal handlers. What is
 * missing is not detail. It is that a 500 in front of a student produces one
 * line in Render's log stream and nothing else — no alert, no aggregation, no
 * "this started at 14:02, right after the deploy". Nobody is reading that
 * stream at 3am. The first you learn of an outage is a student telling you.
 *
 * So this deliberately does not introduce a vendor. It introduces the seam that
 * was missing, with three transports behind it:
 *
 *   sentry    @sentry/node, if it is installed and SENTRY_DSN is set. Lazily
 *             required so the package is a genuine optional dependency rather
 *             than a hard one.
 *   webhook   a POST to ERROR_WEBHOOK_URL. Slack, Discord, or anything that
 *             accepts JSON. Useful and free, and enough to get an alert.
 *   log       the default and the fallback: the existing structured logger.
 *             Not an improvement on its own, which is the honest position —
 *             an unconfigured tracker is a tracker nobody has configured.
 *
 * The seam matters more than the choice. Every 500, every crash, and every
 * frontend runtime error now funnels through `capture()`, so wiring a vendor is
 * one function, and the call sites never change again.
 *
 * WHAT IS NOT SENT
 *
 * Redaction is not best-effort here. `errorHandler.redact` sweeps configured
 * secret values and secret-shaped patterns out of any string, and `scrubContext`
 * below drops known-sensitive keys outright before anything is serialised. An
 * error tracker is a system whose entire job is to copy production failures to a
 * third party; it is the last place to be relaxed about what rides along.
 */

const logger = require('../utils/logger');
const { redact } = require('../middleware/errorHandler');

/** Keys whose values never leave this process, whatever an error carries. */
const SENSITIVE_KEYS = [
  'password', 'newpassword', 'currentpassword', 'confirmpassword',
  'token', 'accesstoken', 'refreshtoken', 'jwt', 'authorization', 'cookie',
  'apikey', 'api_key', 'secret', 'clientsecret', 'privatekey',
  'otp', 'pin', 'cvv', 'cardnumber', 'card',
  // Student data. A stack trace does not need a résumé attached to it.
  'resume', 'bio', 'notes', 'note', 'goals', 'difficultsubjects',
  'favouritesubjects', 'dreamrole', 'learningstyle', 'email', 'phone',
];

const MAX_DEPTH = 4;
const MAX_STRING = 2000;

/**
 * Recursively strip sensitive values from a context object.
 *
 * Depth- and size-limited: an error's `context` is attacker-influenced often
 * enough (a request body lands in it) that an unbounded walk is a denial of
 * service against our own reporting path.
 */
function scrubContext(value, depth = 0) {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return '[depth-limit]';

  if (typeof value === 'string') {
    const clean = redact(value);
    return clean.length > MAX_STRING ? `${clean.slice(0, MAX_STRING)}…[truncated]` : clean;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubContext(v, depth + 1));

  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 40)) {
      out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? '[redacted]' : scrubContext(v, depth + 1);
    }
    return out;
  }
  return undefined;
}

/**
 * The request facts worth having on an event, and nothing else.
 *
 * Query strings are dropped rather than redacted: they are the one place a
 * token most often appears by accident, and no debugging value they carry is
 * worth deciding case by case.
 */
function requestContext(req) {
  if (!req) return {};
  return {
    method: req.method,
    // `req.route?.path` is the pattern ("/students/:id"), which groups properly
    // in a tracker. originalUrl would create a distinct issue per id.
    route: req.route?.path || req.originalUrl?.split('?')[0],
    requestId: req.id || logger.currentRequestId(),
    userId: req.user?.userId ? String(req.user.userId) : undefined,
    userAgent: req.get?.('user-agent')?.slice(0, 200),
  };
}

// ── Transports ─────────────────────────────────────────────────────────────

let sentryClient;
let sentryTried = false;

/**
 * Load @sentry/node if it is both installed and configured.
 *
 * Wrapped in try/catch on the require itself: the package is optional, and a
 * deployment without it must start normally rather than crash on boot. That is
 * the difference between an optional dependency and a hard one that has not
 * been written down.
 */
function getSentry() {
  if (sentryTried) return sentryClient;
  sentryTried = true;

  if (!process.env.SENTRY_DSN) return null;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION,
      tracesSampleRate: 0,
      // Our own redaction has already run by the time an event is sent; this
      // stops Sentry's default integrations adding anything back.
      sendDefaultPii: false,
    });
    sentryClient = Sentry;
    logger.info('[observability] Sentry error tracking enabled');
  } catch (err) {
    logger.warn('[observability] SENTRY_DSN is set but @sentry/node is not installed', {
      hint: 'npm install @sentry/node --workspace server, or unset SENTRY_DSN',
      error: err.message,
    });
    sentryClient = null;
  }
  return sentryClient;
}

async function sendToWebhook(event) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch (err) {
    // A failing tracker must never become the incident. Logged at warn and
    // dropped: retrying an alert about an outage during the outage is how a
    // reporting path turns into an amplifier.
    logger.warn('[observability] error webhook failed', { error: err.message });
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Report an error.
 *
 * Never throws and never rejects — every call site is already on a failure path,
 * and an exception raised here would replace a handled 500 with an unhandled
 * one. Fire-and-forget by design; callers do not await it.
 *
 * @param {Error|string} err
 * @param {object} [options]
 * @param {import('express').Request} [options.req]
 * @param {'server'|'client'|'crash'|'job'} [options.source]
 * @param {'error'|'fatal'|'warning'} [options.level]
 * @param {object} [options.context]  extra facts; scrubbed before it is sent
 */
function capture(err, { req, source = 'server', level = 'error', context } = {}) {
  try {
    const event = {
      timestamp: new Date().toISOString(),
      level,
      source,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || 'unknown',
      message: redact(err instanceof Error ? err.message : String(err)),
      name: err instanceof Error ? err.name : 'Error',
      stack: err instanceof Error && err.stack ? redact(err.stack) : undefined,
      ...requestContext(req),
      ...(context ? { context: scrubContext(context) } : {}),
    };

    // Always logged, whatever else happens. The log is the record of last
    // resort, and it is the only sink that cannot be misconfigured.
    logger.error(`[tracked] ${event.message}`, {
      source, level, requestId: event.requestId, route: event.route, name: event.name,
    });

    const Sentry = getSentry();
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setLevel(level === 'fatal' ? 'fatal' : level);
        scope.setTag('source', source);
        // The correlation id as a tag, so the id a student quotes from a 500
        // response body finds the event directly.
        if (event.requestId) scope.setTag('requestId', event.requestId);
        if (event.route) scope.setTag('route', event.route);
        if (event.userId) scope.setUser({ id: event.userId });
        if (event.context) scope.setContext('detail', event.context);
        Sentry.captureException(err instanceof Error ? err : new Error(event.message));
      });
    }

    // Not awaited: see the note on capture() being fire-and-forget.
    sendToWebhook(event).catch(() => {});

    return event;
  } catch (trackerFailure) {
    try {
      logger.warn('[observability] errorTracker.capture failed', {
        error: String(trackerFailure?.message),
      });
    } catch { /* nothing left to try */ }
    return null;
  }
}

/** Which sinks are actually active. Used by the readiness/health surface. */
function status() {
  return {
    sentry: Boolean(process.env.SENTRY_DSN) && Boolean(getSentry()),
    webhook: Boolean(process.env.ERROR_WEBHOOK_URL),
    log: true,
    environment: process.env.NODE_ENV || 'development',
  };
}

/** Reset memoised transport state. Tests only. */
function _reset() {
  sentryClient = undefined;
  sentryTried = false;
}

module.exports = { capture, status, scrubContext, _reset, SENSITIVE_KEYS };
