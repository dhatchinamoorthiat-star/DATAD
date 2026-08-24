/**
 * DATAD Worker — async event processor.
 *
 * Runs as a separate process alongside the Express API server.
 * Polls the BusEvent collection for pending events and processes them.
 *
 * Start with: node server/worker.js
 *
 * This is the preferred shape: a process of its own, so async work never blocks
 * the request path and the two scale separately. The same loop can also run
 * inside the API process (index.js, gated on RUN_WORKER_IN_PROCESS) because
 * Render has no free plan for background workers — see events/pollLoop.js for
 * that trade-off. Run one or the other; both is wasteful, though not incorrect.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const pollLoop = require('./events/pollLoop');
const errorTracker = require('./observability/errorTracker');

const REQUIRED_ENV = ['MONGODB_URI'];

/**
 * Crash capture, mirroring index.js.
 *
 * The worker needs this more than the API does, not less. An API crash is
 * noticed within minutes because requests start failing in front of people; a
 * worker crash is silent by construction — the queue simply stops draining, and
 * BusEvent rows pile up as `pending` with nothing reporting it. Render restarts
 * the process, so a crash loop can run for days as a flat line nobody is
 * watching.
 *
 * Exit is deferred by a tick so the sinks flush first.
 */
const fatal = (kind) => (err) => {
  console.error(`[worker] Fatal: ${kind}`, err);
  try {
    errorTracker.capture(err, { source: 'crash', level: 'fatal', context: { kind, process: 'worker' } });
  } catch { /* the stderr line above is the record of last resort */ }
  setTimeout(() => process.exit(1), 100).unref();
};
process.on('uncaughtException', fatal('uncaughtException'));
process.on('unhandledRejection', fatal('unhandledRejection'));

async function main() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('[worker] Missing required env vars:', missing.join(', '));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[worker] Connected to MongoDB');

  // Handler registration and the poll loop itself live in events/pollLoop.js,
  // shared with the in-process mode the API server runs on the free plan.
  const stop = pollLoop.start({ label: 'worker' });

  // ── Graceful shutdown ──────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`[worker] ${signal} received — stopping poll loop`);
    stop();
    await mongoose.disconnect().catch(() => {});
    console.log('[worker] Disconnected from MongoDB');
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // Boot failure — most often Mongo unreachable. Worth an alert of its own:
  // the process exits, Render restarts it, and a worker that never reaches the
  // poll loop looks identical from the outside to one with an empty queue.
  console.error('[worker] Fatal error:', err);
  try {
    errorTracker.capture(err, { source: 'crash', level: 'fatal', context: { kind: 'boot', process: 'worker' } });
  } catch { /* the stderr line above is the record of last resort */ }
  setTimeout(() => process.exit(1), 100).unref();
});
