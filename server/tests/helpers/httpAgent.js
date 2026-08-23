/**
 * A minimal HTTP client for tests that need real middleware execution.
 *
 * Most suites here drive controllers with req/res doubles, which is the right
 * choice when the logic under test is the controller's. Rate limiting is not
 * like that: `express-rate-limit` reads `req.ip`, which Express derives from the
 * socket and the trust-proxy setting, and it writes headers through the real
 * response. A double would be testing the double.
 *
 * supertest would do this, and is not in the dependency tree. Adding a package
 * to assert on a middleware ordering bug is a poor trade when `node:http` and
 * `app.listen(0)` cover it in forty lines.
 */

const http = require('node:http');

/**
 * Start an Express app on an ephemeral port.
 *
 * @param {import('express').Express} app
 * @returns {Promise<{request: Function, close: Function, port: number}>}
 */
async function startTestServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  /**
   * @param {'GET'|'POST'|'PUT'|'DELETE'} method
   * @param {string} path
   * @param {{headers?: object, body?: any}} [opts]
   * @returns {Promise<{status: number, headers: object, body: any, text: string}>}
   */
  const request = (method, path, { headers = {}, body } = {}) =>
    new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method,
          path,
          headers: {
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...headers,
          },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (c) => { text += c; });
          res.on('end', () => {
            let parsed = null;
            try { parsed = JSON.parse(text); } catch { /* not JSON — `text` is the payload */ }
            resolve({ status: res.statusCode, headers: res.headers, body: parsed, text });
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });

  const close = () => new Promise((resolve) => server.close(resolve));

  return { request, close, port };
}

module.exports = { startTestServer };
