/**
 * Device-limited sessions.
 *
 * A JWT alone says "this person knew a password once". It says nothing about
 * how many people are using that password right now, so one paid login could
 * be split across a whole study group. This caps the number of devices that
 * can hold a live session and evicts the least recently used one when the cap
 * is exceeded — the same model Netflix and Spotify use.
 *
 * Why not a hardware identifier: browsers expose no MAC address (deliberately —
 * it is a tracking vector), and iOS/Android/Windows randomise it per network
 * anyway. Why not IP: a college reaches the internet through a handful of NAT
 * addresses, so binding to IP would either admit the entire campus on one
 * account or lock out everyone sharing the Wi-Fi. The device id is a random
 * value the client stores once — weak as proof of identity, but that is not
 * what it is for. It only has to make sharing inconvenient enough that paying
 * is easier, and to give the student a way to see and evict their own sessions.
 */

const User = require('../models/User');
const logger = require('../utils/logger');
const sessionVersion = require('./sessionVersion');

/**
 * Devices allowed at once. Three covers the honest cases — phone, laptop, and
 * a shared lab machine — while a four-way split starts silently signing its
 * own members out. Deliberately one number rather than a per-tier matrix:
 * anything users must read a table to understand generates support requests.
 */
const MAX_DEVICES = Number(process.env.MAX_DEVICES_PER_USER) || 3;

/**
 * The owner account is exempt from the cap — it is used for testing, demos and
 * support across whatever device is to hand, and being signed out mid-demo by
 * your own anti-sharing rule is a bad afternoon.
 *
 * Matched on ADMIN_EMAIL rather than role === 'admin' deliberately: the
 * exemption should not transfer to anyone who is later promoted to admin, and
 * it should not survive someone editing a role field in the database.
 *
 * Sessions are still recorded for exempt accounts (so "Your devices" works and
 * a stolen session can be revoked) — they are just capped high enough not to
 * evict in practice.
 */
const EXEMPT_CAP = 50;

function isExempt(email) {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin || !email) return false;
  return String(email).toLowerCase().trim() === String(admin).toLowerCase().trim();
}

// Writing lastSeenAt on every request would add a database write per request.
// It only needs to be accurate enough to order an LRU list and to render a
// plausible "last active" in the UI.
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;
const lastTouched = new Map();

/** Best-effort human label from a user agent, for the "Your devices" list. */
function describeDevice(userAgent = '') {
  const ua = String(userAgent);
  const browser =
    /Edg\//.test(ua) ? 'Edge'
      : /OPR\//.test(ua) ? 'Opera'
        : /Chrome\//.test(ua) ? 'Chrome'
          : /Safari\//.test(ua) ? 'Safari'
            : /Firefox\//.test(ua) ? 'Firefox'
              : 'Browser';
  const os =
    /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Mac OS X/.test(ua) ? 'Mac'
          : /Windows/.test(ua) ? 'Windows'
            : /Linux/.test(ua) ? 'Linux'
              : 'device';
  return `${browser} on ${os}`;
}

/**
 * Record a sign-in from a device, evicting the least recently used one if the
 * cap is exceeded.
 *
 * The $slice on a $sort-ed $push does the capping inside MongoDB, so two
 * simultaneous sign-ins cannot race past the limit — the array is trimmed by
 * the server on every write, not by a read-modify-write here.
 *
 * @returns {Promise<{evicted: boolean}>}
 */
async function register(userId, { deviceId, ip, userAgent }) {
  if (!deviceId) return { evicted: false };

  const entry = {
    deviceId,
    label: describeDevice(userAgent),
    ip: ip || '',
    userAgent: String(userAgent || '').slice(0, 300),
    createdAt: new Date(),
    lastSeenAt: new Date(),
  };

  try {
    const before = await User.findById(userId).select('sessions email').lean();
    const known = (before?.sessions || []).some((s) => s.deviceId === deviceId);
    const exempt = isExempt(before?.email);
    const cap = exempt ? EXEMPT_CAP : MAX_DEVICES;

    // Re-signing in on a known device replaces its entry rather than adding a
    // second one for the same machine.
    await User.updateOne({ _id: userId }, { $pull: { sessions: { deviceId } } });
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          sessions: {
            $each: [entry],
            $sort: { lastSeenAt: -1 },
            $slice: cap,
          },
        },
      }
    );

    // The cached session record now has a stale device list.
    sessionVersion.invalidate(userId);

    const evicted = !exempt && !known && (before?.sessions || []).length >= MAX_DEVICES;
    if (evicted) {
      logger.info('Device limit reached — evicted least recently used session', {
        userId: String(userId),
        max: MAX_DEVICES,
      });
    }
    return { evicted };
  } catch (err) {
    // A failure here must not block sign-in; the worst case is that the device
    // cap is not enforced for this session.
    logger.error('deviceSessions.register failed', { error: err.message, userId: String(userId) });
    return { evicted: false };
  }
}

/** Whether a device still holds a live session. */
function isActive(sessions, deviceId) {
  if (!deviceId) return true; // tokens predating this feature — see verifyToken
  return (sessions || []).some((s) => s.deviceId === deviceId);
}

/** Bump lastSeenAt, at most once per TOUCH_INTERVAL_MS per device. */
function touch(userId, deviceId) {
  if (!deviceId) return;
  const key = `${userId}:${deviceId}`;
  const last = lastTouched.get(key) || 0;
  if (Date.now() - last < TOUCH_INTERVAL_MS) return;
  lastTouched.set(key, Date.now());

  User.updateOne(
    { _id: userId, 'sessions.deviceId': deviceId },
    { $set: { 'sessions.$.lastSeenAt': new Date() } }
  ).catch((err) => logger.warn('deviceSessions.touch failed', { error: err.message }));
}

/** Devices for the "Your devices" panel. Never exposes the raw device id. */
async function list(userId, currentDeviceId) {
  const user = await User.findById(userId).select('sessions').lean();
  return (user?.sessions || [])
    .slice()
    .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
    .map((s) => ({
      // A short prefix is enough to tell two devices apart in the UI, and
      // handing back the full id would let one tab impersonate another device.
      id: s.deviceId.slice(0, 8),
      label: s.label || 'Unknown device',
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      current: Boolean(currentDeviceId && s.deviceId === currentDeviceId),
    }));
}

/**
 * Revoke one device by its short id. The next request from it fails the
 * verifyToken device check and it is signed out.
 */
async function revoke(userId, shortId) {
  const user = await User.findById(userId).select('sessions').lean();
  const match = (user?.sessions || []).find((s) => s.deviceId.startsWith(shortId));
  if (!match) return false;

  await User.updateOne({ _id: userId }, { $pull: { sessions: { deviceId: match.deviceId } } });
  sessionVersion.invalidate(userId);
  lastTouched.delete(`${userId}:${match.deviceId}`);
  return true;
}

/** Drop every device. Used when a password changes. */
async function revokeAll(userId) {
  await User.updateOne({ _id: userId }, { $set: { sessions: [] } });
  sessionVersion.invalidate(userId);
}

module.exports = {
  MAX_DEVICES,
  EXEMPT_CAP,
  isExempt,
  register,
  isActive,
  touch,
  list,
  revoke,
  revokeAll,
  describeDevice,
  _resetTouchCache: () => lastTouched.clear(),
};
