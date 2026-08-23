/**
 * Session revocation and rate-limiter keying (P1-1, P1-3).
 *
 * P1-1: the JWT lasts 7 days and carries `role`, and verifyToken used to do
 * `jwt.verify` and nothing else. So a password reset did not evict an attacker,
 * a demoted admin kept admin routes, and a deleted account's token still
 * worked — all for up to a week.
 *
 * P1-3: brute-force protection was keyed on IP at 20 per 15 minutes. A campus
 * behind one NAT address shares that budget, so the limiter locked out
 * legitimate students long before it inconvenienced an attacker with a pool of
 * addresses.
 */

const jwt = require('jsonwebtoken');

jest.mock('../config/mailer', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ delivered: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ delivered: true }),
  sendAccountApprovedEmail: jest.fn().mockResolvedValue(undefined),
  sendAnnouncementEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/logActivity', () => jest.fn());

const User = require('../models/User');
const sessionVersion = require('../services/sessionVersion');
const verifyToken = require('../middleware/verifyToken');

const SECRET = 'test-secret-for-session-revocation';
const USER_ID = '507f1f77bcf86cd799439011';

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const reqWith = (token) => ({ headers: { authorization: `Bearer ${token}` } });

// verifyToken requires every token to name a device, so the fixtures here carry
// one and the stubbed account holds a matching session. These tests are about
// session *version* and role; the device cap has its own suite.
const DEVICE_ID = 'test-device';

const sign = (over = {}) =>
  jwt.sign({ userId: USER_ID, role: 'member', tier: 'free', tv: 0, did: DEVICE_ID, ...over }, SECRET, {
    expiresIn: '7d',
  });

/** Stub the single document read sessionVersion performs. */
const stubUser = (doc) =>
  jest.spyOn(User, 'findById').mockReturnValue({
    select: () => ({
      lean: async () => (doc ? { sessions: [{ deviceId: DEVICE_ID }], ...doc } : doc),
    }),
  });

beforeEach(() => {
  jest.restoreAllMocks();
  process.env.JWT_SECRET = SECRET;
  sessionVersion._reset();
});

// ── P1-1 ────────────────────────────────────────────────────────────────────

describe('P1-1 token revocation', () => {
  it('accepts a token whose version matches the account', async () => {
    stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });
    const req = reqWith(sign());
    const res = makeRes();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.userId).toBe(USER_ID);
  });

  it('rejects a token issued before a version bump — the password-reset case', async () => {
    // Token minted at tv:0; the reset incremented the account to 1.
    stubUser({ tokenVersion: 1, role: 'member', status: 'approved' });
    const res = makeRes();
    const next = jest.fn();

    await verifyToken(reqWith(sign({ tv: 0 })), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token for an account that no longer exists', async () => {
    stubUser(null);
    const res = makeRes();
    const next = jest.fn();

    await verifyToken(reqWith(sign()), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('takes role from the database, not the token — the demoted-admin case', async () => {
    stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });
    const req = reqWith(sign({ role: 'admin' })); // stale claim
    const next = jest.fn();

    await verifyToken(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.role).toBe('member'); // checkRole now sees the truth
  });

  it('treats a token minted before this feature (no tv claim) as version 0', async () => {
    stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });
    const legacy = jwt.sign(
      { userId: USER_ID, role: 'member', did: DEVICE_ID },
      SECRET,
      { expiresIn: '7d' }
    );
    const next = jest.fn();

    await verifyToken(reqWith(legacy), makeRes(), next);

    // Existing sessions survive the deploy rather than everyone being logged out.
    expect(next).toHaveBeenCalledWith();
  });

  it('still rejects a bad signature before any database work', async () => {
    const findById = stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });
    const res = makeRes();

    await verifyToken(reqWith(jwt.sign({ userId: USER_ID }, 'wrong-secret')), res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed Authorization header', async () => {
    for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer' }]) {
      const res = makeRes();
      await verifyToken({ headers }, res, jest.fn());
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('P1-1 session version cache', () => {
  it('does not read the database on every request', async () => {
    const findById = stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });

    await sessionVersion.get(USER_ID);
    await sessionVersion.get(USER_ID);
    await sessionVersion.get(USER_ID);

    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('bumping invalidates the cache immediately, not after the TTL', async () => {
    const findById = stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });
    jest.spyOn(User, 'updateOne').mockResolvedValue({});

    await sessionVersion.get(USER_ID);
    expect(findById).toHaveBeenCalledTimes(1);

    await sessionVersion.bump(USER_ID);
    findById.mockReturnValue({ select: () => ({ lean: async () => ({ tokenVersion: 1, role: 'member', status: 'approved' }) }) });

    const after = await sessionVersion.get(USER_ID);
    expect(after.tokenVersion).toBe(1); // re-read, not served stale
    expect(User.updateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $inc: { tokenVersion: 1 } });
  });

  it('invalidate() forces the next read to hit the database', async () => {
    const findById = stubUser({ tokenVersion: 0, role: 'member', status: 'approved' });

    await sessionVersion.get(USER_ID);
    sessionVersion.invalidate(USER_ID);
    await sessionVersion.get(USER_ID);

    expect(findById).toHaveBeenCalledTimes(2);
  });
});

// ── P1-3 ────────────────────────────────────────────────────────────────────

describe('P1-3 rate limiter keying', () => {
  const {
    authLimiter,
    loginAccountLimiter,
    loginAccountKey,
    LIMITS,
  } = require('../middleware/rateLimiters');

  it('keys login attempts on the account, so one IP is not the unit of throttling', () => {
    // Two students on the same campus IP must produce different keys.
    const a = loginAccountKey({ body: { email: 'Alice@College.edu' }, ip: '203.0.113.7' });
    const b = loginAccountKey({ body: { email: 'bob@college.edu' }, ip: '203.0.113.7' });

    expect(a).toBe('alice@college.edu'); // normalised
    expect(a).not.toBe(b);
  });

  it('falls back to an IP-derived key when no email is supplied', () => {
    const k = loginAccountKey({ body: {}, ip: '203.0.113.7' });

    expect(typeof k).toBe('string');
    expect(k.startsWith('ip:')).toBe(true);
  });

  it('raises the per-network ceiling well above one classroom of students', () => {
    // The old value was 20 per 15 minutes for an entire NAT'd campus.
    expect(LIMITS.authNetwork.max).toBeGreaterThanOrEqual(200);
    // …while the account-keyed guard stays tight, which is where brute-force
    // protection actually belongs.
    expect(LIMITS.loginAccount.max).toBeLessThanOrEqual(15);
  });

  it('mounts both limiters on /login, account limiter after the network one', () => {
    const router = require('../routes/authRoutes');
    const layer = router.stack.find((l) => l.route?.path === '/login' && l.route?.methods?.post);

    const handles = layer.route.stack.map((s) => s.handle);
    expect(handles).toContain(authLimiter);
    expect(handles).toContain(loginAccountLimiter);
    expect(handles.indexOf(authLimiter)).toBeLessThan(handles.indexOf(loginAccountLimiter));
  });

  it('leaves recovery endpoints on an IP limiter, never an account-keyed one', () => {
    // An account-keyed limit on these would let anyone lock a victim out of
    // password reset by exhausting the quota on their behalf.
    //
    // Each of these now has its OWN limiter instance rather than the shared
    // `authLimiter` — see middleware/rateLimiters.js. One shared instance meant
    // one shared store, so abuse of the cheapest endpoint spent the budget for
    // sign-in across the whole campus. The invariant this test protects is
    // unchanged: IP-keyed, never account-keyed.
    const limiters = require('../middleware/rateLimiters');
    const router = require('../routes/authRoutes');
    const expected = {
      '/forgot-password': limiters.forgotPasswordLimiter,
      '/reset-password': limiters.resetPasswordLimiter,
      '/resend-verification': limiters.resendVerificationLimiter,
    };
    for (const [path, limiter] of Object.entries(expected)) {
      const layer = router.stack.find((l) => l.route?.path === path);
      const handles = layer.route.stack.map((s) => s.handle);
      expect(handles).toContain(limiter);
      expect(handles).not.toContain(loginAccountLimiter);
    }
  });

  it('gives each unauthenticated endpoint its own limiter instance', () => {
    // The H5 fix, as an identity check. Two routes sharing an instance share a
    // counter, and that is precisely how exhausting /check-email denied /login.
    const limiters = require('../middleware/rateLimiters');
    const instances = [
      limiters.checkEmailLimiter,
      limiters.registerLimiter,
      limiters.forgotPasswordLimiter,
      limiters.resendVerificationLimiter,
      limiters.verifyEmailLimiter,
      limiters.resetPasswordLimiter,
    ];
    expect(new Set(instances).size).toBe(instances.length);
  });
});
