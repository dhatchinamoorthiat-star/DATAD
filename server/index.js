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
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  logger.warn(
    'Mailer NOT configured (GMAIL_USER / GMAIL_APP_PASSWORD) — ' +
      'verification, welcome and password-reset emails will not be sent, ' +
      'which blocks new registrations from completing'
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
const { generalLimiter, authLimiter } = require('./middleware/rateLimiters');
const entertainmentRoutes = require('./routes/entertainmentRoutes');
const app = express();

// Behind a hosting proxy (Render/Railway/Vercel) the client IP is in
// X-Forwarded-For; trust one hop so rate limiting keys on the real IP.
app.set('trust proxy', 1);

// CLIENT_URL may be a comma-separated allow-list (e.g. prod + www + localhost).
const allowedOrigins = process.env.CLIENT_URL.split(',').map((o) => o.trim());
// ngrok tunnel URLs rotate on every restart (free tier) — allow the ngrok
// domains by pattern so the tunnel works without editing CLIENT_URL each time.
const NGROK_RE =
  /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.app|ngrok\.io)$/;

app.use(
  helmet({
    // The SPA is served from this same server; the app loads cover images from
    // external hosts (Unsplash, Google Photos), so a strict default CSP would
    // break them. Cross-origin isolation headers off for the same reason.
    contentSecurityPolicy: false,
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
      if (allowedOrigins.includes(origin) || NGROK_RE.test(origin)) {
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
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());
app.use('/api', generalLimiter);

// The platform health check routes traffic on this. Reporting "ok" without a
// database sends real users to an app where every request 500s, and no alert
// ever fires — so the DB connection state is the health check.
// readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
  });
});
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/albums', require('./routes/albumRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/resume', require('./routes/resumeRoutes'));
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
    const keys = await ApiKey.find({ user: req.user.userId }).select('name scopes lastUsedAt createdAt active').lean();
    res.json({ keys });
  } catch (err) { next(err); }
});
app.post('/api/keys', verifyToken, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Key name is required' });
    const key = await ApiKey.generate(name, req.user.userId);
    res.status(201).json({ key: key.key, name: key.name });
  } catch (err) { next(err); }
});
app.delete('/api/keys/:id', verifyToken, async (req, res, next) => {
  try {
    await ApiKey.deleteOne({ _id: req.params.id, user: req.user.userId });
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

  if (dbConnected) {
    bootAll();
    require('./notifications/NotificationStream').init();
    registerSchedulers();
  } else {
    logger.warn('Database-dependent services disabled');
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(() => {
      logger.info('HTTP server closed');
    });

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