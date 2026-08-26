/**
 * NotificationService — centralized notification engine.
 *
 * All controllers call this instead of `notify()` directly.
 * Handles:
 *   • Channel routing (in-app, email)
 *   • Deduplication (same type + target within 5 min → bump, don't duplicate)
 *   • Grouping (e.g. "5 people liked your post")
 *   • Preference gating (future: per-user opt-in/out per category)
 *   • Telemetry logging
 *
 * Usage:
 *   const ns = require('./notifications/NotificationService');
 *   await ns.send(userId, { type: 'reaction', title: '...', body: '...', link: '...', actor: actorId });
 */

const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const registry = require('./NotificationRegistry');
const stream = require('./NotificationStream');
const push = require('./PushService');

const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Deliver one already-persisted notification to every live channel.
 *
 * SSE reaches an open tab; Web Push reaches the operating system of a phone
 * whose PWA is closed. Both are best-effort by design — the notification is
 * already in Mongo and will show up in the bell on next load regardless, so
 * neither channel is allowed to throw into the caller's request. That matters
 * most for push, whose failure modes are other people's servers.
 *
 * Callers run this inside setImmediate so delivery never sits in front of the
 * response.
 */
function fanout(userId, doc) {
  const payload = {
    _id: doc._id,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    link: doc.link,
    createdAt: doc.createdAt,
    read: false,
    groupCount: doc.groupCount || 1,
    priority: registry.getPriority(doc.type),
    icon: registry.getIcon(doc.type),
    color: registry.getColor(doc.type),
  };

  try {
    stream.broadcastToUser(userId, payload);
  } catch { /* SSE broadcast is best-effort */ }

  push.sendToUser(userId, payload).catch((err) => {
    logger.warn('[NotificationService] Push fanout failed', { error: err.message });
  });
}

/**
 * Send a notification to a single user.
 *
 * @param {string|ObjectId} userId
 * @param {object} opts
 * @param {string}  opts.type    - One of TYPE_CATEGORIES keys
 * @param {string}  opts.title   - Notification title
 * @param {string}  [opts.body]  - Optional body text
 * @param {string}  [opts.link]  - Optional deep-link path
 * @param {string}  [opts.actor] - Optional acting user ObjectId
 * @param {string}  [opts.actorName] - Optional actor display name
 * @param {boolean} [opts.skipDedup] - Skip deduplication check
 * @param {boolean} [opts.dedupUnread] - Dedup against any *unread* match regardless
 *                                       of age. Use for recurring reminders.
 * @param {number}  [opts.dedupWindowMs] - Override the default dedup window
 * @returns {Promise<object|null>} The created/updated notification, or null if skipped
 */
async function send(userId, opts = {}) {
  if (!userId) return null;
  if (!opts.type) { logger.warn('[NotificationService] send called without type'); return null; }
  if (!opts.title) { logger.warn('[NotificationService] send called without title'); return null; }

  const { type, title, body, link, actor, actorName, skipDedup, dedupUnread, dedupWindowMs } = opts;

  // Dedup: same type + similar title + same user.
  //
  // Two modes. The default is a short time window, which suits bursts of
  // activity (several reactions on one post). Recurring reminders need
  // `dedupUnread` instead: a daily cron fires 24h apart, so no sensible
  // window catches it, and re-nudging someone who hasn't read the previous
  // nudge just stacks identical copies in their bell.
  if (!skipDedup) {
    try {
      const criteria = {
        user: userId,
        type,
        title: { $regex: `^${escapeRegex(title.slice(0, 30))}` },
      };

      if (dedupUnread) {
        criteria.read = false;
      } else {
        criteria.createdAt = { $gte: new Date(Date.now() - (dedupWindowMs || DEDUP_WINDOW_MS)) };
      }

      const similar = await Notification.findOne(criteria).lean();

      if (similar) {
        // Bump the existing notification instead of creating a duplicate
        const updated = await Notification.findByIdAndUpdate(
          similar._id,
          { $set: { body, link, read: false }, $inc: { groupCount: 1 } },
          { new: true }
        ).lean();
        logger.debug(`[NotificationService] Dedup'd ${type} for ${userId}`);
        // Broadcast the bump too — otherwise a live bell only reflects the
        // dedup'd notification's original content until the next full poll.
        setImmediate(() => fanout(userId, updated));
        return { ...updated, deduped: true };
      }
    } catch (err) {
      // Dedup failure shouldn't block notification delivery
      logger.warn('[NotificationService] Dedup check failed', { error: err.message });
    }
  }

  try {
    const doc = await Notification.create({
      user: userId,
      type,
      title: actorName ? actorName + ' ' + title : title,
      body,
      link,
      actor: actor || undefined,
      groupCount: 1,
    });
    // Deliver live: SSE to an open tab, Web Push to a closed one.
    setImmediate(() => fanout(userId, doc));

    logger.debug(`[NotificationService] Created ${type} for ${userId}`);
    return doc;
  } catch (err) {
    logger.error('[NotificationService] Failed to create notification', {
      error: err.message, userId: String(userId), type, title,
    });
    return null;
  }
}

/**
 * Send a notification to many users at once (bulk).
 *
 * @param {string[]|ObjectId[]} userIds
 * @param {object} opts - Same as `send()` opts
 * @returns {Promise<number>} Number of notifications created
 */
async function sendBulk(userIds, opts = {}) {
  if (!userIds?.length) return 0;
  if (!opts.title) return 0;

  const { type, title, body, link, actor } = opts;
  const actorStr = actor ? String(actor) : null;

  const docs = userIds
    .filter(id => !actorStr || String(id) !== actorStr)
    .map(user => ({
      user,
      type: type || 'general',
      title,
      body: body || '',
      link: link || '',
      actor: actor || undefined,
      groupCount: 1,
    }));

  if (!docs.length) return 0;

  try {
    const created = await Notification.insertMany(docs, { ordered: false });
    // Deliver live, one recipient at a time. fanout() swallows per-user
    // failures, so one unreachable device cannot cut the broadcast short.
    setImmediate(() => {
      for (const n of created) fanout(n.user, n);
    });
    logger.debug(`[NotificationService] Bulk created ${docs.length} ${type} notifications`);
    return docs.length;
  } catch (err) {
    logger.error('[NotificationService] Bulk create failed', {
      error: err.message, count: docs.length, type,
    });
    return 0;
  }
}

/**
 * Get notifications for a user with pagination.
 */
async function getHistory(userId, { page = 1, limit = 50, type } = {}) {
  const filter = { user: userId };
  if (type) filter.type = type;

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .populate('actor', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  const unread = items.filter(n => !n.read).length;
  return { items, total, unread, page, limit };
}

/**
 * Get unread count grouped by type.
 */
async function getUnreadByType(userId) {
  const groups = await Notification.aggregate([
    { $match: { user: userId, read: false } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const total = groups.reduce((s, g) => s + g.count, 0);
  return { total, groups };
}

/**
 * Mark a single notification as read.
 */
async function markRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { read: true },
    { new: true }
  );
}

/**
 * Mark all notifications as read for a user.
 */
async function markAllRead(userId) {
  return Notification.updateMany({ user: userId, read: false }, { read: true });
}

/**
 * Delete a notification.
 */
async function remove(notificationId, userId) {
  return Notification.findOneAndDelete({ _id: notificationId, user: userId });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  send,
  sendBulk,
  getHistory,
  getUnreadByType,
  markRead,
  markAllRead,
  remove,
  getTypeColor: registry.getColor,
  getTypeIcon: registry.getIcon,
  getTypePriority: registry.getPriority,
  registry,
  REGISTRY: registry.REGISTRY,
};
