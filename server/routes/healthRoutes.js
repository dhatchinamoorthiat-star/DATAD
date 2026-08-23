/**
 * The platform health check.
 *
 * Lives in its own module rather than inline in index.js for one reason: what
 * it reports is now load-bearing for the release gate, and a handler that only
 * exists inside a fully booted app is a handler nobody tests.
 */

const router = require('express').Router();
const mongoose = require('mongoose');
const errorTracker = require('../observability/errorTracker');

/**
 * GET /api/health
 *
 * Reporting "ok" without a database sends real users to an app where every
 * request 500s, and no alert ever fires — so the DB connection state is the
 * health check.
 * readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
 */
router.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  // Which error sinks are live, reported rather than assumed. A tracker
  // configured everywhere except the one environment that matters is the normal
  // way this fails, and it fails silently: nothing looks wrong until the first
  // incident, and by then the evidence is gone. `errorTracking: "log"` on a
  // production health check is the signal that a DSN never reached the deploy.
  // Names of active sinks only — no DSN, no URL, nothing quotable.
  //
  // Wrapped, because health is what the platform routes traffic on. Reading the
  // sink list touches the lazy Sentry require, and a tracker that throws while
  // reporting its own state must not be able to pull an instance out of the
  // load balancer — the answer to "is this instance serving?" does not depend
  // on it.
  let errorTracking = 'unknown';
  try {
    const sinks = errorTracker.status();
    errorTracking = [sinks.sentry && 'sentry', sinks.webhook && 'webhook', 'log']
      .filter(Boolean)
      .join('+');
  } catch { /* 'unknown' is itself worth seeing */ }

  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    errorTracking,
  });
});

module.exports = router;
