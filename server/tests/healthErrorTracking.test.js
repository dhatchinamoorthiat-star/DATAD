/**
 * P4 release gate — the health check must say whether error tracking is live.
 *
 * The failure this guards against is not a crash. It is a deploy where
 * SENTRY_DSN never made it into the environment: every call site works, every
 * test passes, and errors go to a log stream nobody reads. Nothing surfaces
 * that until the first incident, when the evidence is already gone. So the
 * health check — the one endpoint an operator and the platform both already
 * poll — states which sinks are actually carrying errors.
 */

const mongoose = require('mongoose');
const { startTestServer } = require('./helpers/httpAgent');
const errorTracker = require('../observability/errorTracker');

async function healthApp() {
  const express = require('express');
  const app = express();
  app.use(require('../routes/healthRoutes'));
  return startTestServer(app);
}

/**
 * Drive the connection state without connecting.
 *
 * `readyState` is a non-configurable accessor, so jest.spyOn cannot replace it
 * — but it has a real setter, and the tests here never open a socket, so
 * assigning it and putting it back is both sufficient and honest.
 */
function withReadyState(value, fn) {
  const previous = mongoose.connection.readyState;
  mongoose.connection.readyState = value;
  return fn().finally(() => {
    mongoose.connection.readyState = previous;
  });
}

const ORIGINAL = { dsn: process.env.SENTRY_DSN, hook: process.env.ERROR_WEBHOOK_URL };

afterEach(() => {
  if (ORIGINAL.dsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = ORIGINAL.dsn;
  if (ORIGINAL.hook === undefined) delete process.env.ERROR_WEBHOOK_URL;
  else process.env.ERROR_WEBHOOK_URL = ORIGINAL.hook;
  errorTracker._reset();
  jest.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('reports log-only when nothing is configured — the blind state', async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.ERROR_WEBHOOK_URL;
    errorTracker._reset();

    await withReadyState(1, async () => {
      const server = await healthApp();
      try {
        const res = await server.request('GET', '/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        // This exact string in a production response is the alarm, not the pass.
        expect(res.body.errorTracking).toBe('log');
      } finally {
        await server.close();
      }
    });
  });

  it('names the webhook sink once it is configured', async () => {
    delete process.env.SENTRY_DSN;
    process.env.ERROR_WEBHOOK_URL = 'https://hooks.example.com/abc';
    errorTracker._reset();

    await withReadyState(1, async () => {
      const server = await healthApp();
      try {
        const res = await server.request('GET', '/api/health');
        expect(res.body.errorTracking).toBe('webhook+log');
      } finally {
        await server.close();
      }
    });
  });

  it('never echoes the DSN or the webhook URL', async () => {
    process.env.SENTRY_DSN = 'https://publickey@o1.ingest.sentry.io/999';
    process.env.ERROR_WEBHOOK_URL = 'https://hooks.example.com/T00/B00/SECRETPATH';
    errorTracker._reset();

    await withReadyState(1, async () => {
      const server = await healthApp();
      try {
        const res = await server.request('GET', '/api/health');
        const body = JSON.stringify(res.body);
        // A webhook URL is a bearer credential: anyone holding it can post to
        // the channel. Health checks are public on most platforms.
        expect(body).not.toContain('SECRETPATH');
        expect(body).not.toContain('publickey');
        expect(body).not.toContain('ingest.sentry.io');
      } finally {
        await server.close();
      }
    });
  });

  it('still reports 503 when the database is gone', async () => {
    await withReadyState(0, async () => {
      const server = await healthApp();
      try {
        const res = await server.request('GET', '/api/health');
        expect(res.status).toBe(503);
        expect(res.body).toMatchObject({ status: 'degraded', database: 'disconnected' });
        // The sink report is present in the degraded case too: an outage is
        // precisely when you need to know whether anything is being recorded.
        expect(res.body.errorTracking).toEqual(expect.stringContaining('log'));
      } finally {
        await server.close();
      }
    });
  });

  it('survives a tracker that throws rather than failing the health check', async () => {
    jest.spyOn(errorTracker, 'status').mockImplementation(() => {
      throw new Error('tracker exploded');
    });

    await withReadyState(1, async () => {
      const server = await healthApp();
      try {
        const res = await server.request('GET', '/api/health');
        // Health is what the platform routes traffic on. A reporting detail
        // must never be able to take an instance out of the load balancer.
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.errorTracking).toBe('unknown');
      } finally {
        await server.close();
      }
    });
  });
});
