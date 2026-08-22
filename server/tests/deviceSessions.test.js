/**
 * Device-limited sessions.
 *
 * A JWT proves someone knew a password once; it says nothing about how many
 * people are using that password right now. These tests pin down the cap, the
 * eviction order, and — most importantly — that a token whose device has been
 * evicted or revoked stops working.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sessionVersion = require('../services/sessionVersion');
const deviceSessions = require('../services/deviceSessions');
const verifyToken = require('../middleware/verifyToken');

const SECRET = 'test-secret-for-device-sessions';
const USER_ID = '507f1f77bcf86cd799439011';

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const sign = (over = {}) =>
  jwt.sign({ userId: USER_ID, role: 'member', tv: 0, ...over }, SECRET, { expiresIn: '7d' });

const stubSession = (doc) =>
  jest.spyOn(User, 'findById').mockReturnValue({ select: () => ({ lean: async () => doc }) });

const session = (deviceId, minutesAgo = 0) => ({
  deviceId,
  label: 'Chrome on Mac',
  lastSeenAt: new Date(Date.now() - minutesAgo * 60000),
  createdAt: new Date(Date.now() - minutesAgo * 60000),
});

const ORIGINAL_ADMIN = process.env.ADMIN_EMAIL;

beforeEach(() => {
  jest.restoreAllMocks();
  process.env.JWT_SECRET = SECRET;
  process.env.ADMIN_EMAIL = 'owner@datad.online';
  sessionVersion._reset();
  deviceSessions._resetTouchCache();
});

afterAll(() => {
  if (ORIGINAL_ADMIN === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = ORIGINAL_ADMIN;
});

describe('device cap', () => {
  it('allows enough devices for real use but not for a shared login', () => {
    // Phone + laptop + a lab machine is the honest ceiling.
    expect(deviceSessions.MAX_DEVICES).toBeGreaterThanOrEqual(2);
    expect(deviceSessions.MAX_DEVICES).toBeLessThanOrEqual(4);
  });

  it('caps and LRU-evicts inside the database write, not by read-modify-write', async () => {
    stubSession({ sessions: [session('a', 30), session('b', 20), session('c', 10)] });
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});

    await deviceSessions.register(USER_ID, {
      deviceId: 'd', ip: '1.2.3.4', userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120',
    });

    const push = update.mock.calls.find((c) => c[1].$push);
    expect(push).toBeDefined();
    const spec = push[1].$push.sessions;
    // $sort + $slice make MongoDB do the trimming, so two simultaneous
    // sign-ins cannot both slip past the cap.
    expect(spec.$sort).toEqual({ lastSeenAt: -1 });
    expect(spec.$slice).toBe(deviceSessions.MAX_DEVICES);
  });

  it('reports an eviction when a new device exceeds the cap', async () => {
    const full = Array.from({ length: deviceSessions.MAX_DEVICES }, (_, i) => session(`d${i}`, i));
    stubSession({ sessions: full });
    jest.spyOn(User, 'updateOne').mockResolvedValue({});

    const { evicted } = await deviceSessions.register(USER_ID, { deviceId: 'new', userAgent: '' });
    expect(evicted).toBe(true);
  });

  it('does not evict when signing in again on a device already known', async () => {
    const full = Array.from({ length: deviceSessions.MAX_DEVICES }, (_, i) => session(`d${i}`, i));
    stubSession({ sessions: full });
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});

    const { evicted } = await deviceSessions.register(USER_ID, { deviceId: 'd0', userAgent: '' });

    expect(evicted).toBe(false);
    // The old entry is removed first so re-signing in cannot create a duplicate.
    expect(update.mock.calls[0][1].$pull).toEqual({ sessions: { deviceId: 'd0' } });
  });

  it('never blocks sign-in if the device write fails', async () => {
    stubSession({ sessions: [] });
    jest.spyOn(User, 'updateOne').mockRejectedValue(new Error('mongo down'));

    await expect(
      deviceSessions.register(USER_ID, { deviceId: 'x', userAgent: '' })
    ).resolves.toEqual({ evicted: false });
  });
});

describe('verifyToken device check', () => {
  it('accepts a token whose device still holds a session', async () => {
    stubSession({ tokenVersion: 0, role: 'member', status: 'approved', sessions: [session('abc')] });
    const next = jest.fn();
    const req = { headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } };

    await verifyToken(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.deviceId).toBe('abc');
  });

  it('rejects a token whose device was evicted — the sharing case', async () => {
    // Signed in on a fourth device; this one got pushed out.
    stubSession({ tokenVersion: 0, role: 'member', status: 'approved', sessions: [session('other')] });
    const res = makeRes();
    const next = jest.fn();

    await verifyToken({ headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('DEVICE_REVOKED');
  });

  it('rejects a token whose device the user explicitly signed out', async () => {
    stubSession({ tokenVersion: 0, role: 'member', status: 'approved', sessions: [] });
    const res = makeRes();

    await verifyToken({ headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } }, res, jest.fn());

    expect(res.statusCode).toBe(401);
  });

  // This used to assert the opposite — that a token with no `did` was let
  // through so a deploy signed nobody out. That allowance was reachable on
  // demand: `did` is populated from the client-supplied `x-device-id` header,
  // so signing in without it produced a token that was never bound to a device,
  // never evicted by the cap, and never listed in "Your devices" — leaving the
  // student no way to revoke it. The cap became opt-in for whoever wanted to
  // avoid it. Tokens are now always minted with a device (deviceFromRequest
  // generates one when the header is absent), so the only cost of requiring it
  // is that sessions predating the change sign in once more.
  it('rejects a token that names no device, so the cap cannot be opted out of', async () => {
    stubSession({ tokenVersion: 0, role: 'member', status: 'approved', sessions: [] });
    const res = makeRes();
    const next = jest.fn();

    // No `did` claim at all — what omitting `x-device-id` used to produce.
    await verifyToken({ headers: { authorization: `Bearer ${sign()}` } }, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('SESSION_UPGRADE_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('costs no extra query — the device list rides the session record', async () => {
    const findById = stubSession({
      tokenVersion: 0, role: 'member', status: 'approved', sessions: [session('abc')],
    });

    await verifyToken({ headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } }, makeRes(), jest.fn());
    await verifyToken({ headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } }, makeRes(), jest.fn());

    expect(findById).toHaveBeenCalledTimes(1); // cached
    expect(findById.mock.calls[0]).toBeDefined();
  });
});

describe('managing your own devices', () => {
  it('lists devices newest-active first without leaking the raw id', async () => {
    stubSession({ sessions: [session('aaaaaaaa1111', 60), session('bbbbbbbb2222', 5)] });

    const list = await deviceSessions.list(USER_ID, 'bbbbbbbb2222');

    expect(list[0].id).toBe('bbbbbbbb'); // most recently active first
    expect(list[0].current).toBe(true);
    expect(list[1].current).toBe(false);
    // A full id would let one tab impersonate another device.
    for (const d of list) expect(d.id.length).toBeLessThanOrEqual(8);
  });

  it('revokes a device by its short id', async () => {
    stubSession({ sessions: [session('aaaaaaaa1111'), session('bbbbbbbb2222')] });
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});

    const ok = await deviceSessions.revoke(USER_ID, 'aaaaaaaa');

    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $pull: { sessions: { deviceId: 'aaaaaaaa1111' } } }
    );
  });

  it('reports failure for an unknown device rather than silently succeeding', async () => {
    stubSession({ sessions: [session('aaaaaaaa1111')] });
    jest.spyOn(User, 'updateOne').mockResolvedValue({});

    expect(await deviceSessions.revoke(USER_ID, 'zzzzzzzz')).toBe(false);
  });

  it('clears every device on revokeAll, for a password change', async () => {
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});
    await deviceSessions.revokeAll(USER_ID);
    expect(update).toHaveBeenCalledWith({ _id: USER_ID }, { $set: { sessions: [] } });
  });
});

describe('lastSeenAt throttling', () => {
  it('writes at most once per device per interval', () => {
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});

    deviceSessions.touch(USER_ID, 'abc');
    deviceSessions.touch(USER_ID, 'abc');
    deviceSessions.touch(USER_ID, 'abc');

    // Otherwise this would be a database write on every authenticated request.
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a request with no device id', () => {
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});
    deviceSessions.touch(USER_ID, undefined);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('device labels', () => {
  it('produces something a student can recognise', () => {
    expect(deviceSessions.describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120 Safari/537'))
      .toBe('Chrome on Mac');
    expect(deviceSessions.describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile'))
      .toBe('Chrome on Android');
    expect(deviceSessions.describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604'))
      .toBe('Safari on iOS');
    expect(deviceSessions.describeDevice('')).toBe('Browser on device');
  });
});


describe('owner account exemption', () => {
  it('identifies the owner by ADMIN_EMAIL, case and whitespace insensitively', () => {
    expect(deviceSessions.isExempt('owner@datad.online')).toBe(true);
    expect(deviceSessions.isExempt('  Owner@DATAD.Online  ')).toBe(true);
    expect(deviceSessions.isExempt('student@college.edu')).toBe(false);
    expect(deviceSessions.isExempt('')).toBe(false);
    expect(deviceSessions.isExempt(undefined)).toBe(false);
  });

  it('does not exempt a merely-admin-role account', async () => {
    // The exemption must not transfer to anyone promoted to admin later, or
    // survive someone editing a role field directly in the database.
    stubSession({
      tokenVersion: 0, role: 'admin', status: 'approved',
      email: 'someone.else@college.edu', sessions: [session('other')],
    });
    const res = makeRes();

    await verifyToken({ headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } }, res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('DEVICE_REVOKED');
  });

  it('never signs the owner out on the device check', async () => {
    // Device is absent from the list, which would evict anyone else.
    stubSession({
      tokenVersion: 0, role: 'admin', status: 'approved',
      email: 'owner@datad.online', sessions: [],
    });
    const next = jest.fn();

    await verifyToken({ headers: { authorization: `Bearer ${sign({ did: 'abc' })}` } }, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('still records the owner\'s devices, so a stolen session can be revoked', async () => {
    jest.spyOn(User, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ sessions: [], email: 'owner@datad.online' }) }),
    });
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});

    await deviceSessions.register(USER_ID, { deviceId: 'x', userAgent: '' });

    const push = update.mock.calls.find((c) => c[1].$push);
    expect(push).toBeDefined();
    // Capped high rather than uncapped, so the array cannot grow without bound.
    expect(push[1].$push.sessions.$slice).toBe(deviceSessions.EXEMPT_CAP);
    expect(deviceSessions.EXEMPT_CAP).toBeGreaterThan(deviceSessions.MAX_DEVICES);
  });

  it('never reports an eviction for the owner', async () => {
    const full = Array.from({ length: deviceSessions.MAX_DEVICES }, (_, i) => session(`d${i}`, i));
    jest.spyOn(User, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ sessions: full, email: 'owner@datad.online' }) }),
    });
    jest.spyOn(User, 'updateOne').mockResolvedValue({});

    const { evicted } = await deviceSessions.register(USER_ID, { deviceId: 'new', userAgent: '' });
    expect(evicted).toBe(false);
  });

  it('applies no exemption when ADMIN_EMAIL is unset', () => {
    delete process.env.ADMIN_EMAIL;
    expect(deviceSessions.isExempt('owner@datad.online')).toBe(false);
  });
});
