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

function resolveTestUri() {
  if (process.env.MONGODB_TEST_URI) return process.env.MONGODB_TEST_URI;

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

  return `${parts.prefix}/${parts.dbName}-test${parts.query}`;
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
