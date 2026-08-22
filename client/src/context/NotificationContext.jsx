/**
 * NotificationContext — the single owner of persistent notification data.
 *
 * Responsibilities:
 * • Subscribe to SSE stream for real-time updates
 * • Poll as fallback when SSE unavailable/disconnects
 * • Track unreadCount and lastNotification for badge + toast bridge
 * • Own read/delete mutations so the list stays consistent everywhere
 * • Fan out high-priority notifications to a toast (see TOAST_VARIANT_BY_TYPE)
 *
 * Consumers must not fetch `/notifications` themselves.
 *
 * Ephemeral toast display lives in ToastContext — this context only decides
 * *whether* a given notification also deserves one, using the same priority
 * scale as server/notifications/NotificationRegistry.js. Session-expiry toast
 * lives in AuthContext, next to the logout it accompanies.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from '../api/notifications';
import toast from '../utils/toast';

const SSE_RECONNECT_DELAY = 5000;
const POLL_INTERVAL = 60000;

// Only priority <= 1 (server/notifications/NotificationRegistry.js) reaches
// a toast — everything else joins the bell silently so ambient activity
// (reactions, suggestions) doesn't interrupt the student.
const TOAST_PRIORITY_THRESHOLD = 1;

const TOAST_VARIANT_BY_TYPE = {
  ai_error: 'error',
  credit_alert: 'warning',
  session: 'warning',
  milestone: 'success',
  billing: 'info',
  subscription: 'info',
  career_alert: 'info',
  placement_apply: 'info',
  mention: 'info',
  announcement: 'info',
};

const NotificationDataContext = createContext(null);

function getToken() {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pollRef = useRef(null);

  // Prevent duplicate SSE events from being inserted twice.
  const notificationIdsRef = useRef(new Set());

  // ────────────────────────────────────────────────────────────────
  // SSE subscription
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;

      const token = getToken();

      if (!token) {
        setConnected(false);
        return;
      }

      // Close previous connection before opening another one.
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      /*
       * IMPORTANT:
       *
       * Use a relative URL.
       *
       * Browser
       *   ↓
       * ngrok
       *   ↓
       * Vite
       *   ↓ /api
       * Express :5001
       *
       * This avoids accidentally sending SSE to a different host.
       */
      const evtSource = new EventSource(
        `/api/notifications/stream?token=${encodeURIComponent(token)}`
      );

      evtSource.addEventListener('connected', () => {
        if (!disposed) {
          setConnected(true);
        }
      });

      evtSource.addEventListener('notification', (event) => {
        if (disposed) return;

        try {
          const data = JSON.parse(event.data);

          // Avoid duplicate notifications.
          const notificationId = data?._id || data?.id;

          if (notificationId) {
            if (notificationIdsRef.current.has(notificationId)) {
              return;
            }

            notificationIdsRef.current.add(notificationId);

            // Prevent the Set from growing indefinitely.
            if (notificationIdsRef.current.size > 200) {
              const firstId = notificationIdsRef.current.values().next().value;
              notificationIdsRef.current.delete(firstId);
            }
          }

          setLastNotification(data);

          setUnreadCount((prev) => prev + 1);

          setNotifications((prev) => {
            const updated = [data, ...prev];

            return updated.slice(0, 50);
          });

          if ((data?.priority ?? Infinity) <= TOAST_PRIORITY_THRESHOLD) {
            const variant = TOAST_VARIANT_BY_TYPE[data.type] || 'info';
            toast.show(data.title, variant, { id: `notification:${notificationId}` });
          }
        } catch {
          // Ignore malformed SSE payloads.
        }
      });

      evtSource.onerror = () => {
        if (disposed) return;

        setConnected(false);

        evtSource.close();

        if (eventSourceRef.current === evtSource) {
          eventSourceRef.current = null;
        }

        // Reconnect after 5 seconds.
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, SSE_RECONNECT_DELAY);
      };

      eventSourceRef.current = evtSource;
    }

    connect();

    return () => {
      disposed = true;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      setConnected(false);
    };
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Load notifications
  // ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await listNotifications();
      const notifs = res.data.notifications || [];
      const unread = res.data.unread || 0;

      setNotifications(notifs);
      setUnreadCount(unread);
      setError(null);

      // Seed the duplicate-protection set with existing notifications.
      notificationIdsRef.current = new Set(
        notifs
          .map((notification) => notification?._id)
          .filter(Boolean)
      );

      if (notifs.length) {
        setLastNotification(notifs[0]);
      }
    } catch (err) {
      // A background poll failing shouldn't disrupt the app, but the panel
      // needs to be able to tell "no notifications" from "couldn't load".
      setError(err);
    } finally {
      setInitialized(true);
    }
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Initial notification load
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();

    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    } else {
      setInitialized(true);
    }
  }, [load]);

  // ────────────────────────────────────────────────────────────────
  // Fallback polling
  // ────────────────────────────────────────────────────────────────

  const connectedRef = useRef(connected);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (!connectedRef.current) {
        load();
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [load]);

  // ────────────────────────────────────────────────────────────────
  // Keep notification ref synchronized
  // ────────────────────────────────────────────────────────────────

  const notificationsRef = useRef(notifications);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // ────────────────────────────────────────────────────────────────
  // Mark one notification as read
  // ────────────────────────────────────────────────────────────────

  const markAsRead = useCallback(async (id) => {
    const target = notificationsRef.current.find(
      (notification) => notification._id === id
    );

    if (!target || target.read) {
      return;
    }

    await markRead(id).catch(() => {});

    setNotifications((prev) =>
      prev.map((notification) =>
        notification._id === id
          ? { ...notification, read: true }
          : notification
      )
    );

    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Mark all notifications as read
  // ────────────────────────────────────────────────────────────────

  const markAllAsRead = useCallback(async () => {
    await markAllRead().catch(() => {});

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    );

    setUnreadCount(0);
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Delete notification
  // ────────────────────────────────────────────────────────────────

  const removeNotification = useCallback(async (id) => {
    const target = notificationsRef.current.find(
      (notification) => notification._id === id
    );

    await deleteNotification(id).catch(() => {});

    setNotifications((prev) =>
      prev.filter((notification) => notification._id !== id)
    );

    notificationIdsRef.current.delete(id);

    if (target && !target.read) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Context value
  // ────────────────────────────────────────────────────────────────

  const value = {
    unreadCount,
    setUnreadCount,
    lastNotification,
    notifications,
    connected,
    initialized,
    error,
    refresh: load,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };

  return (
    <NotificationDataContext.Provider value={value}>
      {children}
    </NotificationDataContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationDataContext);

  if (!ctx) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }

  return ctx;
}

export default NotificationDataContext;
