/**
 * H5 regression — one student must not be able to lock out a campus.
 *
 * The Phase 2 reproduction, measured against a live server:
 *
 *     first 429 after 137 unauthenticated /check-email calls
 *     authenticated GET /auth/me  from the same IP afterwards -> 429   LOCKED OUT
 *     authenticated GET /tasks    from the same IP afterwards -> 200   (unaffected)
 *
 * The contrast in those last two lines is the whole finding. /tasks runs on the
 * account-keyed `generalLimiter`, so it was fine. /auth/me sat behind a
 * prefix-wide, IP-keyed `authLimiter` shared with anonymous typeahead, so one
 * actor — or one busy signup morning — made the app fail to load for everyone
 * behind that NAT address. AuthContext calls /auth/me on every page load, so
 * "locked out of /auth/me" means "the app does not open".
 *
 * These tests build a small Express app wired exactly the way index.js and
 * authRoutes.js wire the real one, and drive real HTTP through the real
 * middleware. Asserting on the limiter configuration alone would not have caught
 * the actual bug: the per-route limiters were already correct *and the app still
 * failed*, because a limiter mounted on the prefix runs before the router ever
 * reaches them.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { startTestServer } = require('./helpers/httpAgent');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

const tokenFor = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const CAMPUS_IP = '203.0.113.7';

/**
 * The real wiring, minus the handlers.
 *
 * `app.use('/api', generalLimiter)` then `app.use('/api/auth', router)` — with
 * NO limiter argument on the second line. That missing argument is the fix.
 *
 * The limiter module is re-required through a reset registry every time, because
 * each `rateLimit()` instance owns an in-memory store that lives as long as the
 * module does. Without the reset, the first test to spend a bucket would leave
 * it spent for every test after it, and the suite would report failures that say
 * nothing about the code.
 */
function buildApp() {
  jest.resetModules();
  const limiters = require('../middleware/rateLimiters');

  const app = express();
  app.use(express.json());
  // Mirrors index.js. `true` would also work for the assertions but is a
  // permissive setting express-rate-limit warns about, and a test that runs on a
  // different proxy configuration than production is testing something else.
  app.set('trust proxy', 1);
  app.use('/api', limiters.generalLimiter);

  const ok = (req, res) => res.json({ ok: true });

  const auth = express.Router();
  auth.get('/check-email', limiters.checkEmailLimiter, ok);
  auth.post('/register', limiters.registerLimiter, ok);
  // 401 on a wrong password, because loginAccountLimiter sets
  // `skipSuccessfulRequests`: only failed sign-ins consume the account's budget,
  // so a stub that always answers 200 would never charge the limiter at all and
  // the brute-force assertion below would pass without testing anything.
  auth.post('/login', limiters.authLimiter, limiters.loginAccountLimiter, (req, res) => {
    if (req.body?.password === 'correct') return res.json({ ok: true });
    return res.status(401).json({ message: 'Invalid credentials' });
  });
  auth.post('/forgot-password', limiters.forgotPasswordLimiter, ok);
  auth.post('/resend-verification', limiters.resendVerificationLimiter, ok);
  // Authenticated. No auth-prefix limiter at all: it falls through to the
  // account-keyed generalLimiter applied to /api, exactly like /tasks.
  auth.get('/me', ok);

  app.use('/api/auth', auth);
  app.use('/api/tasks', ok);
  return { app, limiters };
}

/** Start a server for one test and tear it down afterwards. */
async function withServer(fn) {
  const { app, limiters } = buildApp();
  const server = await startTestServer(app);

  const call = (method, path, { ip = CAMPUS_IP, token, body } = {}) =>
    server.request(method, path, {
      headers: {
        'X-Forwarded-For': ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

  try {
    await fn({ call, limits: limiters.LIMITS });
  } finally {
    await server.close();
  }
}

/** Drive one endpoint until it 429s. Returns how many calls were allowed. */
async function exhaust(call, method, path, { ip = CAMPUS_IP, body, cap = 500 } = {}) {
  let allowed = 0;
  for (let i = 0; i < cap; i++) {
    const res = await call(method, path, { ip, body });
    if (res.status === 429) return allowed;
    allowed++;
  }
  return allowed;
}

jest.setTimeout(120000);

describe('auth rate limiting — bucket isolation', () => {
  it('THE H5 EXPLOIT: exhausting /check-email leaves authenticated /auth/me working', () =>
    withServer(async ({ call, limits }) => {
      // Step 1 — the attacker, or simply a busy signup morning, spends the
      // check-email budget for the whole network.
      const allowed = await exhaust(call, 'GET', '/api/auth/check-email');
      expect(allowed).toBe(limits.checkEmail.max);

      // The bucket really is spent.
      expect((await call('GET', '/api/auth/check-email')).status).toBe(429);

      // Step 2 — the innocent student, same NAT address, authenticated.
      // This returned 429 before the fix. It is the assertion the finding
      // turns on: the app failing to load for everyone on that Wi-Fi.
      expect((await call('GET', '/api/auth/me', { token: tokenFor('student-1') })).status).toBe(200);

      // Step 3 — the control from the report, which was always fine.
      expect((await call('GET', '/api/tasks', { token: tokenFor('student-1') })).status).toBe(200);
    }));

  it('exhausting /check-email leaves sign-in working', () =>
    withServer(async ({ call }) => {
      // The other half of the same failure: the cheapest endpoint spending the
      // most critical endpoint's budget. Losing sign-in is worse than losing
      // typeahead, and the old shared bucket made them the same event.
      await exhaust(call, 'GET', '/api/auth/check-email');

      const res = await call('POST', '/api/auth/login', {
        body: { email: 'student@college.edu', password: 'correct' },
      });
      expect(res.status).toBe(200);
    }));

  it('exhausting /check-email leaves registration working', () =>
    withServer(async ({ call }) => {
      // Reproduced by accident during Phase 2: a load test could not provision
      // 40 accounts because an earlier test had spent the shared bucket.
      await exhaust(call, 'GET', '/api/auth/check-email');

      const res = await call('POST', '/api/auth/register', { body: { email: 'new@college.edu' } });
      expect(res.status).toBe(200);
    }));

  it.each([
    ['register', 'POST', '/api/auth/register', 'register'],
    ['forgot-password', 'POST', '/api/auth/forgot-password', 'forgotPassword'],
    ['resend-verification', 'POST', '/api/auth/resend-verification', 'resendVerification'],
  ])('exhausting /%s does not affect authenticated /auth/me', (_label, method, path, limitKey) =>
    withServer(async ({ call, limits }) => {
      const allowed = await exhaust(call, method, path, { body: { email: 'a@b.edu' } });
      expect(allowed).toBe(limits[limitKey].max);

      const res = await call('GET', '/api/auth/me', { token: tokenFor('student-1') });
      expect(res.status).toBe(200);
    }));

  it('gives every student behind one NAT address their own authenticated budget', () =>
    withServer(async ({ call }) => {
      // The property an account-keyed limiter provides and an IP-keyed one
      // structurally cannot: a campus is many students, not one client.
      for (const student of ['s1', 's2', 's3', 's4', 's5']) {
        for (let i = 0; i < 40; i++) {
          const res = await call('GET', '/api/auth/me', { token: tokenFor(student) });
          expect(res.status).toBe(200);
        }
      }
    }));

  it('bounds a single noisy account without touching its neighbours', () =>
    withServer(async ({ call, limits }) => {
      const heavy = tokenFor('noisy-student');

      let sawLimit = false;
      for (let i = 0; i < limits.general.max + 5; i++) {
        const res = await call('GET', '/api/auth/me', { token: heavy });
        if (res.status === 429) { sawLimit = true; break; }
      }
      expect(sawLimit).toBe(true);

      // Their neighbour on the same address is unaffected — the whole point.
      const neighbour = await call('GET', '/api/auth/me', { token: tokenFor('quiet-student') });
      expect(neighbour.status).toBe(200);
    }));

  it('still bounds an attacker — check-email is capped, just in its own bucket', () =>
    withServer(async ({ call, limits }) => {
      // Isolation must not quietly mean "unlimited". check-email is the account
      // enumeration surface (M4), so it stays bounded; the fix changed the blast
      // radius, not the ceiling.
      const allowed = await exhaust(call, 'GET', '/api/auth/check-email');
      expect(allowed).toBe(limits.checkEmail.max);
      expect((await call('GET', '/api/auth/check-email')).status).toBe(429);
    }));

  it('does not let one network exhaust another network', () =>
    withServer(async ({ call }) => {
      await exhaust(call, 'GET', '/api/auth/check-email');
      const other = await call('GET', '/api/auth/check-email', { ip: '198.51.100.9' });
      expect(other.status).toBe(200);
    }));

  it('bounds login brute force per account regardless of source address', () =>
    withServer(async ({ call, limits }) => {
      const victim = { email: 'victim@college.edu', password: 'guess' };

      let allowed = 0;
      // The source address rotates every attempt. Only an account-keyed limiter
      // can bound this; the IP-keyed one never could, which is why it was moved.
      for (let i = 0; i < limits.loginAccount.max + 10; i++) {
        const res = await call('POST', '/api/auth/login', { ip: `198.51.100.${i % 200}`, body: victim });
        if (res.status === 429) break;
        allowed++;
      }
      expect(allowed).toBeLessThanOrEqual(limits.loginAccount.max);
    }));

  it('does not let one student\'s failed sign-ins lock another student out', () =>
    withServer(async ({ call, limits }) => {
      for (let i = 0; i < limits.loginAccount.max + 5; i++) {
        await call('POST', '/api/auth/login', { body: { email: 'victim@college.edu', password: 'guess' } });
      }

      const other = await call('POST', '/api/auth/login', {
        body: { email: 'someone-else@college.edu', password: 'correct' },
      });
      expect(other.status).toBe(200);
    }));
});

describe('limiter store isolation', () => {
  it('gives every unauthenticated endpoint its own instance', () => {
    // The structural reason the buckets cannot drain one another: one
    // express-rate-limit instance owns one store, so sharing an instance shares
    // a counter. Reusing any of these would silently reintroduce H5.
    const l = require('../middleware/rateLimiters');
    const limiters = [
      l.checkEmailLimiter,
      l.registerLimiter,
      l.forgotPasswordLimiter,
      l.resendVerificationLimiter,
      l.verifyEmailLimiter,
      l.resetPasswordLimiter,
      l.authLimiter,
      l.loginAccountLimiter,
      l.generalLimiter,
    ];
    expect(new Set(limiters).size).toBe(limiters.length);
  });
});

describe('the /api/auth prefix carries no shared limiter', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs
    .readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('mounts the auth router without a prefix-wide limiter argument', () => {
    // A limiter mounted on the prefix runs before the router, so it charges one
    // shared bucket for every auth request no matter how the routes below it are
    // configured. Comments are stripped first: index.js quotes the old line
    // while explaining why it is gone.
    expect(source).toMatch(/app\.use\(\s*'\/api\/auth',\s*require\(/);
    expect(source).not.toMatch(/app\.use\(\s*'\/api\/auth',\s*\w*[Ll]imiter/);
  });
});
