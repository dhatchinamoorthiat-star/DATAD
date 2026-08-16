/**
 * Security regression tests for the account-recovery endpoints.
 *
 * These cover two fixed production blockers:
 *
 *   P0-1  A password-reset link's hostname must never come from the requester.
 *         The Origin header is attacker-controlled on a cross-origin POST, so
 *         honouring it allowed anyone to have DATAD mail a victim a genuine
 *         reset token pointed at a host the attacker owned.
 *
 *   P0-2  Email verification is a hard login gate with an expiring token, so
 *         there must be a way to get a new one — and that path must not become
 *         an account-enumeration oracle or a mail-flooding lever.
 *
 * No database is required: the model and mailer layers are mocked so the tests
 * exercise the controller's own logic, which is where both bugs lived. That
 * also means these run in CI with no MONGODB_URI, unlike the talent suites.
 */

const crypto = require('crypto');

// Hoisted above the controller require by jest, so the controller's top-level
// destructuring of the mailer picks up these mocks.
jest.mock('../config/mailer', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendAccountApprovedEmail: jest.fn().mockResolvedValue(undefined),
  sendAnnouncementEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/logActivity', () => jest.fn());

const mailer = require('../config/mailer');
const User = require('../models/User');
const { emailLinkBase, isAllowedCorsOrigin } = require('../utils/clientUrl');
const authController = require('../controllers/authController');

const ATTACKER = 'https://evil-tunnel-9x2.ngrok-free.app';
const LEGIT = 'https://datad.app';

const ORIGINAL_ENV = { ...process.env };

/** Minimal express-like req/res doubles. */
const makeReq = (body = {}, origin = '') => ({
  body,
  query: {},
  ip: '203.0.113.7',
  get: (h) => (h.toLowerCase() === 'origin' ? origin : undefined),
});

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    set() { return this; },
  };
  return res;
};

/** A fake user doc that records saves without touching Mongo. */
const makeUserDoc = (over = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Test Student',
  email: 'victim@college.edu',
  status: 'approved',
  emailVerifiedAt: null,
  verifyTokenHash: 'existing-hash',
  verifyTokenExpires: new Date(Date.now() + 3600_000),
  resetTokenHash: null,
  resetTokenExpires: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CLIENT_URL = LEGIT;
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ── P0-1 ────────────────────────────────────────────────────────────────────

describe('P0-1 password-reset link hostname', () => {
  describe('emailLinkBase (the invariant itself)', () => {
    it('ignores a tunnel Origin in production', () => {
      process.env.NODE_ENV = 'production';
      expect(emailLinkBase(makeReq({}, ATTACKER))).toBe(LEGIT);
    });

    it('ignores an arbitrary attacker Origin in production', () => {
      process.env.NODE_ENV = 'production';
      expect(emailLinkBase(makeReq({}, 'https://attacker.example.com'))).toBe(LEGIT);
    });

    it('uses only the first entry of a comma-separated CLIENT_URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = `${LEGIT}, https://www.datad.app, http://localhost:5173`;
      expect(emailLinkBase(makeReq({}, ATTACKER))).toBe(LEGIT);
    });

    it('strips a trailing slash so links never contain a double slash', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://datad.app/';
      expect(`${emailLinkBase(makeReq())}/reset-password`).toBe('https://datad.app/reset-password');
    });

    it('still honours a tunnel Origin outside production', () => {
      process.env.NODE_ENV = 'development';
      expect(emailLinkBase(makeReq({}, ATTACKER))).toBe(ATTACKER);
    });

    it('rejects look-alike hosts that merely contain a tunnel domain', () => {
      process.env.NODE_ENV = 'development';
      for (const bad of [
        'https://x.ngrok.io.evil.com',
        'https://evil.com/x.ngrok.io',
        'http://plain.ngrok.io',
        'https://sub.domain.ngrok.io',
      ]) {
        expect(emailLinkBase(makeReq({}, bad))).toBe(LEGIT);
      }
    });
  });

  describe('forgotPassword controller', () => {
    it('emails a link on CLIENT_URL even when Origin is attacker-controlled', async () => {
      process.env.NODE_ENV = 'production';
      const doc = makeUserDoc();
      jest.spyOn(User, 'findOne').mockResolvedValue(doc);

      const res = makeRes();
      await authController.forgotPassword(makeReq({ email: 'victim@college.edu' }, ATTACKER), res, jest.fn());

      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const link = mailer.sendPasswordResetEmail.mock.calls[0][1];
      expect(link.startsWith(`${LEGIT}/reset-password?token=`)).toBe(true);
      expect(link).not.toContain('ngrok');
      expect(link).not.toContain('evil');
    });

    it('answers identically for known and unknown addresses', async () => {
      process.env.NODE_ENV = 'production';

      jest.spyOn(User, 'findOne').mockResolvedValue(makeUserDoc());
      const hit = makeRes();
      await authController.forgotPassword(makeReq({ email: 'victim@college.edu' }), hit, jest.fn());

      User.findOne.mockResolvedValue(null);
      const miss = makeRes();
      await authController.forgotPassword(makeReq({ email: 'nobody@college.edu' }), miss, jest.fn());

      expect(hit.body).toEqual(miss.body);
      expect(hit.statusCode).toBe(miss.statusCode);
    });

    it('stores the reset token only as a hash', async () => {
      process.env.NODE_ENV = 'production';
      const doc = makeUserDoc();
      jest.spyOn(User, 'findOne').mockResolvedValue(doc);

      await authController.forgotPassword(makeReq({ email: 'victim@college.edu' }), makeRes(), jest.fn());

      const link = mailer.sendPasswordResetEmail.mock.calls[0][1];
      const rawToken = new URL(link).searchParams.get('token');
      expect(doc.resetTokenHash).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
      expect(doc.resetTokenHash).not.toBe(rawToken);
    });
  });

  describe('CORS agrees with the emailed-link rule', () => {
    it('rejects tunnel origins in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isAllowedCorsOrigin(ATTACKER)).toBe(false);
      expect(isAllowedCorsOrigin(LEGIT)).toBe(true);
    });

    it('accepts tunnel origins outside production', () => {
      process.env.NODE_ENV = 'development';
      expect(isAllowedCorsOrigin(ATTACKER)).toBe(true);
    });
  });
});

// ── P0-2 ────────────────────────────────────────────────────────────────────

describe('P0-2 verification resend', () => {
  const GENERIC =
    'If that address needs confirming, a new link is on its way. Check your inbox and spam folder.';

  // A token issued long enough ago that the resend cooldown has lapsed.
  const staleExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000 - 5 * 60 * 1000);

  const callResend = async (email, doc, origin = '') => {
    jest.spyOn(User, 'findOne').mockResolvedValue(doc);
    const res = makeRes();
    await authController.resendVerification(makeReq({ email }, origin), res, jest.fn());
    return res;
  };

  it('sends a fresh link for an unverified account', async () => {
    const doc = makeUserDoc({ verifyTokenExpires: staleExpiry() });
    const res = await callResend('victim@college.edu', doc);

    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ message: GENERIC });
    expect(res.statusCode).toBe(200);
  });

  it('regenerates the token and invalidates the previous one', async () => {
    const doc = makeUserDoc({ verifyTokenHash: 'old-hash', verifyTokenExpires: staleExpiry() });
    await callResend('victim@college.edu', doc);

    const link = mailer.sendVerificationEmail.mock.calls[0][1];
    const newToken = new URL(link).searchParams.get('token');

    // The stored hash is the new token's, so the old link no longer resolves.
    expect(doc.verifyTokenHash).toBe(crypto.createHash('sha256').update(newToken).digest('hex'));
    expect(doc.verifyTokenHash).not.toBe('old-hash');
    // And the raw token is never what gets persisted.
    expect(doc.verifyTokenHash).not.toBe(newToken);
  });

  it('gives an identical answer for an unknown address, and sends nothing', async () => {
    const res = await callResend('nobody@college.edu', null);
    expect(res.body).toEqual({ message: GENERIC });
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('gives an identical answer for an already-verified account, and sends nothing', async () => {
    const doc = makeUserDoc({ emailVerifiedAt: new Date(), verifyTokenHash: null });
    const res = await callResend('victim@college.edu', doc);

    expect(res.body).toEqual({ message: GENERIC });
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('gives an identical answer for a malformed address', async () => {
    const res = makeRes();
    await authController.resendVerification(makeReq({ email: 'not-an-email' }), res, jest.fn());
    expect(res.body).toEqual({ message: GENERIC });
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('cannot be used to flood one address: cooldown suppresses the send', async () => {
    // Token issued just now → still inside the cooldown window.
    const doc = makeUserDoc({ verifyTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const res = await callResend('victim@college.edu', doc);

    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
    // Crucially, the response is still the same — the cooldown is not observable.
    expect(res.body).toEqual({ message: GENERIC });
  });

  it('recovers an account whose verification token has already expired', async () => {
    const doc = makeUserDoc({
      verifyTokenHash: 'expired-hash',
      verifyTokenExpires: new Date(Date.now() - 60 * 60 * 1000), // lapsed an hour ago
    });
    const res = await callResend('victim@college.edu', doc);

    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(new Date(doc.verifyTokenExpires).getTime()).toBeGreaterThan(Date.now());
    expect(doc.verifyTokenHash).not.toBe('expired-hash');
    expect(res.body).toEqual({ message: GENERIC });
  });

  it('builds the resend link on CLIENT_URL, not on a supplied Origin', async () => {
    process.env.NODE_ENV = 'production';
    const doc = makeUserDoc({ verifyTokenExpires: staleExpiry() });
    await callResend('victim@college.edu', doc, ATTACKER);

    const link = mailer.sendVerificationEmail.mock.calls[0][1];
    expect(link.startsWith(`${LEGIT}/verify-email?token=`)).toBe(true);
    expect(link).not.toContain('ngrok');
  });

  it('is registered behind the auth rate limiter', () => {
    const router = require('../routes/authRoutes');
    const layer = router.stack.find(
      (l) => l.route?.path === '/resend-verification' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();
    // Identity check against the shared limiter instance — the middleware is
    // anonymous, so matching by name would silently pass against anything.
    const { authLimiter } = require('../middleware/rateLimiters');
    expect(layer.route.stack.some((s) => s.handle === authLimiter)).toBe(true);
    // And it must sit in front of the handler, not behind it.
    expect(layer.route.stack[0].handle).toBe(authLimiter);
  });
});
