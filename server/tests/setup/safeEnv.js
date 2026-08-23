/**
 * Test environment containment — runs before any module in a test file loads.
 *
 * The 2026-08-22 audit sent real email to real people through the production
 * Brevo credentials. Nothing in the test suite intended to; the tests simply
 * ran in a process where `.env` had been loaded, and `.env` is production. The
 * mailer did exactly what it is supposed to do with a working credential.
 *
 * `tests/helpers/testDb.js` had already solved the same problem for MongoDB —
 * it refuses to connect to a database whose name does not say "test" — and the
 * argument there applies unchanged to every other outbound credential. This is
 * that rule, generalised: a test process gets the configuration it needs to run
 * and none of the credentials that let it reach the outside world.
 *
 * The mechanism is subtraction, not mocking. With BREVO_API_KEY, SMTP_HOST and
 * GMAIL_USER absent, `mailTransport.resolveTransport()` returns null and every
 * send resolves `{ delivered: false, error: 'mailer_not_configured' }`. There
 * is no code path from a scrubbed environment to an inbox, so this holds for
 * tests nobody has written yet — which is the property that matters, because
 * the audit's mail was not sent by a test that was reviewed for safety.
 *
 * Opt-in: ALLOW_REAL_EXTERNAL_CALLS=1 leaves the environment untouched. It is a
 * deliberate, greppable act, and `blockExternalCalls.js` prints a warning when
 * it is set so it cannot be turned on and forgotten.
 *
 * Registered as jest `setupFiles` — see server/package.json.
 */

const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..', '..');

/**
 * Credentials that let this process spend money, send mail, or touch a resource
 * somebody outside the test run can observe.
 *
 * Grouped by what goes wrong when one survives into a test process. The groups
 * are not cosmetic: each is a distinct incident class, and a reviewer adding a
 * new provider needs to know which list it belongs in.
 */
const FORBIDDEN_ENV = {
  // Sends mail to real humans. This is the one that already happened.
  mail: [
    'BREVO_API_KEY', 'BREVO_SMTP_API_KEY', 'BREVO_FROM_EMAIL', 'BREVO_LOGIN',
    'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
    'GMAIL_USER', 'GMAIL_APP_PASSWORD',
    'MAIL_FROM',
  ],
  // Moves money, or creates chargeable objects on a live account.
  payments: [
    'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  ],
  // Costs credits per call, and rate limits shared with production.
  ai: [
    'GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
    'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY',
    'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'OLLAMA_API_KEY',
    'HUGGINGFACE_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY',
  ],
  // Mutates a shared external resource (uploads, deletions).
  storage: [
    'CLOUDINARY_URL', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_CLOUD_NAME',
  ],
  // Ships events to a real project, polluting production dashboards.
  observability: [
    'SENTRY_DSN', 'SENTRY_AUTH_TOKEN',
  ],
};

const ALL_FORBIDDEN = Object.values(FORBIDDEN_ENV).flat();

/** True when the operator has explicitly asked for live external calls. */
function externalCallsAllowed() {
  return process.env.ALLOW_REAL_EXTERNAL_CALLS === '1';
}

/**
 * Remove every outbound credential from the current process environment.
 *
 * Deletes rather than blanks. An empty string is falsy for the mailer's checks
 * today, but `SMTP_HOST=''` reaching `nodemailer.createTransport` is a different
 * kind of bug, and "the variable is not there" needs no reasoning at all.
 */
function scrub() {
  if (externalCallsAllowed()) return [];
  const removed = [];
  for (const key of ALL_FORBIDDEN) {
    if (process.env[key] !== undefined) {
      delete process.env[key];
      removed.push(key);
    }
  }
  return removed;
}

/**
 * Load configuration a test genuinely needs — MONGODB_URI, JWT_SECRET — from
 * `.env.test` when it exists, falling back to `.env`.
 *
 * `.env.test` is the separation the sprint asked for: a file that holds test
 * database and sandbox settings and no live credentials. The fallback to `.env`
 * exists because most contributors do not have one, and a suite that cannot
 * find MONGODB_URI simply does not run. The fallback is safe *because* of the
 * scrub below it, not because `.env` is safe.
 */
function loadEnvFile() {
  const dotenv = require('dotenv');
  const testEnv = path.join(SERVER_ROOT, '.env.test');
  const mainEnv = path.join(SERVER_ROOT, '.env');
  const target = fs.existsSync(testEnv) ? testEnv : mainEnv;
  if (fs.existsSync(target)) dotenv.config({ path: target });
  return target;
}

/**
 * Make later `dotenv.config()` calls harmless.
 *
 * Eleven test files call `require('dotenv').config({ path: '../.env' })` at the
 * top, which runs *after* this setup file and would put every credential
 * straight back. Rather than editing eleven files and relying on the twelfth
 * never being written, the loader itself is wrapped: dotenv still works, and
 * the scrub runs again immediately afterwards.
 */
function guardDotenv() {
  const dotenv = require('dotenv');
  if (dotenv.__datadGuarded) return;
  const realConfig = dotenv.config.bind(dotenv);
  dotenv.config = (...args) => {
    const result = realConfig(...args);
    scrub();
    return result;
  };
  dotenv.__datadGuarded = true;
}

loadEnvFile();
guardDotenv();
const removed = scrub();

// A test process is a test process. Several modules branch on this, and leaving
// it to the runner to set correctly is how a suite ends up running with
// production error formatting.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Deterministic, obviously-fake secrets, so a suite that needs to sign a token
// does not fall back to the production JWT_SECRET and does not fail outright.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

// Belt and braces for the mailer specifically: even if a future provider is
// added to config/mailTransport.js and its env var is not yet listed above,
// this makes the sender-verification poll a no-op rather than a live HTTP call.
process.env.BREVO_VERIFY_SENDS = 'false';

if (removed.length && process.env.DATAD_TEST_VERBOSE === '1') {
  // eslint-disable-next-line no-console
  console.log(`[test-safety] removed ${removed.length} outbound credential(s) from the test environment`);
}

module.exports = { FORBIDDEN_ENV, ALL_FORBIDDEN, scrub, externalCallsAllowed };
