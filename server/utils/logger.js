const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');

/**
 * Structured JSON logger.
 *
 * Three things beyond "print the message":
 *
 * LEVELS. Everything used to be written unconditionally, so `logger.debug`
 * fired in production — the noisiest calls sit on the AI and notification
 * paths, which are also the busiest. LOG_LEVEL gates them; the default is
 * `debug` in development and `info` everywhere else, so production stops
 * paying for lines nobody reads.
 *
 * STREAMS. warn/error now go to stderr. Hosting platforms and log shippers
 * split the two streams by default, so writing failures to stdout put them in
 * the same bucket as routine chatter and made "show me only the errors"
 * impossible without parsing every line.
 *
 * CORRELATION. Each line used to carry its own random `id`, which is not a
 * correlation id — two lines from the same request got different values, so
 * there was no way to reconstruct what one failing request did. The id is now
 * per-request, assigned once by the requestContext middleware and picked up
 * automatically here, so every line a request produces shares one `requestId`.
 * Outside a request (schedulers, boot, background jobs) there is none, and the
 * field is simply absent rather than misleadingly unique.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const configured = (process.env.LOG_LEVEL || '').toLowerCase();
const DEFAULT_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const threshold = LEVELS[configured] ?? LEVELS[DEFAULT_LEVEL];

// Holds the current request's context for the duration of its async call tree.
const store = new AsyncLocalStorage();

const log = (level, message, meta = {}) => {
  if (LEVELS[level] > threshold) return;

  const ctx = store.getStore();
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    ...meta,
  };

  const line = JSON.stringify(logObject);
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
};

/** Run `fn` with a correlation id attached to every log line it produces. */
const runWithRequestId = (requestId, fn) => store.run({ requestId }, fn);

/** The current request's correlation id, if this is running inside one. */
const currentRequestId = () => store.getStore()?.requestId;

module.exports = {
  info: (message, meta = {}) => log('info', message, meta),
  warn: (message, meta = {}) => log('warn', message, meta),
  error: (message, meta = {}) => log('error', message, meta),
  debug: (message, meta = {}) => log('debug', message, meta),
  runWithRequestId,
  currentRequestId,
  newRequestId: () => randomUUID(),
  LEVELS,
  level: Object.keys(LEVELS).find((k) => LEVELS[k] === threshold),
};
