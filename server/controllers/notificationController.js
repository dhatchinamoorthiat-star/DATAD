const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const notificationService = require('../notifications/NotificationService');
const registry = require('../notifications/NotificationRegistry');

const OFFLINE_MODE = process.env.LOCAL_OFFLINE_MODE === 'true';

exports.list = async (req, res, next) => {
  // Local development: MongoDB unavailable
  if (OFFLINE_MODE) {
    return res.json({
      notifications: [],
      unread: 0,
    });
  }

  try {
    const notifications = await Notification.find({ user: req.user.userId })
      .populate('actor', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const withPriority = notifications.map((n) => ({
      ...n,
      priority: registry.getPriority(n.type),
      icon: registry.getIcon(n.type),
      color: registry.getColor(n.type),
    }));

    const unread = notifications.filter((n) => !n.read).length;

    res.json({ notifications: withPriority, unread });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  if (OFFLINE_MODE) {
    return res.json({ ok: true });
  }

  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { read: true }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  if (OFFLINE_MODE) {
    return res.json({ ok: true });
  }

  try {
    await Notification.updateMany(
      { user: req.user.userId, read: false },
      { read: true }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  if (OFFLINE_MODE) {
    return res.json({ ok: true });
  }

  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Helper used by other controllers — routes through NotificationService
// for dedup, SSE broadcast, and channel routing.
//
// Dedup stays off by default: callers here are mostly per-event (a reaction,
// an RSVP) where collapsing on title alone would merge notifications about
// genuinely different posts. Callers that repeat the same message — recurring
// reminder crons — opt in by passing `dedupUnread` or `dedupWindowMs`.
exports.notify = async ({
  user,
  type,
  title,
  body,
  link,
  actor,
  dedupUnread,
  dedupWindowMs,
}) => {
  if (!user || user.toString() === (actor || '').toString()) return;

  // Don't attempt database-backed notifications in local offline mode.
  if (OFFLINE_MODE) {
    logger.debug('Notification skipped in local offline mode', {
      user,
      type,
      title,
    });
    return;
  }

  const wantsDedup = Boolean(dedupUnread || dedupWindowMs);

  return notificationService.send(user, {
    type,
    title,
    body,
    link,
    actor,
    skipDedup: !wantsDedup,
    dedupUnread,
    dedupWindowMs,
  });
};

// Bulk helper — routes through NotificationService for SSE broadcast.
exports.notifyBulk = async (
  userIds,
  { type, title, body, link, actor }
) => {
  if (OFFLINE_MODE) {
    logger.debug('Bulk notifications skipped in local offline mode', {
      type,
      title,
    });
    return;
  }

  return notificationService.sendBulk(userIds, {
    type,
    title,
    body,
    link,
    actor,
  });
};