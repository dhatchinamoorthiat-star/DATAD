import { useEffect, useState } from 'react';
import { Gift, ArrowRight, Users, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { getReferralMap } from '../../api/admin';
import { formatDate } from '../../utils/dateUtils';
import Loader from '../../components/common/Loader';
import { AdminShell } from './shared';

const statusBadge = (status) =>
  status === 'approved'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';

// Recursively render the invite tree starting from a root user.
function ChainNode({ user, allUsers, depth = 0 }) {
  // find the person this user invited (who has referredBy = this user)
  const child = allUsers.find((u) => u.referredBy?._id === user._id);

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-indigo-100 pl-4 dark:border-indigo-900/40' : ''}>
      <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-800 dark:text-gray-100">{user.name}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(user.status)}`}>
            {user.status}
          </span>
        </div>
        <code className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide ${
          user.referralUsedBy
            ? 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800'
            : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
        }`}>
          {user.referralCode || '—'}
        </code>
        {user.referralUsedBy ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <ChevronRight className="h-3 w-3" /> used by <strong>{user.referralUsedBy.name}</strong>
          </span>
        ) : (
          <span className="text-xs text-gray-400">code unused</span>
        )}
        <span className="ml-auto text-xs text-gray-400">{formatDate(user.createdAt)}</span>
      </div>
      {child && <ChainNode user={child} allUsers={allUsers} depth={depth + 1} />}
    </div>
  );
}

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState(null);

  useEffect(() => {
    getReferralMap()
      .then((res) => setReferrals(res.data))
      .catch(() => setReferrals([]));
  }, []);

  if (!referrals) return <Loader />;

  const total = referrals.length;
  const used = referrals.filter((u) => u.referralUsedBy).length;
  const unused = referrals.filter((u) => !u.referralUsedBy).length;
  // Referral events: users who were referred by someone
  const referralEvents = referrals.filter((u) => u.referredBy);
  // Root users: joined without a referral code
  const roots = referrals.filter((u) => !u.referredBy);

  return (
    <AdminShell
      title="Referral network"
      icon={Gift}
      subtitle="Who vouched for whom — invite chains and code usage cycle"
    >
      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Total members', value: total, icon: Users, color: 'text-indigo-500' },
          { label: 'Codes used', value: used, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Codes available', value: unused, icon: Clock, color: 'text-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
            <Icon className={`mb-1 h-4 w-4 ${color}`} />
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Invite chain tree */}
      <div className="mb-6 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Invite chains
        </h2>
        {roots.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {roots.map((root) => (
              <ChainNode key={root._id} user={root} allUsers={referrals} depth={0} />
            ))}
          </div>
        )}
      </div>

      {/* Code usage cycle log */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Code usage log — {referralEvents.length} referral{referralEvents.length !== 1 ? 's' : ''}
        </h2>
        {referralEvents.length === 0 ? (
          <p className="text-sm text-gray-400">No referral codes have been used yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {referralEvents.map((u) => {
              const referrer = referrals.find((r) => r._id === u.referredBy?._id || r._id === u.referredBy);
              return (
                <li key={u._id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  {/* Referrer */}
                  <div className="min-w-[8rem]">
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      {u.referredBy?.name || '—'}
                    </p>
                    <p className="text-xs text-gray-400">{u.referredBy?.email}</p>
                  </div>

                  {/* Code */}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
                  <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-500 line-through dark:bg-gray-800 dark:text-gray-400">
                    {referrer?.referralCode || '—'}
                  </code>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />

                  {/* New member */}
                  <div className="min-w-[8rem]">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>

                  {/* Status + date */}
                  <div className="ml-auto flex items-center gap-2 text-right">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(u.status)}`}>
                      {u.status}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
