/**
 * M6 — the error handler must never throw, and never narrate.
 *
 * The original crash: `Object.values(err.errors)[0]` runs for anything named
 * "ValidationError", but `err.errors` belongs to Mongoose's version alone. Any
 * other error with that name threw a TypeError *inside the error handler*,
 * leaving Express to answer with its own default — an HTML page carrying the
 * stack trace and absolute filesystem paths. The handler whose job is to keep
 * internals out of responses was the one that leaked them.
 *
 * Driven over real HTTP so the assertions are about what a client actually
 * receives, including the content type.
 */

const express = require('express');
const errorHandler = require('../middleware/errorHandler');

let server;
let base;

/** Whatever is thrown by the test is what the route throws. */
let thrown = new Error('unset');

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => { req.id = 'req-test-1'; next(); });
  app.use(express.json({ limit: '1kb' }));
  app.get('/boom', (_req, _res, next) => next(thrown));
  app.post('/echo', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => { await new Promise((r) => server.close(r)); });

async function boom(err) {
  thrown = err;
  const res = await fetch(`${base}/boom`);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* left null — asserted on */ }
  return { status: res.status, type: res.headers.get('content-type') || '', text, json };
}

/** Every response, whatever went wrong, must look like this. */
function expectWellFormed(r) {
  expect(r.type).toMatch(/application\/json/);
  expect(r.json).not.toBeNull();
  expect(typeof r.json.message).toBe('string');
  expect(typeof r.json.code).toBe('string');
  expect(r.json.requestId).toBe('req-test-1');
  // The failure mode being guarded: Express's HTML default handler.
  expect(r.text).not.toMatch(/<!DOCTYPE|<html|<pre>/i);
  expect(r.text).not.toMatch(/at \w+ \(\/|\.js:\d+:\d+/);
}

describe('the crash', () => {
  it('does not throw for a non-Mongoose error named ValidationError', async () => {
    // The exact reproduction: the name without the `errors` field.
    const err = new Error('bad input');
    err.name = 'ValidationError';

    const r = await boom(err);

    expect(r.status).toBe(400);
    expect(r.json.code).toBe('VALIDATION_FAILED');
    expectWellFormed(r);
  });

  it('still reads a real Mongoose ValidationError', async () => {
    const err = new Error('validation failed');
    err.name = 'ValidationError';
    err.errors = { email: { message: 'Email is required' } };

    const r = await boom(err);

    expect(r.status).toBe(400);
    expect(r.json.message).toBe('Email is required');
  });

  it('survives a ValidationError whose errors field is the wrong type', async () => {
    for (const errors of [null, 'a string', 42, []]) {
      const err = new Error('x');
      err.name = 'ValidationError';
      err.errors = errors;

      const r = await boom(err);
      expect(r.status).toBe(400);
      expectWellFormed(r);
    }
  });
});

describe('every error type produces valid JSON', () => {
  const cases = [
    ['TypeError', Object.assign(new TypeError("Cannot read properties of undefined (reading 'x')")), 500, 'INTERNAL_ERROR'],
    ['CastError', Object.assign(new Error('cast failed'), { name: 'CastError' }), 400, 'INVALID_IDENTIFIER'],
    ['duplicate key', Object.assign(new Error('E11000 duplicate key'), { code: 11000 }), 409, 'DUPLICATE_VALUE'],
    ['MongoServerError', Object.assign(new Error('connection to cluster0-shard-00.mongodb.net failed'), { name: 'MongoServerError' }), 503, 'DATABASE_UNAVAILABLE'],
    ['custom 403', Object.assign(new Error('Upgrade required'), { statusCode: 403 }), 403, 'REQUEST_REJECTED'],
    ['thrown 500', Object.assign(new Error('internal detail'), { statusCode: 500 }), 500, 'SERVER_ERROR'],
    ['unknown', new Error('something odd'), 500, 'INTERNAL_ERROR'],
  ];

  it.each(cases)('handles %s', async (_label, err, status, code) => {
    const r = await boom(err);
    expect(r.status).toBe(status);
    expect(r.json.code).toBe(code);
    expectWellFormed(r);
  });

  it('handles thrown values that are not Errors at all', async () => {
    // `null` and `undefined` are excluded deliberately: `next(null)` means "no
    // error, carry on" in Express and never reaches an error handler, so
    // asserting a 500 for them would be testing Express's routing, not this.
    for (const junk of ['a string', 42, { weird: true }, [], true]) {
      const r = await boom(junk);
      expect(r.status).toBe(500);
      expectWellFormed(r);
    }
  });

  it('is not reached at all when next() is called with no error', async () => {
    const r = await boom(null);
    expect(r.status).toBe(404);
  });
});

describe('it never narrates internals', () => {
  it('replaces a 5xx message rather than forwarding it', async () => {
    const r = await boom(Object.assign(new Error('Postgres auth failed for user admin'), { statusCode: 500 }));
    expect(r.text).not.toContain('Postgres');
    expect(r.json.message).toBe('Something went wrong');
  });

  it('does not name the database, host or driver', async () => {
    const r = await boom(Object.assign(new Error('connect ECONNREFUSED cluster0.abcd.mongodb.net:27017'), { name: 'MongoNetworkError' }));
    expect(r.text).not.toMatch(/mongodb\.net|27017/);
  });

  it('redacts a connection string quoted back by the driver', async () => {
    const r = await boom(Object.assign(
      new Error('failed on mongodb+srv://admin:hunter2@cluster0.abcd.mongodb.net/datad'),
      { statusCode: 400 }
    ));
    expect(r.text).not.toContain('hunter2');
    expect(r.text).toContain('[redacted-uri]');
  });

  it('redacts absolute filesystem paths', async () => {
    const r = await boom(Object.assign(new Error('ENOENT: /Users/deploy/datad/server/config/keys.js'), { statusCode: 400 }));
    expect(r.text).not.toContain('/Users/deploy');
    expect(r.text).toContain('[path]');
  });

  it('redacts an API key echoed by a provider', async () => {
    const r = await boom(Object.assign(new Error('401 from provider, key sk-abcdefghijklmnopqrstuvwxyz012345'), { statusCode: 400 }));
    expect(r.text).not.toContain('sk-abcdefghijklmnop');
  });

  it('redacts a JWT', async () => {
    const jwtish = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.s3cr3tsignature';
    const r = await boom(Object.assign(new Error(`bad token ${jwtish}`), { statusCode: 400 }));
    expect(r.text).not.toContain('s3cr3tsignature');
  });

  it('redacts a configured secret that appears verbatim in a message', async () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'super-secret-signing-value';
    try {
      const r = await boom(Object.assign(new Error('signing failed with super-secret-signing-value'), { statusCode: 400 }));
      expect(r.text).not.toContain('super-secret-signing-value');
    } finally {
      process.env.JWT_SECRET = previous;
    }
  });

  it('caps an enormous message rather than echoing it', async () => {
    const r = await boom(Object.assign(new Error('x'.repeat(50_000)), { statusCode: 400 }));
    expect(r.json.message.length).toBeLessThanOrEqual(300);
  });

  it('does not confirm which field was duplicated', async () => {
    // On /register, naming the field would confirm whether an email is
    // registered — the enumeration oracle the generic message avoids.
    const r = await boom(Object.assign(new Error('E11000 dup key: { email: "victim@example.edu" }'), { code: 11000 }));
    expect(r.text).not.toContain('victim@example.edu');
  });
});

describe('malformed and oversized request bodies', () => {
  it('answers malformed JSON with a stable code', async () => {
    const res = await fetch(`${base}/echo`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a": ',
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('MALFORMED_JSON');
    expect(body.requestId).toBe('req-test-1');
  });

  it('answers an oversized body — the AI-message case — with 413', async () => {
    const res = await fetch(`${base}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(5000) }),
    });
    const body = await res.json();
    expect(res.status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
