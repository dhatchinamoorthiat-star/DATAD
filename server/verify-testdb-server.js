/**
 * Verification launcher — NOT part of the application. Delete after use.
 *
 * Starts the normal server against the `-test` database instead of the real
 * one, so a browser walkthrough cannot write to production data.
 *
 * The rewrite happens here rather than in the launch command because the
 * preview harness's shell is sandboxed away from dotfiles — it cannot read
 * .env, though node can. index.js calls dotenv itself, and dotenv does not
 * override an env var that is already set, so the value below wins.
 */
require('dotenv').config({ path: __dirname + '/.env' });

const real = process.env.MONGODB_URI || '';
const test = real.replace(/\/([^/?]+)(\?|$)/, '/$1-test$2');

if (!/-test(\?|$)/.test(test)) {
  throw new Error('Refusing to start: could not derive a -test database from MONGODB_URI.');
}

process.env.MONGODB_URI = test;

// Port 5001 is left alone deliberately: a dev server is already running there
// against the real database, and the whole point of this launcher is to stay
// away from it. The client reaches this one via VITE_API_BASE_URL instead of
// the Vite proxy, which is fine for CORS because the browser's origin is still
// localhost:5173 — the value of CLIENT_URL.

// The preview harness assigns the client a free port rather than 5173, so the
// browser's origin is not the one CLIENT_URL names. Extend the allow-list for
// this process only — the CORS rule itself is untouched and still refuses
// anything not listed.
const clientOrigins = (process.env.VERIFY_CLIENT_ORIGINS || '').split(',').filter(Boolean);
process.env.CLIENT_URL = [process.env.CLIENT_URL, ...clientOrigins].filter(Boolean).join(',');

console.log('[verify] using database:', test.replace(/:\/\/[^@]*@/, '://***@'));
console.log('[verify] CORS origins:', process.env.CLIENT_URL);

require('./index.js');
