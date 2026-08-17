import { useEffect, useState } from 'react';
import {
  ScrollText,
  UserPlus,
  UserCheck,
  UserX,
  KeyRound,
  UserMinus,
  Gift,
  Crown,
} from 'lucide-react';
import { getActivityLogs } from '../../api/admin';
import { formatDate } from '../../utils/dateUtils';
import Loader from '../../components/common/Loader';
import { AdminShell } from './shared';

const LOG_META = {
  register_pending: { icon: UserPlus, color: 'text-orange-500' },
  register_referral: { icon: Gift, color: 'text-emerald-500' },
  register_admin: { icon: Crown, color: 'text-amber-500' },
  approved: { icon: UserCheck, color: 'text-emerald-500' },
  rejected: { icon: UserX, color: 'text-red-500' },
  password_reset_requested: { icon: KeyRound, color: 'text-indigo-500' },
  password_reset_done: { icon: KeyRound, color: 'text-emerald-500' },
  account_deleted: { icon: UserMinus, color: 'text-red-500' },
};

const timeAgo = (date) => {
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(date);
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    getActivityLogs()
      .then((res) => setLogs(res.data))
      // An empty log table beats <Loader/> forever with no explanation.
      .catch(() => setLogs([]));
  }, []);

  if (!logs) return <Loader />;

  return (
    <AdminShell
      title="Activity log"
      icon={ScrollText}
      subtitle="Every membership event — registrations, approvals, resets and deletions (latest 100)"
    >
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing yet — events appear here as members register, get approved and more.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.map((log) => {
              const meta = LOG_META[log.type] || { icon: ScrollText, color: 'text-gray-400' };
              const Icon = meta.icon;
              return (
                <li key={log._id} className="flex items-start gap-2.5 py-2.5 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">{log.message}</p>
                    <p className="text-xs text-gray-400">{log.actorEmail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{timeAgo(log.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
