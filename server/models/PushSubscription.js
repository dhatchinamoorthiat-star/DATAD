const mongoose = require('mongoose');

/**
 * A browser's Web Push endpoint for one user on one device.
 *
 * One row per (user, device). The same student on a laptop and a phone has two,
 * and both should ring — this is the model that makes a notification reach a
 * phone whose PWA is closed, which SSE by definition cannot do.
 *
 * `endpoint` is globally unique, not unique-per-user: the browser mints it, and
 * if two accounts sign in on one device the second subscribe must move the
 * endpoint rather than create a second row pointing at the same push service
 * URL. Otherwise the first account keeps receiving the second account's
 * notifications on a device it no longer owns.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // Ties the subscription to the same device identity the session cap uses,
    // so signing out of a device can retire its push endpoint too.
    deviceId: { type: String },
    userAgent: { type: String },
    // Bumped on every successful send; a push service that answers 404/410 has
    // permanently retired the endpoint and the row is deleted outright.
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
