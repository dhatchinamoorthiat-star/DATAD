require('dotenv').config();

const logger = require('./utils/logger');

// Initialize prompt registry on startup
const promptRegistry = require('./ai/runtime-v2/promptRegistry');
promptRegistry.init();

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error('Missing required env vars', { missing });
  process.exit(1);
}

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
const NGROK_RE = /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok\.app|ngrok\.io)$/;

app.use(
  helmet({
    // The SPA is served from this same server; the app loads cover images from
    // external hosts (Unsplash, Google Photos), so a strict default CSP would
    // break them. Cross-origin isolation headers off for the same reason.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / server-to-server calls (no Origin header).
      if (!origin || allowedOrigins.includes(origin) || NGROK_RE.test(origin)) {
        return cb(null, true);
      }
      const err = new Error('Not allowed by CORS');
      err.statusCode = 403;
      cb(err);
    },
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
app.use(hpp());
app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
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
app.use('/api/enhance', require('./routes/enhanceRoutes'));
// Migration Blueprint Phase 1 (P1-3): /api/chat and /api/ai are unmounted,
// not deleted. Traced every client call site — nothing targets either path
// anymore (the client moved to /api/dax). Unmounting first, rather than
// deleting the files, makes this reversible: if anything external was still
// depending on either route, it 404s immediately and shows up in logs,
// instead of a file deletion needing a git revert to undo. Delete the files
// in Phase 4 once an observation window confirms zero traffic.
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

// ── AI Observability ────────────────────────────────────────────────────────
// Installs non-invasive wrappers around aiGateway and runner to capture
// every AI request's metadata (provider, model, latency, tokens, cost, etc.)
// without modifying any existing AI code.
const aiTelemetry = require('./ai/telemetry');
aiTelemetry.install();
app.use('/api/admin/ai', require('./routes/observabilityRoutes'));

// Public read for placement countdown (available to all authenticated members).
const verifyToken = require('./middleware/verifyToken');
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

connectDB()
  .then(() => {
    bootAll();
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
    registerSchedulers();
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', { error: err.message });
    process.exit(1);
  });
