import { useEffect, useState } from 'react';
import toast from '../../utils/toast';
import { CreditCard, CheckCircle2, XCircle, Clock, Users, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  listSubscriptionUsers,
  listSubscriptionRequests,
  updateUserTier,
  reviewSubscriptionRequest,
} from '../../api/admin';
import { AdminShell } from './shared';
import Loader from '../../components/common/Loader';
import ConfirmModal from '../../components/common/ConfirmModal';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Mirrors the server defaults: trial = 7 days, pro/max = 1 month
const expiryFor = (tier) => {
  const d = new Date();
  if (tier === 'trial') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

const TIERS = ['free', 'trial', 'pro', 'max'];

const TIER_STYLE = {
  free:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  trial: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  pro:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  max:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

function TierBadge({ tier }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TIER_STYLE[tier] || TIER_STYLE.free}`}>
      {tier}
    </span>
  );
}

// ── Inline tier selector ───────────────────────────────────────────────────
function TierSelect({ userId, userName, currentTier, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [confirmTier, setConfirmTier] = useState(null);
  const [loading, setLoading] = useState(false);

  const pick = (tier) => {
    setOpen(false);
    if (tier !== currentTier) setConfirmTier(tier);
  };

  const doUpdate = async () => {
    setLoading(true);
    try {
      const res = await updateUserTier(userId, { tier: confirmTier });
      toast.success(res.data?.message || `Updated to ${confirmTier}`);
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const confirmMessage = confirmTier === 'free'
    ? `${userName} will be downgraded to Free immediately.`
    : confirmTier === 'trial'
    ? `${userName} will get a 7-day trial from ${fmtDate(new Date())} till ${fmtDate(expiryFor('trial'))}.`
    : `${userName} will be on ${(confirmTier || '').toUpperCase()} from ${fmtDate(new Date())} till ${fmtDate(expiryFor(confirmTier || 'pro'))} (1 month). The plan expires automatically after that.`;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TIER_STYLE[currentTier] || TIER_STYLE.free} cursor-pointer`}
      >
        {loading ? '…' : currentTier}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => pick(t)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs capitalize hover:bg-gray-50 dark:hover:bg-gray-800 ${t === currentTier ? 'font-bold' : ''}`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${t === 'free' ? 'bg-gray-400' : t === 'trial' ? 'bg-indigo-400' : t === 'pro' ? 'bg-amber-400' : 'bg-purple-400'}`} />
              {t}
            </button>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmTier}
        onClose={() => setConfirmTier(null)}
        onConfirm={doUpdate}
        title="Confirm tier change"
        message={confirmMessage}
        confirmLabel="Update tier"
        danger={confirmTier === 'free'}
      />
    </div>
  );
}

// ── Pending requests ───────────────────────────────────────────────────────
function RequestCard({ req, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'approve' | 'reject'

  const review = async (action) => {
    setLoading(true);
    try {
      await reviewSubscriptionRequest(req._id, { action });
      toast.success(action === 'approve' ? `Approved — ${req.user?.name} is now ${req.tier} for 1 month` : 'Request rejected');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = {
    pending:  <Clock className="h-4 w-4 text-amber-500" />,
    approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    rejected: <XCircle className="h-4 w-4 text-red-400" />,
  }[req.status];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {statusIcon}
          <span className="font-semibold">{req.user?.name || 'Unknown'}</span>
          <span className="text-xs text-gray-400">{req.user?.email}</span>
          <TierBadge tier={req.tier} />
          <span className="text-xs text-gray-400">₹{req.amountPaid}</span>
          {req.duplicateRef && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" /> ref already used by another approved request
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Ref: <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{req.paymentRef}</span>
          {req.upiId && <> · UPI: {req.upiId}</>}
        </p>
        {req.note && <p className="mt-0.5 text-xs text-gray-400">Note: {req.note}</p>}
        <p className="mt-0.5 text-xs text-gray-400">{new Date(req.createdAt).toLocaleString('en-IN')}</p>
      </div>

      {req.status === 'pending' && (
        <>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setPendingAction('reject')}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-gray-700"
          >
            Reject
          </button>
          <button
            onClick={() => review('approve')}
            disabled={loading}
            title={req.duplicateRef ? 'Warning: this payment ref was already used on another approved request' : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${req.duplicateRef ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {loading ? 'Approving…' : 'Approve & Activate'}
          </button>
        </div>
        <ConfirmModal
          open={!!pendingAction}
          onClose={() => setPendingAction(null)}
          onConfirm={() => review(pendingAction)}
          title="Reject request?"
          message={`Reject this ${req.tier?.toUpperCase()} request from ${req.user?.name || 'this user'}. No tier change will be made.`}
          confirmLabel="Reject"
          danger
        />
        </>
      )}

      {req.status !== 'pending' && (
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'}`}>
          {req.status}
        </span>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState('requests'); // 'requests' | 'users'
  const [users, setUsers] = useState(null);
  const [requests, setRequests] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [search, setSearch] = useState('');

  const loadUsers = () =>
    listSubscriptionUsers().then((r) => setUsers(r.data)).catch(() => toast.error('Failed to load users'));

  const loadRequests = () =>
    listSubscriptionRequests(filterStatus || undefined).then((r) => setRequests(r.data)).catch(() => toast.error('Failed to load requests'));

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { loadRequests(); }, [filterStatus]);

  const pendingCount = requests?.filter((r) => r.status === 'pending').length ?? 0;

  const filteredUsers = (users || []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <AdminShell
      title="Subscriptions"
      icon={CreditCard}
      subtitle="Manage payment requests and user tier assignments"
    >
      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/50">
        {[
          { id: 'requests', label: `Payment Requests${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}` },
          { id: 'users', label: 'All Users' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === t.id ? 'bg-white shadow-sm dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Payment Requests tab ─────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div>
          {/* Status filter */}
          <div className="mb-4 flex gap-2">
            {['pending', 'approved', 'rejected', ''].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setFilterStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {!requests ? (
            <Loader />
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400 dark:border-gray-800">
              No {filterStatus} requests
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <RequestCard key={r._id} req={r} onUpdated={loadRequests} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── All Users tab ────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700"
            />
            <span className="text-xs text-gray-400"><Users className="inline h-3.5 w-3.5" /> {filteredUsers.length} users</span>
          </div>

          {!users ? (
            <Loader />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
                  <tr>
                    {['Name', 'Email', 'Tier', 'Expires', 'Payment Ref', 'Joined'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {u.role === 'admin' && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">admin</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <TierSelect
                          userId={u._id}
                          userName={u.name}
                          currentTier={u.tier || 'free'}
                          onUpdated={loadUsers}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {u.tierExpiresAt ? new Date(u.tierExpiresAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{u.subscriptionRef || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
