/**
 * How API requests are attributed to a bucket.
 *
 * The numbers are only half of a rate limit; the key is the other half, and it
 * is the half that broke twice here. Keyed on IP, a limit is shared by everyone
 * behind one NAT address — which for this audience is an entire campus. These
 * tests pin the keying, because a wrong key looks exactly like a working limiter
 * until launch day.
 */

const jwt = require('jsonwebtoken');
const { generalKey, loginAccountKey, LIMITS } = require('../middleware/rateLimiters');

const SECRET = 'test-secret-for-rate-limiters';
const USER_ID = '507f1f77bcf86cd799439011';

const reqWith = (token, ip = '203.0.113.7') => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
  ip,
});

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('general API limit keying', () => {
  it('keys an authenticated request on the account, not the network', () => {
    const token = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '7d' });

    expect(generalKey(reqWith(token))).toBe(`user:${USER_ID}`);
  });

  it('gives two students on one campus address separate budgets', () => {
    const a = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '7d' });
    const b = jwt.sign({ userId: '507f1f77bcf86cd799439022' }, SECRET, { expiresIn: '7d' });

    // Same IP — the shared-NAT case that made the IP-keyed version unusable.
    const keyA = generalKey(reqWith(a, '198.51.100.1'));
    const keyB = generalKey(reqWith(b, '198.51.100.1'));

    expect(keyA).not.toBe(keyB);
  });

  it('falls back to the address when there is no token', () => {
    expect(generalKey(reqWith(null))).toMatch(/^ip:/);
  });

  it('falls back to the address for a forged token rather than trusting its userId', () => {
    // Decoding without verifying would let anyone mint a fresh bucket per
    // request by claiming a new userId — worse than keying on IP, not better.
    const forged = jwt.sign({ userId: 'attacker-chosen' }, 'wrong-secret', { expiresIn: '7d' });

    expect(generalKey(reqWith(forged))).toMatch(/^ip:/);
  });

  it('falls back to the address for an expired token', () => {
    const expired = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: -10 });

    expect(generalKey(reqWith(expired))).toMatch(/^ip:/);
  });
});

describe('sign-in limit keying', () => {
  it('keys on the account being targeted, so one attacker cannot lock out a campus', () => {
    const key = loginAccountKey({ body: { email: 'Student@Example.edu ' }, ip: '198.51.100.1' });

    expect(key).toBe('student@example.edu');
  });

  it('falls back to the address when the request names no account', () => {
    expect(loginAccountKey({ body: {}, ip: '198.51.100.1' })).toMatch(/^ip:/);
  });
});

describe('the numbers themselves', () => {
  it('bounds password guessing far more tightly than ordinary use', () => {
    expect(LIMITS.loginAccount.max).toBeLessThan(LIMITS.general.max);
    expect(LIMITS.loginAccount.max).toBeLessThanOrEqual(20);
  });
});
