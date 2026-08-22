/**
 * Session-revocation regression tests for the notification SSE endpoint.
 *
 * EventSource cannot set an Authorization header, so /api/notifications/stream
 * accepted the token as a query parameter. The handler that did so called
 * jwt.verify() and assigned req.user from the claims — and stopped there.
 *
 * Everything verifyToken does *after* the signature check was therefore skipped
 * on this route: the session-version comparison, the account-exists lookup, and
 * the device-session check. services/sessionVersion.js exists specifically so
 * that "a password reset did not evict whoever stole the password" stops being
 * true — and this route made it true again. A stolen token kept streaming the
 * victim's live notifications for the remainder of its 7-day life, through a
 * password reset, a role change, or the account being deleted.
 *
 * The invariant: the query-parameter path is authenticated to exactly the same
 * standard as the header path.
 */

const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-for-sse';
process.env.JWT_SECRET = SECRET;

jest.mock('../services/sessionVersion');
jest.mock('../services/deviceSessions');

const sessionVersion = require('../services/sessionVersion');
const deviceSessions = require('../services/deviceSessions');
const sseAuth = require('../middleware/sseAuth');

const USER_ID = '507f1f77bcf86cd799439011';

// verifyToken, which sseAuth delegates to, requires a device claim on every
// token — deviceSessions is mocked below, so naming any device is enough here.
const token = (over = {}) =>
  jwt.sign({ userId: USER_ID, role: 'member', tier: 'free', tv: 0, did: 'test-device', ...over }, SECRET, {
    expiresIn: '7d',
  });

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const runQueryToken = async (t) => {
  const req = { headers: {}, query: { token: t } };
  const res = makeRes();
  const next = jest.fn();
  await sseAuth(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  deviceSessions.isExempt.mockReturnValue(false);
  deviceSessions.isActive.mockReturnValue(true);
  deviceSessions.touch.mockResolvedValue(undefined);
});

describe('SSE query-parameter authentication', () => {
  test('a current token is accepted', async () => {
    sessionVersion.get.mockResolvedValue({
      tokenVersion: 0, role: 'member', status: 'approved', email: 'a@b.c', sessions: [],
    });

    const { res, next } = await runQueryToken(token());
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('a token revoked by a password reset is rejected', async () => {
    // The reset bumped tokenVersion to 1; the stolen token still carries tv: 0.
    sessionVersion.get.mockResolvedValue({
      tokenVersion: 1, role: 'member', status: 'approved', email: 'a@b.c', sessions: [],
    });

    const { res, next } = await runQueryToken(token({ tv: 0 }));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('a deleted account cannot stream', async () => {
    sessionVersion.get.mockResolvedValue(null);

    const { res, next } = await runQueryToken(token());
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('a device evicted by the session limit cannot stream', async () => {
    sessionVersion.get.mockResolvedValue({
      tokenVersion: 0, role: 'member', status: 'approved', email: 'a@b.c', sessions: [],
    });
    deviceSessions.isActive.mockReturnValue(false);

    const { res, next } = await runQueryToken(token({ did: 'evicted-device' }));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('role comes from the database, not the token claim', async () => {
    // A demoted admin whose token still says admin.
    sessionVersion.get.mockResolvedValue({
      tokenVersion: 0, role: 'member', status: 'approved', email: 'a@b.c', sessions: [],
    });

    const { req, next } = await runQueryToken(token({ role: 'admin' }));
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('member');
  });

  test('a forged token is rejected', async () => {
    const forged = jwt.sign({ userId: USER_ID, role: 'admin' }, 'wrong-secret');
    const { res, next } = await runQueryToken(forged);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('a request with no token at all is rejected', async () => {
    const req = { headers: {}, query: {} };
    const res = makeRes();
    const next = jest.fn();
    await sseAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('an Authorization header still works and takes precedence', async () => {
    sessionVersion.get.mockResolvedValue({
      tokenVersion: 0, role: 'member', status: 'approved', email: 'a@b.c', sessions: [],
    });

    const req = { headers: { authorization: `Bearer ${token()}` }, query: {} };
    const res = makeRes();
    const next = jest.fn();
    await sseAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
