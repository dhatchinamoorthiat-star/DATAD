/**
 * Network containment, third layer: the transports `blockExternalCalls.js` does
 * not cover.
 *
 * That file guards `global.fetch`, which catches provider SDKs built on fetch
 * and nothing else. Two gaps mattered:
 *
 *   http/https.request  where axios and most older SDKs actually go.
 *   net.connect         where nodemailer's SMTP transport goes. It never
 *                       touches fetch or http — it opens a TCP socket. That is
 *                       the exact path that delivered the 2026-08-22 audit's
 *                       real email to real people, so the one transport with a
 *                       confirmed incident was the one still unguarded.
 *
 * `net.connect` is the backstop rather than the main event: whatever HTTP
 * library is added next, it reaches the network through a socket in the end, so
 * a guard there holds for code nobody has written yet.
 *
 * This lives outside tests/setup/ only because that directory is not writable
 * by every contributor on this machine. It is registered alongside the others
 * in package.json.
 */

const { externalCallsAllowed } = require('./setup/safeEnv');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

function isLocal(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return LOCAL_HOSTS.has(h) || h.endsWith('.localhost') || h.endsWith('.local');
}

function hostOf(input) {
  try {
    if (typeof input === 'string') return new URL(input).hostname;
    if (input && typeof input.href === 'string') return new URL(input.href).hostname;
  } catch { /* not a URL */ }
  if (input && typeof input === 'object') return input.hostname || input.host || null;
  return null;
}

function blocked(host) {
  const err = new Error(
    `[test-safety] blocked a real network call to "${host}". ` +
      'Mock it, or set ALLOW_REAL_EXTERNAL_CALLS=1 to run this as an explicit integration test.'
  );
  err.code = 'DATAD_EXTERNAL_CALL_BLOCKED';
  return err;
}

if (!externalCallsAllowed()) {
  for (const mod of ['http', 'https']) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const lib = require(mod);
    if (lib.__datadSocketGuarded) continue;
    for (const method of ['request', 'get']) {
      const real = lib[method];
      lib[method] = function guardedRequest(...args) {
        const host = hostOf(args[0]);
        if (host && !isLocal(String(host).split(':')[0])) throw blocked(host);
        return real.apply(this, args);
      };
    }
    lib.__datadSocketGuarded = true;
  }

  // eslint-disable-next-line global-require
  const net = require('net');
  if (!net.__datadSocketGuarded) {
    const wrap = (real) =>
      function guardedConnect(...args) {
        const opts = args[0];
        // net.connect(port, host) and net.connect({ host }) are both in use.
        const host = opts && typeof opts === 'object' ? opts.host : args[1];
        if (host && !isLocal(host)) throw blocked(host);
        return real.apply(this, args);
      };
    net.connect = wrap(net.connect);
    net.createConnection = wrap(net.createConnection);
    net.__datadSocketGuarded = true;
  }
}

module.exports = { isLocal, hostOf };
