/**
 * Network containment for the test suite — the second layer under safeEnv.js.
 *
 * safeEnv removes the credentials, which is the strong guarantee: with no
 * BREVO_API_KEY there is no code path from a test to an inbox. This layer
 * assumes that guarantee has a hole in it — a hardcoded key in a fixture, a
 * provider whose env var nobody added to the list, a test that sets a real
 * credential itself — and catches the call at the last moment before it leaves
 * the machine.
 *
 * It fails loudly rather than silently. A test that tries to reach the open
 * internet gets an error naming the host and telling the reader how to opt in
 * on purpose, which is more useful than a mysterious timeout and far more
 * useful than a delivered email.
 *
 * localhost is exempt: supertest, and any local mongod or Ollama, are the
 * point of an integration test.
 *
 * Registered as jest `setupFilesAfterEnv` — see server/package.json.
 */

const { externalCallsAllowed } = require('./safeEnv');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

function isLocal(hostname) {
  const h = String(hostname || '').toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith('.localhost') || h.endsWith('.local');
}

function hostnameOf(input) {
  try {
    if (typeof input === 'string') return new URL(input).hostname;
    if (input && typeof input.url === 'string') return new URL(input.url).hostname;
    if (input && typeof input.href === 'string') return new URL(input.href).hostname;
  } catch {
    /* not a URL we can parse — treat as unknown below */
  }
  return null;
}

if (externalCallsAllowed()) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n[test-safety] ALLOW_REAL_EXTERNAL_CALLS=1 — this run may send real email, ' +
      'charge real payments, and spend real AI credits.\n'
  );
} else {
  const realFetch = global.fetch;

  /**
   * Wraps fetch rather than replacing it, so `jest.spyOn(global, 'fetch')` in a
   * test still takes precedence — a test that mocks its own fetch is already
   * making no real call, and should not have to know this guard exists.
   */
  global.fetch = function guardedFetch(input, init) {
    const host = hostnameOf(input);
    if (host && !isLocal(host)) {
      const err = new Error(
        `[test-safety] blocked a real network call to "${host}". ` +
          'Mock it, or set ALLOW_REAL_EXTERNAL_CALLS=1 to run this as an explicit integration test.'
      );
      err.code = 'DATAD_EXTERNAL_CALL_BLOCKED';
      return Promise.reject(err);
    }
    return realFetch.call(this, input, init);
  };
  global.fetch.__datadGuarded = true;
}
