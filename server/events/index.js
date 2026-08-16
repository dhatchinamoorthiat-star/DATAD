/**
 * DATAD Event Bus — lightweight async event processing.
 *
 * MVP design:
 *   - Events are persisted to BusEvent collection in MongoDB
 *   - A worker process (worker.js) polls for pending events
 *   - Handlers are registered by event type prefix ("profile.", "recommendation.")
 *   - Failed events are retried up to MAX_RETRIES, then marked failed
 *
 * This is intentionally simple. When volume demands it, swap the MongoDB
 * polling for Redis pub/sub or a message queue. The emit/subscribe API
 * stays the same regardless of transport.
 */
const BusEvent = require('../models/BusEvent');

const MAX_RETRIES = 3;

// ── Registry ──────────────────────────────────────────────────────────
// Multiple handlers per prefix. All matching handlers run in sequence.
// Prefix "profile." matches "profile.refresh-needed" AND "profile.refreshed".

const _handlers = new Map();           // prefix → [handler, ...]
const _catchAll = [];                  // always-run handlers (logging, analytics)

function on(prefix, handler) {
  if (typeof handler !== 'function') throw new Error('Handler must be a function');
  if (!_handlers.has(prefix)) _handlers.set(prefix, []);
  _handlers.get(prefix).push(handler);
}

function onAny(handler) {
  _catchAll.push(handler);
}

// ── Emit ──────────────────────────────────────────────────────────────

async function emit(type, userId, data = {}) {
  const event = await BusEvent.create({ type, userId, data });
  process.nextTick(() => processEvent(event).catch((err) => {
    console.warn(`[events] Immediate processing of ${type} failed:`, err.message);
  }));
  return event;
}

// ── Process a single event ────────────────────────────────────────────

async function processEvent(event) {
  const handlers = _getHandlers(event.type);

  // Run all matching handlers (fan-out). A single handler failure does not
  // block others — each error is caught and recorded independently.
  let anyFailed = false;

  // 1. Domain-specific handlers (exact + prefix matches)
  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (err) {
      anyFailed = true;
      console.warn(`[events] Handler for ${event.type} failed:`, err.message);
    }
  }

  // 2. Catch-all handlers (always run, even if domain handlers fail)
  for (const handler of _catchAll) {
    try {
      await handler(event);
    } catch (err) {
      anyFailed = true;
      console.warn(`[events] Catch-all handler for ${event.type} failed:`, err.message);
    }
  }

  // Mark completed only if all handlers succeeded
  if (!anyFailed && handlers.length > 0) {
    await BusEvent.updateOne(
      { _id: event._id, status: 'processing' },
      { $set: { status: 'completed', processedAt: new Date() } }
    );
  } else if (handlers.length > 0) {
    const retryCount = (event.retryCount || 0) + 1;
    await BusEvent.updateOne(
      { _id: event._id },
      {
        $set: { status: retryCount >= MAX_RETRIES ? 'failed' : 'pending' },
        $inc: { retryCount: 1 },
      }
    );
    if (retryCount >= MAX_RETRIES) {
      console.warn(`[events] ${event.type} failed after ${MAX_RETRIES} retries`);
    }
  }
  // If no handlers match, event is left as 'processing' — worker will
  // skip it on next poll (already claimed) and TTL cleans it up.
}

function _getHandlers(type) {
  const results = [];

  // Exact match handlers
  if (_handlers.has(type)) {
    results.push(..._handlers.get(type));
  }

  // Prefix match handlers (longest prefix first)
  const prefixMatches = [];
  for (const [prefix, handlerList] of _handlers) {
    if (prefix !== type && type.startsWith(prefix)) {
      prefixMatches.push({ prefix, handlers: handlerList });
    }
  }
  prefixMatches.sort((a, b) => b.prefix.length - a.prefix.length);
  for (const match of prefixMatches) {
    results.push(...match.handlers);
  }

  return results;
}

// ── Worker: poll for pending events ───────────────────────────────────
// Called by the worker process on a timer. Picks up events that were
// emitted by the API server and need async processing.

async function pollBatch(batchSize = 20) {
  const pending = await BusEvent.find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(batchSize)
    .lean();

  for (const event of pending) {
    // Claim with atomic status transition (prevents double-processing)
    const claimed = await BusEvent.findOneAndUpdate(
      { _id: event._id, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true }
    );
    if (!claimed) continue; // Another worker got it

    await processEvent(claimed);
  }

  return pending.length;
}

// ── Initialization ────────────────────────────────────────────────────

function init() {
  // No special initialization needed for the MVP
  // Future: connect to message queue, start in-memory queue, etc.
}

module.exports = {
  emit,
  on,
  onAny,
  processEvent,
  pollBatch,
  init,
};
