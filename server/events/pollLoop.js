/**
 * Shared BusEvent poll loop.
 *
 * Extracted from worker.js so the same loop can run in two places:
 *
 *   - server/worker.js — a dedicated Render worker service. The right shape
 *     once there is revenue: async work cannot touch the request path, and
 *     the service scales independently.
 *   - server/index.js — in-process alongside the API, gated on
 *     RUN_WORKER_IN_PROCESS. Render has no free plan for background workers
 *     (they start at `starter`), so on a free deployment this is the only way
 *     the queue drains at all. The alternative is not "a slower worker", it is
 *     BusEvent rows accumulating as `pending` forever and every talent flow,
 *     profile refresh and notification bridge silently doing nothing.
 *
 * The in-process mode is a cost decision, not a design preference. Its costs
 * are real and worth naming: the loop shares the API's event loop and its
 * 512 MB, and a sleeping free instance runs no polls — the same exposure the
 * 23 crons already have, and the same mitigation (keep the instance warm).
 * Move back to the worker service when the plan allows it; nothing here needs
 * to change to do that.
 */
const events = require('./index');
const { registerHandlers } = require('./handlers');
const errorTracker = require('../observability/errorTracker');

const POLL_INTERVAL_MS = 5000;   // Check for new events every 5 seconds
const BATCH_SIZE = 20;
// Consecutive failed poll cycles before a cycle failure is escalated to
// `fatal`. Three at a 5s interval is ~15s of a queue that is not draining —
// past a transient Mongo blip, short of paging on one bad batch.
const FAILURE_ALERT_THRESHOLD = 3;

/**
 * Register handlers and start polling. Returns a stop() to clear the timer.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.label]  process tag for logs and error context
 * @param {function} [opts.log]    line logger, defaults to console.log
 */
function start({ label = 'worker', log = console.log } = {}) {
  registerHandlers();
  log(`[${label}] Polling every ${POLL_INTERVAL_MS}ms for pending events...`);

  let consecutiveFailures = 0;

  const poll = async () => {
    try {
      const count = await events.pollBatch(BATCH_SIZE);
      if (count > 0) {
        log(`[${label}] Processed ${count} event(s)`);
      }
    } catch (err) {
      // A poll cycle throwing is not fatal — the interval fires again in 5s —
      // but it is exactly the failure that hides: the loop keeps running, the
      // process stays healthy, and no event is ever processed. `.message` alone
      // on stderr loses the stack, and nothing alerts on it.
      consecutiveFailures += 1;
      errorTracker.capture(err, {
        source: 'job',
        // A single blip is noise; a run of them means the queue has stopped
        // draining, which is the condition actually worth waking someone for.
        level: consecutiveFailures >= FAILURE_ALERT_THRESHOLD ? 'fatal' : 'error',
        context: {
          job: 'worker.pollBatch',
          process: label,
          batchSize: BATCH_SIZE,
          consecutiveFailures,
          pollIntervalMs: POLL_INTERVAL_MS,
        },
      });
      return;
    }
    consecutiveFailures = 0;
  };

  // Initial poll, then interval. Not awaited: in-process this runs during
  // server boot, and a slow first batch must not delay app.listen().
  poll();
  const timer = setInterval(poll, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}

module.exports = { start, POLL_INTERVAL_MS, BATCH_SIZE, FAILURE_ALERT_THRESHOLD };
