/**
 * P4 regression — an error must actually reach the monitoring pipeline, and
 * must not carry anything it shouldn't.
 *
 * The sprint asked for an intentionally generated test error to be verified as
 * arriving. Verifying it arrives *at sentry.io* needs a real DSN and a live
 * network call, which the test-safety rules deliberately prevent (see
 * tests/setup/). So what is proven here is the part that is provable and is
 * also the part that actually broke: the seam. A forced 500 travels error
 * handler → tracker → transport with the correlation id, the environment and
 * the route attached, and the vendor is a swappable sink behind it.
 *
 * The redaction tests matter more than the delivery test. An error tracker's
 * whole job is copying production failures to a third party, so it is the one
 * component where a leak is exported rather than merely logged.
 */

const express = require('express');
const { startTestServer } = require('./helpers/httpAgent');

const errorTracker = require('../observability/errorTracker');
const errorHandler = require('../middleware/errorHandler');

afterEach(() => {
  jest.restoreAllMocks();
  errorTracker._reset();
});

describe('an intentionally generated error reaches the tracker', () => {
  /** The real stack: a route that throws, and the real error handler. */
  async function appThatThrows(thrower) {
    const app = express();
    app.use(express.json());
    app.use(require('../middleware/requestContext'));
    app.get('/api/boom', (req, res, next) => {
      try { thrower(); } catch (err) { next(err); }
    });
    app.use(errorHandler);
    return startTestServer(app);
  }

  it('captures a forced 500 with correlation id, environment and route', async () => {
    const capture = jest.spyOn(errorTracker, 'capture');
    const server = await appThatThrows(() => {
      throw new Error('intentional test error for monitoring verification');
    });

    try {
      const res = await server.request('GET', '/api/boom');

      // The student-facing half of the contract.
      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.requestId).toBeTruthy();
      expect(res.body.message).toBe('Something went wrong');

      // The operator-facing half: the same id, so a student quoting the id from
      // their screen finds this exact event.
      expect(capture).toHaveBeenCalledTimes(1);
      const [err, opts] = capture.mock.calls[0];
      expect(err.message).toContain('intentional test error');
      expect(opts.source).toBe('server');
      expect(opts.req.id).toBe(res.body.requestId);
    } finally {
      await server.close();
    }
  });

  it('builds an event carrying the facts an on-call reader needs', () => {
    const event = errorTracker.capture(new Error('boom'), {
      req: { method: 'POST', originalUrl: '/api/x?token=abc', id: 'req-42', route: { path: '/api/x' } },
      source: 'server',
    });

    expect(event).toMatchObject({
      level: 'error',
      source: 'server',
      name: 'Error',
      message: 'boom',
      method: 'POST',
      route: '/api/x',
      requestId: 'req-42',
    });
    expect(event.environment).toBeTruthy();
    expect(event.stack).toContain('Error: boom');
  });

  it('groups by route pattern rather than by concrete id', () => {
    // originalUrl would make /students/1 and /students/2 different issues, and
    // an alert that never groups is an alert nobody reads.
    const event = errorTracker.capture(new Error('x'), {
      req: { method: 'GET', originalUrl: '/api/students/6a8a50f6e3d5b32e', route: { path: '/api/students/:id' } },
    });
    expect(event.route).toBe('/api/students/:id');
  });

  it('reports a crash as fatal', () => {
    const event = errorTracker.capture(new Error('segfault-ish'), { source: 'crash', level: 'fatal' });
    expect(event.level).toBe('fatal');
    expect(event.source).toBe('crash');
  });
});

describe('what the tracker refuses to send', () => {
  const secretish = {
    password: 'hunter2',
    newPassword: 'hunter3',
    token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.sig',
    authorization: 'Bearer abcdefghijklmnopqrstuvwxyz',
    apiKey: 'sk-livekey1234567890abcdef',
    email: 'student@college.edu',
    bio: 'my private bio',
    difficultSubjects: ['statistics'],
    harmless: 'keep me',
  };

  it('redacts every sensitive key in a context object', () => {
    const scrubbed = errorTracker.scrubContext(secretish);

    for (const key of ['password', 'newPassword', 'token', 'authorization', 'apiKey', 'email', 'bio', 'difficultSubjects']) {
      expect(scrubbed[key]).toBe('[redacted]');
    }
    expect(scrubbed.harmless).toBe('keep me');
  });

  it('redacts secrets nested inside a context object', () => {
    const scrubbed = errorTracker.scrubContext({ body: { user: { password: 'hunter2', name: 'Alice' } } });
    expect(scrubbed.body.user.password).toBe('[redacted]');
    expect(scrubbed.body.user.name).toBe('Alice');
  });

  it('strips a live credential out of an error message', () => {
    process.env.GROQ_API_KEY = 'gsk_thisisaverysecretkeyvalue123';
    try {
      const event = errorTracker.capture(
        new Error('provider call failed with key gsk_thisisaverysecretkeyvalue123')
      );
      expect(event.message).not.toContain('gsk_thisisaverysecretkeyvalue123');
      expect(event.message).toContain('[redacted');
    } finally {
      delete process.env.GROQ_API_KEY;
    }
  });

  it('strips a connection string and a filesystem path from a stack', () => {
    const err = new Error('connect failed to mongodb+srv://admin:pw@cluster0.abc.mongodb.net/datad');
    const event = errorTracker.capture(err);
    expect(event.message).not.toContain('mongodb+srv://');
    expect(event.message).toContain('[redacted-uri]');
  });

  it('bounds a hostile context rather than walking it forever', () => {
    // The context can contain a request body, which is attacker-influenced.
    const deep = { a: { b: { c: { d: { e: { f: 'too far' } } } } } };
    expect(() => errorTracker.scrubContext(deep)).not.toThrow();

    const huge = { text: 'x'.repeat(50000) };
    expect(errorTracker.scrubContext(huge).text.length).toBeLessThan(3000);

    const cyclic = {};
    cyclic.self = cyclic;
    expect(() => errorTracker.scrubContext(cyclic)).not.toThrow();
  });

  it('never throws, whatever it is handed', () => {
    for (const junk of [null, undefined, 'a string', 42, {}, []]) {
      expect(() => errorTracker.capture(junk)).not.toThrow();
    }
  });
});

describe('transport configuration', () => {
  it('reports which sinks are active', () => {
    delete process.env.SENTRY_DSN;
    delete process.env.ERROR_WEBHOOK_URL;
    errorTracker._reset();

    const s = errorTracker.status();
    // The honest default: with nothing configured, the only sink is the log —
    // which is exactly the state the report called total blindness.
    expect(s).toMatchObject({ sentry: false, webhook: false, log: true });
  });

  it('activates the sentry sink once a DSN is present', () => {
    // @sentry/node is now a real dependency, so a DSN is all a deployment needs.
    // This is the assertion that would have caught the gap the release gate
    // found: the seam existed, the package did not, and the DSN did nothing.
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    errorTracker._reset();
    try {
      expect(errorTracker.status().sentry).toBe(true);
      expect(() => errorTracker.capture(new Error('boom'))).not.toThrow();
    } finally {
      delete process.env.SENTRY_DSN;
      errorTracker._reset();
    }
  });

  it('does not crash on boot when SENTRY_DSN is set but the package is absent', () => {
    // The optional-dependency contract, still worth pinning: the package can be
    // pruned by an install that skips optional deps, or fail to build on a
    // platform. A deployment in that state must start and fall back, not exit.
    process.env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    jest.isolateModules(() => {
      jest.doMock('@sentry/node', () => {
        throw new Error("Cannot find module '@sentry/node'");
      });
      const isolated = require('../observability/errorTracker');
      try {
        expect(() => isolated.capture(new Error('boom'))).not.toThrow();
        expect(isolated.status().sentry).toBe(false);
      } finally {
        jest.dontMock('@sentry/node');
      }
    });
    delete process.env.SENTRY_DSN;
    errorTracker._reset();
  });
});

describe('POST /api/telemetry/error', () => {
  async function telemetryApp() {
    const app = express();
    app.use(express.json());
    app.use(require('../middleware/requestContext'));
    app.use('/api/telemetry', require('../routes/telemetryRoutes'));
    app.use(errorHandler);
    return startTestServer(app);
  }

  it('accepts a frontend runtime error and routes it into the same pipeline', async () => {
    const capture = jest.spyOn(errorTracker, 'capture');
    const server = await telemetryApp();

    try {
      const res = await server.request('POST', '/api/telemetry/error', {
        body: {
          message: 'Cannot read properties of undefined (reading map)',
          stack: 'TypeError: ...\n  at Dashboard',
          componentStack: '  at Dashboard\n  at ErrorBoundary',
          kind: 'ReactRenderError',
          url: 'https://datad.app/dashboard',
        },
      });

      expect(res.status).toBe(204);
      expect(capture).toHaveBeenCalledTimes(1);
      const [err, opts] = capture.mock.calls[0];
      expect(err.name).toBe('ReactRenderError');
      expect(opts.source).toBe('client');
      expect(opts.context.url).toBe('https://datad.app/dashboard');
    } finally {
      await server.close();
    }
  });

  it('answers 204 even for an unusable payload, so it cannot start a loop', async () => {
    const server = await telemetryApp();
    try {
      expect((await server.request('POST', '/api/telemetry/error', { body: {} })).status).toBe(204);
      expect((await server.request('POST', '/api/telemetry/error', { body: { message: 42 } })).status).toBe(204);
    } finally {
      await server.close();
    }
  });

  it('bounds an oversized field rather than forwarding it whole', async () => {
    const capture = jest.spyOn(errorTracker, 'capture');
    const server = await telemetryApp();
    try {
      await server.request('POST', '/api/telemetry/error', { body: { message: 'x'.repeat(100000) } });
      expect(capture.mock.calls[0][0].message.length).toBeLessThanOrEqual(4000);
    } finally {
      await server.close();
    }
  });
});
