/**
 * Serve a built SPA through the production helmet configuration.
 *
 * A CSP can only really be tested by a browser: the header is a set of
 * instructions to the browser, and the failures it causes — a blocked script, a
 * blocked fetch, a blocked font — appear nowhere on the server. Unit tests can
 * assert the directives are what we intended; only a browser can tell us they
 * do not break the app.
 *
 * Usage:
 *   node scripts/cspPreview.js <path-to-built-spa> [port]
 *
 * It mounts the same helmet options index.js uses, so what the browser enforces
 * here is what it will enforce in the single-service deploy.
 */

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dist = process.argv[2];
const port = Number(process.argv[3]) || 5199;

if (!dist) {
  console.error('usage: node scripts/cspPreview.js <path-to-built-spa> [port]');
  process.exit(1);
}

const app = express();
app.use(helmet({ contentSecurityPolicy: require('../config/csp').cspOptions() }));
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(port, () => {
  console.log(`[csp-preview] serving ${dist} on http://localhost:${port}`);
});
