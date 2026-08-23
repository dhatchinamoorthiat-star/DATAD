/**
 * P10 — the test suite must not be able to reach the outside world.
 *
 * On 2026-08-22 an audit run sent real email to real people through the
 * production Brevo credentials. No test intended to: the suite simply ran in a
 * process where `.env` had been loaded, and `.env` is production. The mailer did
 * exactly what it is built to do with a working credential.
 *
 * The containment has three layers and this file asserts all three, because the
 * property that matters is that it holds for tests NOBODY HAS WRITTEN YET — the
 * incident was not caused by a test anyone had reviewed for safety.
 *
 *   1. safeEnv.js      deletes outbound credentials from process.env.
 *   2. blockExternal   rejects fetch() to a non-local host.
 *   3. socketGuard.js  the same for http/https.request and raw sockets, which
 *                      is where SMTP actually goes.
 */

const path = require('path');
const safeEnv = require('./setup/safeEnv');

describe('outbound credentials are absent', () => {
  it.each(safeEnv.ALL_FORBIDDEN)('%s is not set', (key) => {
    expect(process.env[key]).toBeUndefined();
  });

  it('covers every incident class the audit identified', () => {
    for (const group of ['mail', 'payments', 'ai', 'storage', 'observability']) {
      expect(safeEnv.FORBIDDEN_ENV[group].length).toBeGreaterThan(0);
    }
  });

  it('is not running in opt-in mode', () => {
    // If this fails, the rest of this file proves nothing.
    expect(safeEnv.externalCallsAllowed()).toBe(false);
  });
});

describe('the mailer cannot deliver', () => {
  it('reports itself unconfigured with the credentials removed', () => {
    const mailTransport = require('./../config/mailTransport');
    // The strong guarantee: not "the mailer is mocked" but "there is no code
    // path from this process to an inbox".
    expect(mailTransport.isConfigured()).toBe(false);
  });

  it('resolves a send as undelivered rather than attempting one', async () => {
    const mailer = require('./../config/mailer');
    const result = await mailer.sendAnnouncementEmail(
      [{ email: 'nobody@example.edu', name: 'Nobody' }],
      { title: 'test', body: 'test' }
    );
    expect(result.sent).toBe(0);
  });
});

describe('the network is blocked', () => {
  it('rejects a fetch to an external host', async () => {
    await expect(fetch('https://api.brevo.com/v3/smtp/email')).rejects.toMatchObject({
      code: 'DATAD_EXTERNAL_CALL_BLOCKED',
    });
  });

  it('rejects an https.request to an external host', () => {
    const https = require('https');
    expect(() => https.request('https://api.openai.com/v1/chat/completions')).toThrow(
      /blocked a real network call/
    );
  });

  it('rejects an http.request given options rather than a URL', () => {
    const http = require('http');
    expect(() => http.request({ hostname: 'api.razorpay.com', path: '/v1/orders' })).toThrow(
      /blocked a real network call/
    );
  });

  it('rejects a raw socket — the transport SMTP actually uses', () => {
    const net = require('net');
    expect(() => net.connect({ host: 'smtp-relay.brevo.com', port: 587 })).toThrow(
      /blocked a real network call/
    );
  });

  it('still allows localhost, so integration tests can run', () => {
    const net = require('net');
    // Throwing would break every test that binds an ephemeral port.
    expect(() => {
      const s = net.connect({ host: '127.0.0.1', port: 1 });
      s.on('error', () => {});
      s.destroy();
    }).not.toThrow();
  });
});

describe('the opt-in path is explicit and greppable', () => {
  it('is a separate npm script rather than a default', () => {
    const pkg = require('../package.json');
    expect(pkg.scripts.test).not.toContain('ALLOW_REAL_EXTERNAL_CALLS');
    expect(pkg.scripts['test:integration']).toContain('ALLOW_REAL_EXTERNAL_CALLS=1');
  });

  it('registers all three containment layers', () => {
    const pkg = require('../package.json');
    const all = [...(pkg.jest.setupFiles || []), ...(pkg.jest.setupFilesAfterEnv || [])].join(' ');
    expect(all).toContain('safeEnv');
    expect(all).toContain('blockExternalCalls');
    expect(all).toContain('socketGuard');
  });

  it('prefers .env.test over .env when one exists', () => {
    // The separation the sprint asked for: a file holding test database and
    // sandbox settings and no live credentials.
    const src = require('fs').readFileSync(
      path.join(__dirname, 'setup', 'safeEnv.js'), 'utf8'
    );
    expect(src).toContain('.env.test');
  });
});
