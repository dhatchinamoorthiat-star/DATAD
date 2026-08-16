import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useNotificationData } from '../../context/NotificationContext';

// ── Type → Toast config mapping ──────────────────────────────────────────
const NOTIF_TYPE_TOAST = {
  reaction:       { type: 'success', icon: '👍' },
  rsvp:           { type: 'info',    icon: '📅' },
  placement_apply:{ type: 'info',    icon: '💼' },
  mention:        { type: 'warning', icon: '@'   },
  announcement:   { type: 'info',    icon: '📢' },
  general:        { type: 'info',    icon: '💬' },
  task:           { type: 'success', icon: '✓'   },
  milestone:      { type: 'success', icon: '🏆' },
  subscription:   { type: 'info',    icon: '⭐' },
  career_alert:   { type: 'info',    icon: '💼' },
  ai_complete:    { type: 'success', icon: '🤖' },
  ai_error:       { type: 'error',   icon: '⚠️' },
  credit_alert:   { type: 'warning', icon: '📊' },
  billing:        { type: 'success', icon: '💰' },
  system:         { type: 'info',    icon: '🔧' },
  session:        { type: 'error',   icon: '🔒' },
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const seenIds = useRef(new Set());
  const primed = useRef(false);
  const toast = useToast();
  const {
    notifications: items,
    unreadCount: unread,
    initialized,
    refresh,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotificationData();

  // Toast newly-arrived notifications. The list itself comes from the
  // context, which owns the only fetch loop — the bell no longer polls.
  useEffect(() => {
    if (!initialized) return;

    // Whatever was present on the first completed load is backlog, not
    // news. Record it silently, otherwise every login opens with a stack
    // of toasts for notifications the user has already been sitting on.
    // Keyed off `initialized` rather than a non-empty list, so a user who
    // logs in with an empty inbox still gets toasted for their first
    // real-time notification.
    if (!primed.current) {
      for (const n of items) seenIds.current.add(n._id);
      primed.current = true;
      return;
    }

    for (const n of items) {
      if (seenIds.current.has(n._id) || n.read) continue;
      seenIds.current.add(n._id);

      const toastCfg = NOTIF_TYPE_TOAST[n.type] || { type: 'info', icon: '💬' };
      const body = n.body ? ` — ${n.body.slice(0, 60)}` : '';
      // No explicit id: the toast module dedupes on message content, so
      // repeated reminders that share wording (recurring cron nudges are
      // separate documents with distinct _ids) collapse into one toast
      // instead of stacking five copies of the same sentence.
      toast.show(`${n.title}${body}`, toastCfg.type, {
        icon: toastCfg.icon,
        duration: 5000,
        action: n.link ? {
          label: 'View',
          onClick: () => { setOpen(false); navigate(n.link); },
        } : undefined,
      });
    }
  }, [items, initialized, navigate, toast]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n) => {
    if (!n.read) await markAsRead(n._id);
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const handleMarkAll = () => markAllAsRead();

  const handleDelete = (e, id) => {
    e.stopPropagation();
    return removeNotification(id);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) refresh(); }}
        aria-label="Notifications"
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400">
                  <Check className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-gray-400">
                <Bell className="h-8 w-8 opacity-30" />
                <span>All caught up!</span>
                <span className="text-xs opacity-50">New alerts appear here</span>
              </li>
            )}
            {items.map((n) => {
              const toastCfg = NOTIF_TYPE_TOAST[n.type] || {};
              return (
                <li
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={`group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${!n.read ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'}`}>
                    {toastCfg.icon || '💬'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
                    {n.body && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, n._id)}
                    className="hidden shrink-0 rounded p-1 text-gray-300 hover:text-red-500 group-hover:block dark:text-gray-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
