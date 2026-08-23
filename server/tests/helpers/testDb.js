/**
 * Test database connection.
 *
 * The integration suites write real documents and delete them again in
 * `afterAll`. Pointed at the application database that is a data-loss bug
 * waiting for the day someone runs `npm test` with a production MONGODB_URI
 * exported — the teardown would delete production rows.
 *
 * So tests never connect to MONGODB_URI directly. This helper resolves a
 * database whose name marks it as disposable, and refuses to connect to
 * anything else. The cluster is still whatever MONGODB_URI points at (no local
 * mongod or mongodb-memory-server is required); only the database differs.
 *
 * Resolution order:
 *   1. MONGODB_TEST_URI, if set — used verbatim, still name-checked.
 *   2. MONGODB_URI with its database name replaced by `<name>-test`.
 */

const mongoose = require('mongoose');

/**
 * Honour DNS_SERVERS here for the same reason index.js does: some networks
 * cannot resolve Atlas SRV records with the system resolver, and a
 * `mongodb+srv://` URI needs one lookup before it can connect at all.
 *
 * Without this the integration suites fail on those networks with
 * `querySrv ESERVFAIL`, which reads like a broken test rather than a resolver
 * problem — and the documented fix (set DNS_SERVERS) appeared to do nothing,
 * because only the server process was applying it.
 */
if (process.env.DNS_SERVERS) {
  require('node:dns').setServers(
    process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  );
}

// A database is safe to wipe only if its name says so. Substring rather than
// suffix so `datad-test-ci` and similar per-branch databases pass too.
const TEST_DB_PATTERN = /(^|[-_])test([-_]|$)/i;

function parseUri(uri) {
  // mongodb+srv://user:pass@host/dbname?opts — capture the path segment.
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
  if (!match) return null;
  return { prefix: match[1], dbName: match[2] || '', query: match[3] || '' };
}

/**
 * Jest runs suites in parallel workers, and every worker was pointed at the
 * same test database.
 *
 * That is a shared mutable resource across concurrent processes, and the suites
 * here all begin with `deleteMany({})`. So one suite's teardown wipes another
 * suite's fixtures mid-run, and the symptom is a test failing on a count or a
 * stale value while passing perfectly in isolation. `stockFetcher.test.js`
 * writes ~194 documents per refresh and its own header already described this
 * ("the in-flight refresh keeps writing — into the *next* test") — it failed in
 * a full run and passed alone, which is the signature.
 *
 * A per-worker suffix gives each worker its own database, so the isolation is
 * structural rather than a matter of which suites happen to be scheduled
 * together. `--runInBand` would also fix it, by making the whole suite serial
 * and much slower.
 *
 * JEST_WORKER_ID is set by jest and is 1-based; absent outside a worker.
 */
function workerSuffix() {
  // Per test FILE, not merely per worker.
  //
  // A worker suffix alone stops two workers colliding, but jest runs many
  // suites sequentially inside one worker, and they share that worker's
  // database. Every suite here opens with `deleteMany({})`, so a slow suite
  // whose writes are still in flight when the next one starts — stockFetcher
  // does ~194 upserts per refresh and its own header describes exactly this —
  // lands its documents in the next suite's freshly-cleared collections.
  //
  // The symptom is the one that wastes the most time: a suite that passes alone
  // and fails in a full run, at a different assertion each time. Keying on the
  // test file gives every suite a database nothing else touches, so the result
  // no longer depends on what happened to be scheduled beside it.
  const id = process.env.JEST_WORKER_ID || '0';

  let file = '';
  try {
    // Set by jest's expect state. Guarded because this helper is also required
    // from plain scripts, where no jest globals exist.
    const testPath = typeof expect !== 'undefined' && expect.getState?.().testPath;
    if (testPath) {
      file = String(testPath).split('/').pop().replace(/\.test\.js$/, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
    }
  } catch { /* not running under jest */ }

  return file ? `-${file}` : `-w${id}`;
}

function resolveTestUri() {
  if (process.env.MONGODB_TEST_URI) {
    // Still per-worker: an explicitly configured test URI has the same
    // concurrency problem, and silently ignoring it here would make the fix
    // depend on how the database was configured.
    const explicit = parseUri(process.env.MONGODB_TEST_URI);
    if (explicit?.dbName) {
      return `${explicit.prefix}/${explicit.dbName}${workerSuffix()}${explicit.query}`;
    }
    return process.env.MONGODB_TEST_URI;
  }

  const base = process.env.MONGODB_URI;
  if (!base) {
    throw new Error(
      'No database configured for tests. Set MONGODB_TEST_URI, or MONGODB_URI ' +
        'so a `-test` database can be derived from it.'
    );
  }

  const parts = parseUri(base);
  if (!parts || !parts.dbName) {
    throw new Error(
      'Could not derive a test database from MONGODB_URI (no database name in ' +
        'the connection string). Set MONGODB_TEST_URI explicitly.'
    );
  }

  return `${parts.prefix}/${parts.dbName}-test${workerSuffix()}${parts.query}`;
}

function assertDisposable(uri) {
  const parts = parseUri(uri);
  const dbName = parts && parts.dbName;

  if (!dbName || !TEST_DB_PATTERN.test(dbName)) {
    throw new Error(
      `Refusing to run tests against database "${dbName || '(none)'}". The ` +
        'suites delete documents in afterAll, so they only run against a ' +
        'database whose name contains "test". Set MONGODB_TEST_URI to a ' +
        'disposable database.'
    );
  }
}

async function connectTestDb() {
  const uri = resolveTestUri();
  assertDisposable(uri);
  await mongoose.connect(uri);
  return uri;
}

async function disconnectTestDb() {
  await mongoose.disconnect();
}

module.exports = { connectTestDb, disconnectTestDb, resolveTestUri, assertDisposable };
