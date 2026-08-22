import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Inbox, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../../context/NotificationContext';

function groupByRecency(notifications) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const today = [];
  const earlier = [];

  for (const n of notifications) {
    const createdAt = n.createdAt ? new Date(n.createdAt) : null;
    if (createdAt && createdAt >= startOfToday) {
      today.push(n);
    } else {
      earlier.push(n);
    }
  }

  return { today, earlier };
}

function NotificationRow({ notification, onOpen, onDismiss }) {
  const timeLabel = notification.createdAt
    ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
    : '';

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(notification);
        }
      }}
      className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:hover:bg-gray-800/70 cursor-pointer"
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: `${notification.color || '#6b7280'}1a` }}
        aria-hidden="true"
      >
        {notification.icon || '🔔'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {!notification.read && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
          )}
          <span className={`truncate text-sm ${notification.read ? 'text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-800 dark:text-gray-100'}`}>
            {notification.title}
          </span>
        </span>
        {notification.body && (
          <span className="mt-0.5 block truncate text-xs text-gray-400 dark:text-gray-500">
            {notification.body}
          </span>
        )}
        <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">
          {timeLabel}
          {notification.groupCount > 1 ? ` · ×${notification.groupCount}` : ''}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Dismiss "${notification.title}"`}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification._id);
        }}
        className="shrink-0 rounded-full p-1 text-gray-300 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    initialized,
    error,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onMouse = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const { today, earlier } = useMemo(() => groupByRecency(notifications), [notifications]);

  const handleOpen = async (notification) => {
    await markAsRead(notification._id);
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 max-h-[28rem] w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3.5 py-2.5 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[23rem] overflow-y-auto p-1.5" aria-live="polite">
            {!initialized ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Couldn&apos;t load notifications.</p>
                <button
                  onClick={refresh}
                  className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400"
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Inbox className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">You&apos;re all caught up</p>
              </div>
            ) : (
              <>
                {today.length > 0 && (
                  <div className="mb-1">
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Today</p>
                    {today.map((n) => (
                      <NotificationRow key={n._id} notification={n} onOpen={handleOpen} onDismiss={removeNotification} />
                    ))}
                  </div>
                )}
                {earlier.length > 0 && (
                  <div>
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Earlier</p>
                    {earlier.map((n) => (
                      <NotificationRow key={n._id} notification={n} onOpen={handleOpen} onDismiss={removeNotification} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
