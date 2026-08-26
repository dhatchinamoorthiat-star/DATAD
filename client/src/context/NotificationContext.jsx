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
import { useAuth } from './AuthContext';

const SSE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 60000;
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

/**
 * Where the SSE stream lives.
 *
 * EventSource takes an absolute-or-relative URL of its own; it does not go
 * through the axios instance, so it does not inherit `VITE_API_BASE_URL`. A
 * hardcoded `/api/...` is correct only when the API is same-origin (dev via the
 * Vite proxy, or a tunnel). In the deployed split — static client on one host,
 * Express on another — that path resolves against the *client* host, which
 * answers with the SPA's index.html. EventSource sees `text/html`, errors, and
 * the reconnect loop retries the same wrong URL forever: no live notification
 * ever arrives and the app silently falls back to the 60s poll. That is exactly
 * what an installed PWA looks like from the outside — "notifications work, but
 * only eventually".
 *
 * Mirrors api/axios.js: the env var wins, `/api` is the same-origin default.
 */
function streamUrl(token) {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  return `${base}/notifications/stream?token=${encodeURIComponent(token)}`;
}

export function NotificationProvider({ children }) {
  // Read from auth rather than from localStorage so signing in and signing out
  // are *events* here, not states this provider only notices on a page reload.
  // Every effect below keys off it.
  const { token: authToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pollRef = useRef(null);
  const attemptRef = useRef(0);

  // Prevent duplicate SSE events from being inserted twice.
  const notificationIdsRef = useRef(new Set());

  // ────────────────────────────────────────────────────────────────
  // SSE subscription
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;

      const token = authToken || getToken();

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

      // See streamUrl() — same base the axios instance uses, so a split
      // client/API deployment reaches the API rather than the static host.
      const evtSource = new EventSource(streamUrl(token));

      evtSource.addEventListener('connected', () => {
        if (!disposed) {
          setConnected(true);
          attemptRef.current = 0; // a good connection resets the backoff
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

        // Backoff, not a fixed 5s retry. A stream that fails once is usually a
        // dropped connection worth retrying immediately-ish; a stream that
        // fails every time is a misconfigured URL or an API that is down, and
        // hammering it every 5 seconds for as long as the app is open is how a
        // phone in someone's pocket burns battery achieving nothing.
        const delay = Math.min(
          SSE_RECONNECT_DELAY * 2 ** attemptRef.current,
          MAX_RECONNECT_DELAY
        );
        attemptRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
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
    // Keyed on the token: signing in opens the stream without a reload, and
    // signing out tears it down instead of leaving the previous account's
    // stream open behind the login screen.
  }, [authToken]);

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
    if (authToken || getToken()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    } else {
      // Signed out: drop the previous account's list rather than leaving it
      // rendered behind the login screen, and clear the bell's badge.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      setUnreadCount(0);
      setLastNotification(null);
      notificationIdsRef.current = new Set();
      setInitialized(true);
    }
  }, [load, authToken]);

  // ────────────────────────────────────────────────────────────────
  // Fallback polling
  // ────────────────────────────────────────────────────────────────

  const connectedRef = useRef(connected);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      // Guarded on the token like the SSE connect and the initial load above.
      // Without it this fired every 60s for signed-out visitors sitting on the
      // public landing page — /notifications answered 401, and the axios
      // interceptor read that as an expired session and toasted "Your session
      // expired" at someone who had never signed in.
      if (!connectedRef.current && (authToken || getToken())) {
        load();
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [load, authToken]);

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
