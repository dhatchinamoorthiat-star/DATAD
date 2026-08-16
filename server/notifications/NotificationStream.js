/**
 * NotificationStream — Server-Sent Events (SSE) broadcaster.
 *
 * Manages connected clients and pushes new notifications in real-time.
 * Replaces 30-second polling with instant delivery.
 *
 * Client connects:  GET /api/notifications/stream
 * Events:
 *   event: notification
 *   data: { type, title, body, unread, ... }
 *
 * Heartbeat every 30s keeps the connection alive.
 */

const logger = require('../utils/logger');

// ── Connected clients ────────────────────────────────────────────────────

const clients = new Map(); // userId → Set<res>

// ── Add / remove clients ─────────────────────────────────────────────────

function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  res.on('close', () => {
    const set = clients.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(userId);
    }
  });

  logger.debug(`[SSE] Client connected for user ${userId} (total: ${clientCount()})`);
}

function removeClient(res) {
  for (const [userId, set] of clients) {
    if (set.has(res)) {
      set.delete(res);
      if (set.size === 0) clients.delete(userId);
      break;
    }
  }
}

function clientCount() {
  let count = 0;
  for (const set of clients.values()) count += set.size;
  return count;
}

// ── Broadcast to a single user ───────────────────────────────────────────

function broadcastToUser(userId, data) {
  const set = clients.get(String(userId));
  if (!set || set.size === 0) return;

  const payload = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      logger.warn('[SSE] Write failed, removing client', { error: err.message });
      set.delete(res);
    }
  }

  if (set.size === 0) clients.delete(String(userId));
}

// ── Broadcast to many users ──────────────────────────────────────────────

function broadcastToUsers(userIds, data) {
  for (const id of userIds) {
    broadcastToUser(id, data);
  }
}

// ── Heartbeat ────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 30000; // 30s
let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [userId, set] of clients) {
      for (const res of set) {
        try {
          res.write(`:heartbeat ${now}\n\n`);
        } catch {
          set.delete(res);
        }
      }
      if (set.size === 0) clients.delete(userId);
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── Express middleware for SSE endpoint ──────────────────────────────────

function sseHandler(req, res) {
  // Support both JWT auth header (from axios) and query param (from EventSource)
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Initial connection event
  res.write(`event: connected\ndata: {"userId":"${userId}"}\n\n`);

  addClient(userId, res);

  // Cleanup on client disconnect
  req.on('close', () => {
    removeClient(res);
    logger.debug(`[SSE] Client disconnected for user ${userId} (total: ${clientCount()})`);
  });
}

// ── Init / cleanup ───────────────────────────────────────────────────────

function init() {
  startHeartbeat();
  logger.info('[SSE] Notification stream initialized');
}

function shutdown() {
  stopHeartbeat();
  for (const [, set] of clients) {
    for (const res of set) {
      try { res.end(); } catch { /* ignore */ }
    }
  }
  clients.clear();
  logger.info('[SSE] Notification stream shut down');
}

module.exports = {
  sseHandler,
  broadcastToUser,
  broadcastToUsers,
  init,
  shutdown,
  clientCount,
};
