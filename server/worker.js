/**
 * DATAD Worker — async event processor.
 *
 * Runs as a separate process alongside the Express API server.
 * Polls the BusEvent collection for pending events and processes them.
 *
 * Start with: node server/worker.js
 * The API server (index.js) does NOT start the worker — they run independently
 * so async work never blocks the request path.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const events = require('./events');
const { registerHandlers } = require('./events/handlers');

const POLL_INTERVAL_MS = 5000;   // Check for new events every 5 seconds
const BATCH_SIZE = 20;
const REQUIRED_ENV = ['MONGODB_URI'];

async function main() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('[worker] Missing required env vars:', missing.join(', '));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[worker] Connected to MongoDB');

  // Register event handlers
  registerHandlers();

  // Poll loop
  console.log(`[worker] Polling every ${POLL_INTERVAL_MS}ms for pending events...`);

  const poll = async () => {
    try {
      const count = await events.pollBatch(BATCH_SIZE);
      if (count > 0) {
        console.log(`[worker] Processed ${count} event(s)`);
      }
    } catch (err) {
      console.error('[worker] Poll cycle failed:', err.message);
    }
  };

  // Initial poll, then interval
  await poll();
  const timer = setInterval(poll, POLL_INTERVAL_MS);

  // ── Graceful shutdown ──────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`[worker] ${signal} received — stopping poll loop`);
    clearInterval(timer);
    await mongoose.disconnect().catch(() => {});
    console.log('[worker] Disconnected from MongoDB');
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
