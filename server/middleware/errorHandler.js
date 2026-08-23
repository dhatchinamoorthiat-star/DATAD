/**
 * The last thing that runs before a failure becomes a response.
 *
 * Two properties, and the second is easy to lose sight of while fixing the first.
 *
 * IT MUST NOT THROW. It used to. `Object.values(err.errors)[0]` reads a field
 * that only Mongoose's own ValidationError carries, and any other error named
 * "ValidationError" — a hand-rolled one, a library's, a class extending Error
 * with that name — reached it with `err.errors` undefined and threw a TypeError
 * *inside the error handler*. Express has nowhere left to send that: it falls
 * back to its own default handler, which in a non-production process replies
 * with an HTML page containing the stack trace and absolute filesystem paths.
 * So the one code path whose job is to keep internals out of responses was the
 * path that leaked them, and only for errors it did not anticipate — the ones
 * most likely to be interesting to an attacker.
 *
 * IT MUST NOT NARRATE. `err.message` is written by whoever threw, including
 * libraries: driver errors name hosts and databases, `fs` errors name absolute
 * paths, provider SDKs quote request URLs that carry keys. Anything at 5xx is
 * therefore replaced with a fixed string, and every message that does go out is
 * scrubbed. The correlation id is what connects the user's report to the log
 * line that has the detail.
 *
 * Every response from here has the same shape:
 *
 *   { message, code, requestId }
 *
 * `code` is stable and machine-readable; `message` is for a human and may be
 * reworded. Clients should branch on `code`.
 */

const logger = require('../utils/logger');

/**
 * Secret-shaped things that must never appear in a response body, even at 4xx.
 *
 * The env sweep is the reliable half: rather than guessing at the shape of every
 * credential, any *actual* configured secret value found in a message is
 * replaced. Pattern matching then covers secrets that were never in this
 * process's environment — a connection string quoted back by the driver, a key
 * echoed in a provider's error.
 */
const SECRET_ENV_KEYS = [
  'JWT_SECRET', 'MONGODB_URI', 'MONGO_URI',
  'BREVO_API_KEY', 'BREVO_SMTP_API_KEY', 'SMTP_PASS', 'GMAIL_APP_PASSWORD',
  'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  'GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY', 'DEEPSEEK_API_KEY',
  'MISTRAL_API_KEY', 'HUGGINGFACE_API_KEY', 'CLOUDFLARE_API_TOKEN',
  'CLOUDINARY_API_SECRET', 'CLOUDINARY_URL', 'SENTRY_DSN',
];

const REDACTIONS = [
  // Connection strings — these name the host, the database and the credentials.
  [/\bmongodb(?:\+srv)?:\/\/\S+/gi, '[redacted-uri]'],
  [/\b(?:postgres|postgresql|redis|amqp):\/\/\S+/gi, '[redacted-uri]'],
  // Absolute filesystem paths, which map the deployment for whoever reads them.
  [/(?:\/(?:Users|home|var|opt|srv|etc|root|app)\/)[^\s'"),;]*/g, '[path]'],
  [/[A-Za-z]:\\[^\s'"),;]*/g, '[path]'],
  // Common API-key shapes.
  [/\bsk-[A-Za-z0-9_-]{16,}/g, '[redacted-key]'],
  [/\bgsk_[A-Za-z0-9_-]{16,}/g, '[redacted-key]'],
  [/\bxkeysib-[A-Za-z0-9_-]{16,}/g, '[redacted-key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, 'Bearer [redacted]'],
  // A JWT, wherever it turns up.
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '[redacted-token]'],
];

/** Strip anything secret-shaped from a string bound for a response body. */
function redact(text) {
  let out = String(text ?? '');

  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key];
    // The length floor keeps a short or empty value from turning into a
    // find-and-replace over ordinary words.
    if (value && value.length >= 8) out = out.split(value).join('[redacted]');
  }
  for (const [re, replacement] of REDACTIONS) out = out.replace(re, replacement);

  return out;
}

/**
 * Report a 5xx to the error tracker.
 *
 * Required lazily and inside a try/catch for one reason: errorTracker requires
 * `redact` from this module, so a top-level require would be a cycle, and this
 * is the module that must not fail. If reporting is broken, the response is
 * still a correct JSON 500.
 */
function track(err, req) {
  try {
    // eslint-disable-next-line global-require
    require('../observability/errorTracker').capture(err, { req, source: 'server' });
  } catch {
    // Fall back to the plain log line this branch always produced.
    try {
      logger.error(err?.message || 'unhandled error', {
        stack: err?.stack,
        name: err?.name,
        method: req?.method,
        path: req?.originalUrl,
        userId: req?.user?.userId ? String(req.user.userId) : undefined,
        requestId: req?.id,
      });
    } catch { /* nothing left to try */ }
  }
}

/** Client-safe messages are short. A wall of text is a leak in progress. */
const MAX_MESSAGE = 300;

function clientMessage(raw, fallback) {
  const text = redact(raw).trim();
  if (!text) return fallback;
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text;
}

/** The single response shape. Never throws; never omits the correlation id. */
function respond(res, req, status, code, message) {
  if (res.headersSent) return undefined;
  return res.status(status).json({
    message,
    code,
    // Present even when the requestContext middleware did not run, so a client
    // can always quote something back.
    requestId: req?.id || null,
  });
}

const errorHandler = (err, req, res, next) => {
  try {
    // Nothing useful can be sent once the response has started streaming, and
    // trying corrupts what the client already has.
    //
    // Delegating rather than simply returning: Express's default handler is the
    // only thing that will close a half-written response, and returning here
    // left the socket open until it timed out. That matters on the SSE routes,
    // which are exactly the ones that fail after headers are sent — a hung
    // connection there costs a slot in the browser's per-origin pool and looks
    // to the student like the app quietly stopped updating.
    if (res.headersSent) return next(err);

    const name = err?.name;
    const code = err?.code;
    const type = err?.type;

    // ── Uploads ──────────────────────────────────────────────────────────
    if (name === 'MulterError') {
      if (code === 'LIMIT_FILE_SIZE') {
        return respond(res, req, 413, 'FILE_TOO_LARGE', 'File too large (max 10MB)');
      }
      return respond(res, req, 400, 'UPLOAD_REJECTED', 'That file could not be accepted');
    }
    if (err?.message === 'Only image files are allowed') {
      return respond(res, req, 415, 'UNSUPPORTED_MEDIA_TYPE', err.message);
    }

    // ── Malformed or oversized request bodies ────────────────────────────
    // body-parser errors. Previously these fell through to the `statusCode`
    // branch and returned the parser's own message, which quotes a fragment of
    // the offending payload back to the sender.
    if (type === 'entity.too.large') {
      return respond(res, req, 413, 'PAYLOAD_TOO_LARGE', 'That request was too large');
    }
    const isObjectError = typeof err === 'object' && err !== null;
    if (type === 'entity.parse.failed' || (name === 'SyntaxError' && isObjectError && 'body' in err)) {
      return respond(res, req, 400, 'MALFORMED_JSON', 'That request body was not valid JSON');
    }

    // ── Mongoose ─────────────────────────────────────────────────────────
    if (name === 'ValidationError') {
      // The crash. `err.errors` belongs to Mongoose's ValidationError alone, so
      // every other error carrying that name arrived here and threw. Guarded on
      // the field rather than on the name, because the name is the part anyone
      // can reuse.
      const details = err?.errors;
      const first = details && typeof details === 'object' ? Object.values(details)[0] : null;
      return respond(res, req, 400, 'VALIDATION_FAILED', clientMessage(first?.message, 'Invalid input'));
    }
    if (name === 'CastError') {
      return respond(res, req, 400, 'INVALID_IDENTIFIER', 'Invalid identifier');
    }
    if (code === 11000) {
      // Deliberately does not name the field: on /register that would confirm
      // whether an email is registered.
      return respond(res, req, 409, 'DUPLICATE_VALUE', 'That value is already taken');
    }
    if (name === 'MongoServerError' || name === 'MongoNetworkError' || name === 'MongooseServerSelectionError') {
      // These name hosts, replica set members and database names.
      logger.error('database error', {
        stack: err?.stack, name, method: req?.method, path: req?.originalUrl, requestId: req?.id,
      });
      return respond(res, req, 503, 'DATABASE_UNAVAILABLE', 'The service is temporarily unavailable');
    }

    // ── Deliberate application errors ────────────────────────────────────
    const status = Number(err?.statusCode || err?.status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      if (status >= 500) {
        // A thrown 5xx is still an internal failure; its message is no safer
        // for carrying a status code.
        logger.error(err?.message || 'server error', {
          stack: err?.stack, status, method: req?.method, path: req?.originalUrl, requestId: req?.id,
        });
        return respond(res, req, status, 'SERVER_ERROR', 'Something went wrong');
      }
      // 4xx messages are written for the caller on purpose — scrubbed anyway,
      // because "written on purpose" includes messages that interpolate a value
      // from the environment.
      return respond(
        res, req, status,
        typeof err?.errorCode === 'string' ? err.errorCode : 'REQUEST_REJECTED',
        clientMessage(err?.message, 'Request rejected')
      );
    }

    // ── Anything else ────────────────────────────────────────────────────
    // Reported as well as logged. This is the branch a student sees as
    // "Something went wrong", and before the tracker existed it produced one
    // line in a log stream nobody watches — no alert, no aggregation, no signal
    // that a deploy started it. The correlation id in the response body is the
    // same one on the event, so a student quoting it finds the exact failure.
    track(err, req);
    return respond(res, req, 500, 'INTERNAL_ERROR', 'Something went wrong');
  } catch (handlerFailure) {
    // The handler itself broke. This is the case whose absence produced an HTML
    // stack trace, so it answers with the minimum that is still valid JSON and
    // never touches `err` again.
    try {
      logger.error('error handler failed', { stack: handlerFailure?.stack });
    } catch { /* logging is not worth a second failure */ }
    if (!res.headersSent) {
      try {
        return res.status(500).json({ message: 'Something went wrong', code: 'INTERNAL_ERROR', requestId: req?.id || null });
      } catch { /* the socket is gone */ }
    }
    return undefined;
  }
};

module.exports = errorHandler;
module.exports.redact = redact;
