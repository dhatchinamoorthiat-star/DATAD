require('dotenv').config();
// Some local networks fail to resolve Atlas SRV records, so development can
// opt into public DNS. Never on by default: overriding the resolver in a
// managed environment (Render/Railway) breaks its internal DNS and private
// networking. Set DNS_SERVERS=8.8.8.8,8.8.4.4 locally if you need it.
if (process.env.DNS_SERVERS) {
  require('node:dns').setServers(
    process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  );
}
const logger = require('./utils/logger');
const mongoose = require('mongoose');

/**
 * Last-resort handlers, installed before anything else can throw.
 *
 * Node terminates the process on an unhandled rejection, and an uncaught
 * exception leaves it in an undefined state — so in both cases the right move
 * is to let it die and have the platform restart it. What was missing is the
 * record of *why*: without these the process vanishes, the platform reports
 * only a non-zero exit, and the stack trace goes to stderr in a shape nothing
 * parses. Everything else here logs structured JSON; a crash — the one event
 * most worth reading at 3am — was the exception.
 *
 * Exit is deferred by a tick so the log line is actually flushed first.
 */
const fatal = (kind) => (err) => {
  logger.error(`Fatal: ${kind}`, {
    kind,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  // A crash is the single event most worth an alert, and it is the one the log
  // stream is least likely to preserve usefully — the process is about to be
  // replaced. Wrapped because a failure inside the tracker must not stop the
  // exit below; the log line above has already been written either way.
  try {
    require('./observability/errorTracker').capture(err, { source: 'crash', level: 'fatal', context: { kind } });
  } catch { /* the log line is the record of last resort */ }
  setTimeout(() => process.exit(1), 100).unref();
};
process.on('uncaughtException', fatal('uncaughtException'));
process.on('unhandledRejection', fatal('unhandledRejection'));

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error('Missing required env vars', { missing });
  process.exit(1);
}

// Not fatal — the app runs fine without mail locally — but it must be loud.
// Registration gates on an email verification link, so a disabled mailer in
// production means no one can complete signup, with nothing in the logs
// beyond one warning buried at the first send attempt.
if (!require('./config/mailTransport').isConfigured()) {
  logger.warn(
    'Mailer NOT configured — verification, welcome and password-reset emails ' +
      'will not be sent, which blocks new registrations from completing. ' +
      'Set RESEND_API_KEY + MAIL_FROM (preferred), or SMTP_HOST/SMTP_USER/SMTP_PASS, ' +
      'or GMAIL_USER/GMAIL_APP_PASSWORD.'
  );
}

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
// authLimiter is no longer imported here — it is applied to /login inside
// routes/authRoutes.js, alongside the other per-endpoint limiters.
const { generalLimiter } = require('./middleware/rateLimiters');
const entertainmentRoutes = require('./routes/entertainmentRoutes');
const app = express();

// Behind a hosting proxy (Render/Railway/Vercel) the client IP is in
// X-Forwarded-For; trust one hop so rate limiting keys on the real IP.
app.set('trust proxy', 1);

// CLIENT_URL may be a comma-separated allow-list (e.g. prod + www + localhost).
// The ngrok tunnel exception lives in utils/clientUrl.js alongside the rule for
// emailed links, so the two cannot drift apart — a host we would not accept as
// a CORS origin is also a host we will not put in a password-reset email. Both
// exceptions are development-only; in production only CLIENT_URL is trusted.
const { isAllowedCorsOrigin } = require('./utils/clientUrl');

// First in the chain: everything logged after this point, including the CORS
// rejection below and anything the error handler reports, carries the id.
app.use(require('./middleware/requestContext'));

app.use(
  helmet({
    // A real policy, defined in config/csp.js.
    //
    // This was `false` — the whole header off — because helmet's default
    // `img-src 'self'` broke the external cover images the app loads from
    // Unsplash and Google Photos. That is a one-directive problem, and turning
    // off the other eleven to solve it also removed the only thing standing
    // between an XSS bug and the JWT in localStorage. See config/csp.js.
    //
    // Set CSP_REPORT_ONLY=true to observe violations without blocking anything.
    contentSecurityPolicy: require('./config/csp').cspOptions(),

    // Still off. COEP requires every cross-origin resource to opt in via CORP
    // or CORS, and the external image hosts above do not — enabling it would
    // break exactly the images the CSP above was written to keep working.
    crossOriginEmbedderPolicy: false,

    // ─── Hardened headers ──────────────────────────────────────────────
    // HSTS: enforce HTTPS for 1 year + preload eligible (set after verifying HTTPS works)
    hsts: {
      maxAge: 31536000,        // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Referrer policy: strict-origin-when-cross-origin balances privacy & analytics
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Permissions policy: restrict powerful browser features
    permissionsPolicy: {
      features: {
        accelerometer: [],
        camera: [],
        geolocation: [],
        gyroscope: [],
        magnetometer: [],
        microphone: [],
        payment: [],
        usb: [],
        'xr-spatial-tracking': [],
      },
    },
    // X-DNS-Prefetch-Control: off (helmet default: 'off')
    dnsPrefetchControl: { allow: false },
    // X-Download-Options: noopen (helmet default for IE)
    ieNoOpen: true,
    // X-Permitted-Cross-Domain-Policies: none (helmet default)
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);
app.use(
  cors({
    origin: (origin, cb) => {
      // No Origin header: same-origin navigation, curl, or a server-to-server
      // call. There is no cross-site request to protect against, so allow it.
      if (!origin) return cb(null, true);
      if (isAllowedCorsOrigin(origin)) {
        return cb(null, true);
      }
      logger.warn('Blocked CORS origin', { origin });
      // Tagged so errorHandler answers 403 rather than a generic 500.
      const err = new Error('Not allowed by CORS');
      err.statusCode = 403;
      return cb(err);
    },
    credentials: true,
  })
);
// The raw bytes are kept alongside the parsed body because the Razorpay
// webhook signs the body exactly as sent. Re-serialising req.body cannot
// reproduce those bytes — key order and whitespace are not preserved — so
// without this the signature check can only ever fail. Capped by the same
// 1mb limit, and it costs nothing on every other route: Node has already
// buffered this exact Buffer to parse it.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      if (req.originalUrl === '/api/subscription/webhook') req.rawBody = buf;
    },
  })
);
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());
app.use('/api', generalLimiter);

// The health check lives in routes/healthRoutes.js — it reports database
// connectivity and which error sinks are active, and both are testable there.
app.use(require('./routes/healthRoutes'));

// No prefix-wide limiter here, deliberately.
//
// This line used to read `app.use('/api/auth', authLimiter, ...)`, and that one
// middleware argument was the whole of H5. Every request under /api/auth passed
// through a single 300-per-15-minutes counter keyed on the network address —
// including GET /auth/me, which AuthContext calls on every page load. On a
// campus NAT the arithmetic is brutal: 137 scripted /check-email calls from one
// actor exhausted the shared budget, and every *authenticated* student behind
// that address then got 429 on /auth/me and could not load the app, while their
// requests to /tasks kept returning 200 because that route runs on the
// account-keyed generalLimiter. It presents as an outage and it is caused by one
// person. It was reproduced twice — the second time by accident, when a load
// test could not register 40 accounts.
//
// Splitting it per route was not enough on its own: a limiter mounted here runs
// *before* the router, so the shared bucket was still charged for every call no
// matter how the individual routes were configured. The endpoint-specific
// limiters now live in routes/authRoutes.js, next to the handlers whose threat
// model they encode, and authenticated routes under this prefix (/me, /profile,
// /password, /devices) fall through to the per-account generalLimiter applied to
// /api above — the same protection every other authenticated route already had.
app.use('/api/auth', require('./routes/authRoutes'));
// Frontend runtime errors. Unauthenticated by necessity — the errors worth
// hearing about most are the ones that break the page before sign-in.
app.use('/api/telemetry', require('./routes/telemetryRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/albums', require('./routes/albumRoutes'));
// Photos live inside albums, so this mount is what makes a hosted album
// (one holding uploaded files rather than a Google Photos link) possible.
app.use('/api/photos', require('./routes/photoRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/resume', require('./routes/resumeRoutes'));
app.use('/api/linkedin', require('./routes/linkedinRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/intelligence', require('./routes/intelligenceRoutes'));
app.use('/api/entertainment', entertainmentRoutes);
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/readiness', require('./routes/readinessRoutes'));
app.use('/api/journal', require('./routes/journalRoutes'));
app.use('/api/dax', require('./routes/daxRoutes'));
// /api/chat and /api/ai were unmounted (client moved to /api/dax).
// Files have been deleted. No traffic observed since unmounting.
// app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/daily-case', require('./routes/dailyCaseRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
// app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/placements', require('./routes/placementRoutes'));
app.use('/api/internships', require('./routes/internshipRoutes'));
app.use('/api/skills', require('./routes/skillRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/study-tools', require('./routes/studyToolsRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/feed', require('./routes/feedRoutes'));
app.use('/api/directory', require('./routes/directoryRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/marketplace', require('./routes/marketplaceRoutes'));
app.use('/api/talent', require('./routes/talentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/star-stories', require('./routes/starStoryRoutes'));
app.use('/api/pivot', require('./routes/pivotRoutes'));

// Module system — program enrollment and switching
app.use('/api/modules', require('./routes/moduleRoutes'));

// Universal Search — registry-based search across all providers
const { registerAll: registerSearchProviders, searchRouter } = require('./search');
registerSearchProviders();
app.use('/api/search', searchRouter);

// Content Studio — centralized publishing engine.
// Rollback: set STUDIO_ENABLED=false to hide it (per-module uploads unaffected).
if (process.env.STUDIO_ENABLED !== 'false') {
  app.use('/api/studio', require('./routes/studioRoutes'));
}

// New AI-generated content routes
app.use('/api/briefing', require('./routes/briefingRoutes'));
app.use('/api/reflection', require('./routes/reflectionRoutes'));
app.use('/api/resume-tip', require('./routes/resumeTipRoutes'));
app.use('/api/automation', require('./routes/automationRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));

// ── Public API (API key authentication) ───────────────────────────────────
app.use('/api/v1', require('./routes/apiGateway'));

// ── Developer API key management ──────────────────────────────────────────
const verifyToken = require('./middleware/verifyToken');
const ApiKey = require('./models/ApiKey');
app.get('/api/keys', verifyToken, async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ user: req.user.userId })
      .select('name keyPrefix scopes lastUsedAt createdAt active')
      .lean();
    res.json({ keys });
  } catch (err) { next(err); }
});
app.post('/api/keys', verifyToken, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Key name is required' });
    const key = await ApiKey.generate(name, req.user.userId);
    // The only time the raw key exists outside the developer's hands. Only the
    // hash is stored, so this response cannot be reproduced later — the client
    // has to tell the user to copy it now.
    res.status(201).json({ key: key.raw, name: key.name, oneTime: true });
  } catch (err) { next(err); }
});
app.delete('/api/keys/:id', verifyToken, async (req, res, next) => {
  try {
    // Scoped to the caller, so a wrong id and someone else's id are the same
    // case — both delete nothing, and both must read as "not found" rather
    // than a success that silently revoked nothing.
    const { deletedCount } = await ApiKey.deleteOne({ _id: req.params.id, user: req.user.userId });
    if (!deletedCount) return res.status(404).json({ message: 'Key not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Beta analytics events ────────────────────────────────────────────────
app.use('/api/beta', require('./routes/betaRoutes'));

// ── AI Observability ────────────────────────────────────────────────────────
// Installs non-invasive wrappers around aiGateway and runner to capture
// every AI request's metadata (provider, model, latency, tokens, cost, etc.)
// without modifying any existing AI code.
const aiTelemetry = require('./ai/telemetry');
aiTelemetry.install();
app.use('/api/admin/ai', require('./routes/observabilityRoutes'));

// Public read for placement countdown (available to all authenticated members).
const SiteMeta = require('./models/SiteMeta');
app.get('/api/meta', verifyToken, async (req, res, next) => {
  try {
    const meta = await SiteMeta.findOne({ key: 'main' }).select('placementDate batchName').lean();
    res.json(meta || {});
  } catch (err) { next(err); }
});
app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));

// Serve the built React app from this same server (single ngrok tunnel /
// single-service deploy). Run `npm run build` in client/ to create dist.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET serves index.html so client routing works.
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
}

app.use(errorHandler);
const PORT = process.env.PORT || 5000;
const { register: registerSchedulers } = require('./schedulers');
const { register: registerModule, bootAll } = require('./modules/registry');

registerModule('general', require('./modules/general'));
registerModule('mba', require('./modules/mba'));

async function startServer() {
  let dbConnected = false;

  try {
    await connectDB();
    dbConnected = true;
    logger.info('MongoDB connected');
  } catch (err) {
    // Locally, booting without Mongo is useful for UI work. In production it
    // is never useful: the process would pass its health check and then fail
    // every request. Exit so the platform keeps the last good deploy live.
    if (process.env.NODE_ENV === 'production') {
      logger.error('MongoDB connection failed — refusing to start', {
        error: err.message,
      });
      process.exit(1);
    }
    logger.warn('MongoDB unavailable — starting in local development mode', {
      error: err.message,
    });
  }

  let stopPollLoop = null;

  if (dbConnected) {
    bootAll();
    require('./notifications/NotificationStream').init();
    registerSchedulers();

    // BusEvent consumer, normally its own Render service (server/worker.js).
    // Render has no free plan for background workers, so on a free deployment
    // this flag is the only way the queue drains — unset, every talent flow,
    // profile refresh and notification bridge writes rows that stay `pending`
    // forever. Turn it OFF the moment the dedicated worker service is running:
    // both polling the same collection is wasteful, though not incorrect
    // (pollBatch claims each row with an atomic status transition).
    //
    // Parsed leniently and reported either way. A strict === 'true' fails
    // silently against `True`, `1`, or a YAML boolean that the platform
    // serialised differently than expected — and the symptom of that failure is
    // nothing at all: no error, no log, just a queue that never drains. A flag
    // whose only feedback is the absence of a symptom is not a flag.
    const rawWorkerFlag = (process.env.RUN_WORKER_IN_PROCESS ?? '').trim();
    const flag = rawWorkerFlag.toLowerCase();
    const TRUTHY = ['true', '1', 'yes', 'on'];
    const FALSY = ['', 'false', '0', 'no', 'off'];

    if (TRUTHY.includes(flag)) {
      logger.warn('Event worker running in-process — shares this instance CPU and memory');
      stopPollLoop = require('./events/pollLoop').start({
        label: 'worker:in-process',
        log: (line) => logger.info(line),
      });
    } else if (!FALSY.includes(flag)) {
      // Set to something we do not recognise. Treated as off, but say so —
      // this is the case that would otherwise look identical to "not set".
      logger.error('RUN_WORKER_IN_PROCESS is set to an unrecognised value — event worker is OFF', {
        value: rawWorkerFlag,
        expected: TRUTHY.join('/'),
      });
    } else {
      logger.info('Event worker not running in-process (RUN_WORKER_IN_PROCESS is off)');
    }
  } else {
    logger.warn('Database-dependent services disabled');
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    // Announced at boot, not merely reportable via /api/health: an unmonitored
    // production deploy looks exactly like a healthy one until something breaks.
    require('./observability/errorTracker').warnIfUnmonitored();
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(() => {
      logger.info('HTTP server closed');
    });

    if (stopPollLoop) stopPollLoop();

    if (dbConnected) {
      try {
        require('./notifications/NotificationStream').shutdown();
      } catch {}

      mongoose.disconnect().catch(() => {});
    }

    setTimeout(() => {
      logger.info('Forced shutdown after timeout');
      process.exit(0);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();