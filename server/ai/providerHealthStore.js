/**
 * Durable, cross-instance backing for the circuit breaker.
 *
 * The breaker is in-process, which means a benched provider is forgotten on
 * every restart and re-learned independently by every running instance. This
 * module gives that state a shared home without putting a database read on the
 * request path.
 *
 * ── Design ─────────────────────────────────────────────────────────────────
 * Write-through, read-behind:
 *
 *   • The in-memory breaker stays the authority for the current request. It is
 *     synchronous and costs nothing, and filterChain() runs on every single
 *     AI call — an await there would be a per-request round trip to Mongo to
 *     answer a question the process usually already knows.
 *   • State CHANGES are pushed to Mongo as they happen (fire-and-forget, one
 *     write per transition — not per failure).
 *   • Other instances' changes are pulled in on a timer.
 *
 * So this is eventually consistent, deliberately. The window is REFRESH_MS,
 * during which a second instance may waste one request rediscovering what the
 * first already knows. That is strictly better than the current situation
 * (every instance wastes a request on every call until it learns locally) and
 * far cheaper than making the hot path async.
 *
 * ── Merge rule: open wins ──────────────────────────────────────────────────
 * If any instance has benched a provider and the bench has not expired, this
 * instance benches it too. Being wrong in that direction costs one provider
 * from a chain of six. Being wrong the other way costs a failed round trip on
 * every request, which is the whole problem being solved.
 *
 * A bench is never open-ended: `openUntil` is a deadline, so a row left behind
 * by a crashed process expires on its own rather than benching a healthy
 * provider forever.
 *
 * ── Failure posture ────────────────────────────────────────────────────────
 * Every database interaction is optional. If Mongo is unreachable, unconfigured
 * or slow, this degrades silently to exactly the pre-existing in-memory
 * behavior. Nothing here may throw into a provider call.
 */

const mongoose = require('mongoose');
const circuitBreaker = require('./runtime-v2/circuitBreaker');

const REFRESH_MS = parseInt(process.env.AI_BREAKER_SYNC_MS || '20000', 10);
const ENABLED = process.env.AI_BREAKER_PERSIST !== '0';

// Distinguishes instances in the stored rows; useful when two disagree.
const INSTANCE_ID = `${process.pid}@${require('os').hostname()}`;

let _started = false;
let _timer = null;
let _hydrated = false;

function _connected() {
  return mongoose.connection?.readyState === 1;
}

function _model() {
  return require('../models/ProviderHealthState');
}

/** Persist one transition. Fire-and-forget by design — never awaited on the request path. */
function _persist(provider, change) {
  if (!ENABLED || !_connected()) return;

  _model()
    .updateOne(
      { provider },
      {
        $set: {
          circuitState: change.state,
          consecutiveFailures: change.consecutiveFailures || 0,
          openUntil: change.openUntil ? new Date(change.openUntil) : null,
          lastFailureAt: change.lastFailureTime ? new Date(change.lastFailureTime) : null,
          lastStateChange: new Date(),
          instanceId: INSTANCE_ID,
        },
      },
      { upsert: true }
    )
    .catch((err) => {
      console.warn(`[providerHealthStore] could not persist ${provider}: ${err.message}`);
    });
}

/**
 * Pull other instances' benches into this process.
 * @returns {Promise<string[]>} providers benched as a result of this refresh
 */
async function refresh() {
  if (!ENABLED || !_connected()) return [];

  try {
    const rows = await _model().find({ circuitState: 'open', openUntil: { $gt: new Date() } }).lean();
    const applied = [];
    for (const row of rows) {
      if (row.instanceId === INSTANCE_ID) continue;         // our own doing
      if (circuitBreaker.applyRemoteOpen(row.provider, row.openUntil)) {
        applied.push(row.provider);
      }
    }
    if (applied.length) {
      console.warn(`[providerHealthStore] benching ${applied.join(', ')} — benched by another instance`);
    }
    _hydrated = true;
    return applied;
  } catch (err) {
    console.warn(`[providerHealthStore] refresh failed: ${err.message}`);
    return [];
  }
}

/**
 * Begin persisting and syncing. Idempotent and non-blocking.
 *
 * Called from the request path (providerGuard.filterChain) rather than from
 * server startup, because server/index.js is not the only entrypoint — scripts
 * and workers make provider calls too, and a startup hook only covers the one
 * that remembers to call it. The first request or two may run on un-hydrated
 * state; that is the same state the process would have had anyway.
 */
function start() {
  if (_started || !ENABLED) return;
  _started = true;

  circuitBreaker.setTransitionListener(_persist);

  refresh().catch(() => {});
  _timer = setInterval(() => { refresh().catch(() => {}); }, REFRESH_MS);
  // Do not hold the process open — this is a background nicety, and a lingering
  // interval would stop scripts and test runs from exiting.
  if (typeof _timer.unref === 'function') _timer.unref();
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _started = false;
  _hydrated = false;
  circuitBreaker.setTransitionListener(null);
}

function status() {
  return { enabled: ENABLED, started: _started, hydrated: _hydrated, connected: _connected(), instanceId: INSTANCE_ID, refreshMs: REFRESH_MS };
}

module.exports = { start, stop, refresh, status, INSTANCE_ID };
