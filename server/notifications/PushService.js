/**
 * PushService — Web Push (VAPID) delivery.
 *
 * The one channel that reaches a student whose app is closed. SSE
 * (NotificationStream) only delivers to an open, foregrounded tab; this
 * delivers to the operating system.
 *
 * Deliberately inert without configuration. If VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY are unset — every dev machine, CI, and any deploy that
 * hasn't generated keys — `isEnabled()` is false, `sendToUser()` returns 0
 * without touching the network, and the subscribe endpoints answer 503. Nothing
 * throws and no other channel changes behaviour. Generate keys with:
 *
 *   npx web-push generate-vapid-keys
 *
 * Failure policy: a push that fails is *dropped*, never retried and never
 * surfaced to the caller. The in-app notification is already written to Mongo
 * and broadcast over SSE by the time we get here, so a dead push endpoint costs
 * a lock-screen banner, not a notification. The alternative — letting a push
 * error propagate — would mean a student's post fails to save because a phone
 * they threw away last year has a stale endpoint.
 */

const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');
const registry = require('./NotificationRegistry');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
// The VAPID spec wants a contact for the push service to reach if our
// subscriptions misbehave. mailto: is the conventional form.
const CONTACT = process.env.VAPID_SUBJECT || 'mailto:support@datad.app';

let configured = false;

if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (err) {
    // Malformed keys are a config error, not a runtime one: log loudly once at
    // boot and stay disabled rather than throwing on every notification.
    logger.error('[Push] Invalid VAPID keys — push disabled', { error: err.message });
  }
}

function isEnabled() {
  return configured;
}

function getPublicKey() {
  return configured ? PUBLIC_KEY : null;
}

/**
 * Register (or move) a browser subscription.
 *
 * Upserts on `endpoint` so re-subscribing the same browser — which happens on
 * every permission re-grant and whenever the push service rotates an endpoint —
 * updates the existing row instead of accumulating duplicates that would each
 * deliver their own copy of the same banner.
 */
async function saveSubscription(userId, subscription, { deviceId, userAgent } = {}) {
  const { endpoint, keys } = subscription || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    const err = new Error('Malformed push subscription');
    err.status = 400;
    throw err;
  }

  return PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        user: userId,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        deviceId,
        userAgent,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function removeSubscription(userId, endpoint) {
  if (!endpoint) return 0;
  const res = await PushSubscription.deleteOne({ endpoint, user: userId });
  return res.deletedCount || 0;
}

/**
 * Should this notification type ring a phone?
 *
 * Reads the `channels.push` flag the registry already declares per type, rather
 * than inventing a second opinion. Today that is the five types worth waking
 * someone for — task, career_alert, placement_apply, billing, session — and
 * ambient chatter like reactions stays silent by construction.
 */
function shouldPush(type) {
  return registry.get(type)?.channels?.push === true;
}

/**
 * Fan a notification out to every device the user has registered.
 *
 * @returns {Promise<number>} count of endpoints that accepted the push
 */
async function sendToUser(userId, notification = {}) {
  if (!configured || !userId) return 0;
  if (!shouldPush(notification.type)) return 0;

  let subs;
  try {
    subs = await PushSubscription.find({ user: userId }).lean();
  } catch (err) {
    logger.warn('[Push] Could not load subscriptions', { error: err.message });
    return 0;
  }

  if (!subs.length) return 0;

  // Keep the payload small — push services cap it (4KB is the usual limit) and
  // the service worker only needs enough to render a banner and route a tap.
  const payload = JSON.stringify({
    id: String(notification._id || ''),
    type: notification.type || 'general',
    title: notification.title || 'DATAD',
    body: notification.body || '',
    link: notification.link || '/',
    icon: registry.getIcon(notification.type),
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 12 * 60 * 60 } // a banner older than half a day is noise
      )
    )
  );

  const dead = [];
  let delivered = 0;

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      delivered += 1;
      return;
    }

    const status = result.reason?.statusCode;

    // 404/410 is the push service saying this endpoint is permanently gone —
    // the app was uninstalled, or the browser revoked permission. Deleting it
    // is the documented response; anything else (timeouts, 5xx) is transient
    // and the row stays for the next attempt.
    if (status === 404 || status === 410) {
      dead.push(subs[i].endpoint);
    } else {
      logger.warn('[Push] Send failed', { status, endpoint: subs[i].endpoint.slice(0, 40) });
    }
  });

  if (dead.length) {
    PushSubscription.deleteMany({ endpoint: { $in: dead } }).catch(() => {});
    logger.debug(`[Push] Pruned ${dead.length} expired subscription(s)`);
  }

  if (delivered) {
    PushSubscription.updateMany(
      { user: userId, endpoint: { $nin: dead } },
      { $set: { lastSentAt: new Date() } }
    ).catch(() => {});
  }

  return delivered;
}

module.exports = {
  isEnabled,
  getPublicKey,
  saveSubscription,
  removeSubscription,
  sendToUser,
  shouldPush,
};
