import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from '../utils/toast';
import { Camera, KeyRound, Moon, ShieldAlert, Sun, Trash2, UserRound, Gift, Copy, MessageCircle, CreditCard, Crown, Zap, Star, CheckCircle2, ArrowRight, Smartphone, Wifi, WifiOff, RefreshCw, Download, HardDrive, Laptop } from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { getInstallInstructions } from '../utils/installInstructions';
import { changePassword, deleteAccount, getMe, listDevices, revokeDevice, updateProfile, uploadAvatar } from '../api/auth';
import { whatsappInviteUrl } from '../components/common/InviteCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import DaxProfilePanel from '../components/common/DaxProfilePanel';
import useDocumentTitle from '../hooks/useDocumentTitle';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const TIER_META = {
  free:  { label: 'Free',  icon: Star,         color: 'gray',   badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  trial: { label: 'Trial', icon: Zap,           color: 'indigo', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  pro:   { label: 'Pro',   icon: Zap,           color: 'amber',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  placement: { label: 'Placement Pass', icon: Crown, color: 'purple', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

const TIER_BENEFITS = {
  free:  ['Notes (create & read)', 'Resume builder (manual)', 'Planner & journal', 'Finance tracker', 'Company list (browse)', 'Community & gallery'],
  trial: ['Everything in Pro for 7 days', 'Dax Summaries', 'Dax Resume Review', 'Company prep cards', 'Dax Research', 'Dax Planner'],
  pro:   ['Dax Summaries', 'Dax Resume Review & feedback', 'Company prep cards (full detail)', 'Daily personalized Dax briefing', 'Interview question bank', 'Daily case studies', 'Dax Planner', 'Dax Research', 'Career readiness score'],
  placement: ['Everything in Pro', 'Resume ATS scoring', 'Interview simulator', 'Company research & prep cards', 'Multi-company comparison', 'Career readiness score'],
};

function SubscriptionCard() {
  const { tier, tierExpiresAt, daysLeft, trialUsed, credits } = useSubscription();
  const meta = TIER_META[tier] || TIER_META.free;
  const Icon = meta.icon;
  const benefits = TIER_BENEFITS[tier] || TIER_BENEFITS.free;
  const isActive = tier !== 'free';
  const urgentExpiry = daysLeft !== null && daysLeft <= 3;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <CreditCard className="h-4 w-4" /> Subscription
      </h2>

      {/* Plan header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.badge}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">DATAD {meta.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badge}`}>{meta.label}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tier === 'free' ? 'Basic access — Dax not included' :
               tier === 'trial' ? 'Full Pro access for 7 days' :
               tier === 'pro' ? 'Dax for everyday study' : 'Full placement toolkit — 3 months'}
            </p>
          </div>
        </div>
        {(tier === 'free' || tier === 'trial') && (
          <Link
            to="/subscribe"
            className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
          >
            Upgrade
          </Link>
        )}
      </div>

      {/* Status details */}
      <div className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Status</span>
          <span className={`font-medium ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {isActive ? '● Active' : '○ Free plan'}
          </span>
        </div>
        {tier === 'trial' && (
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Trial started</span>
            <span className="font-medium">{trialUsed ? 'Yes' : '—'}</span>
          </div>
        )}
        {tierExpiresAt && (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {tier === 'trial' ? 'Trial expires' : 'Next billing date'}
              </span>
              <span className={`font-medium ${urgentExpiry ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {fmtDate(tierExpiresAt)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Days remaining</span>
              <span className={`font-semibold ${urgentExpiry ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'}`}>
                {daysLeft} day{daysLeft === 1 ? '' : 's'}
                {urgentExpiry && ' ⚠'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Dax credits — daily AI allowance, weighted by model cost */}
      {credits && credits.limit > 0 ? (
        <div className="mb-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Dax credits today</span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {credits.used} / {credits.limit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={`h-2 rounded-full transition-all ${
                credits.used / credits.limit >= 0.95
                  ? 'bg-red-500'
                  : credits.used / credits.limit >= 0.75
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, Math.round((credits.used / credits.limit) * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Advanced models use more credits per request · resets daily at midnight UTC
          </p>
        </div>
      ) : tier === 'free' ? (
        <div className="mb-4 rounded-xl border border-dashed border-gray-300 p-4 text-center dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            AI credits unlock with a trial or paid plan.{' '}
            <Link to="/subscribe" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">See plans</Link>
          </p>
        </div>
      ) : null}

      {/* Benefits */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {tier === 'free' ? 'Included in Free' : 'Your benefits'}
      </p>
      <ul className="mb-4 grid gap-1 sm:grid-cols-2">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {b}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/subscribe"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          {tier === 'free' ? 'View upgrade plans' : 'Manage subscription'}
        </Link>
      </div>
    </section>
  );
}

function relativeTime(date) {
  const mins = Math.round((Date.now() - new Date(date)) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Active sessions. Primarily a security feature — spotting a session you do
 * not recognise — which also makes the device cap visible rather than something
 * users only discover by being mysteriously signed out.
 */
function DevicesCard() {
  const [devices, setDevices] = useState(null);
  const [max, setMax] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = async (signal) => {
    try {
      const res = await listDevices();
      if (signal?.cancelled) return;
      setDevices(res.data.devices);
      setMax(res.data.max);
      setUnlimited(Boolean(res.data.unlimited));
    } catch {
      if (!signal?.cancelled) setDevices([]);
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    // The rule prefers data fetching to live outside effects, which needs a
    // query library this project does not use. The cancellation guard covers
    // the failure mode the rule protects against (a resolved fetch setting
    // state on an unmounted component).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(signal);
    return () => { signal.cancelled = true; };
  }, []);

  const onRevoke = async (id) => {
    setBusy(id);
    try {
      await revokeDevice(id);
      toast.success('Device signed out');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sign that device out');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Laptop className="h-4 w-4" /> Your devices
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        {unlimited
          ? 'This account is not subject to the device limit. Sessions are still listed here so you can sign out any you do not recognise.'
          : max
            ? `You can be signed in on ${max} devices at once. Signing in on a new one signs out the device you have not used in longest.`
            : 'Devices currently signed in to your account.'}
      </p>

      {devices === null && <p className="text-sm text-gray-400">Loading…</p>}
      {devices?.length === 0 && (
        <p className="text-sm text-gray-400">No other devices signed in.</p>
      )}

      <ul className="space-y-2">
        {(devices || []).map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {d.label}
                {d.current && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400">Last active {relativeTime(d.lastSeenAt)}</p>
            </div>
            {!d.current && (
              <button
                type="button"
                onClick={() => onRevoke(d.id)}
                disabled={busy === d.id}
                className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                {busy === d.id ? 'Signing out…' : 'Sign out'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({ title, icon: Icon, danger, children }) {
  return (
    <section
      className={`rounded-xl border p-5 ${
        danger
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      <h2 className={`mb-4 flex items-center gap-2 font-semibold ${danger ? 'text-red-600 dark:text-red-400' : ''}`}>
        <Icon className="h-4 w-4" /> {title}
      </h2>
      {children}
    </section>
  );
}

function fmtBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AppSection() {
  const {
    installed,
    isOnline,
    cacheSize,
    updateAvailable,
    deferredPrompt,
    isIOS,
    isAndroid,
    browser,
    installApp,
    applyUpdate,
    clearCache,
    requestCacheSize,
  } = usePWA();

  const [clearing, setClearing] = useState(false);
  const installSteps = getInstallInstructions({ isIOS, browser, isAndroid });

  useEffect(() => {
    requestCacheSize();
  }, [requestCacheSize]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await clearCache();
      toast.success('Cache cleared');
      setTimeout(() => requestCacheSize(), 500);
    } catch {
      toast.error('Could not clear cache');
    } finally {
      setClearing(false);
    }
  };

  const VERSION = '1.0.0';

  const row = 'flex items-center justify-between px-4 py-2.5 text-sm';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4" /> App
      </h2>

      <div className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        <div className={row}>
          <span className="text-gray-500 dark:text-gray-400">Version</span>
          <span className="font-mono text-xs font-medium">v{VERSION}</span>
        </div>
        <div className={row}>
          <span className="text-gray-500 dark:text-gray-400">Installed</span>
          <span className={`text-xs font-semibold ${installed ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
            {installed ? '● Installed' : '○ Browser tab'}
          </span>
        </div>
        <div className={row}>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            Connection
          </span>
          <span className={`text-xs font-semibold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className={row}>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <HardDrive className="h-3.5 w-3.5" />
            Cache size
          </span>
          <span className="text-xs font-medium">{fmtBytes(cacheSize)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClearCache}
          disabled={clearing}
          className="hover:border-red-300 hover:text-red-600"
          icon={Trash2}
        >
          {clearing ? 'Clearing…' : 'Clear cache'}
        </Button>

        {updateAvailable && (
          <Button size="sm" onClick={applyUpdate} icon={RefreshCw}>
            Update now
          </Button>
        )}

        {!installed && deferredPrompt && (
          <Button size="sm" onClick={installApp} icon={Download}>
            Install app
          </Button>
        )}

        {/* Without a captured prompt, installApp() is a no-op — so show a
            disabled button plus the real steps instead of a dead control. */}
        {!installed && !deferredPrompt && (
          <div className="w-full space-y-2">
            <span title="This browser doesn't offer a one-click install">
              <Button size="sm" icon={Download} disabled>
                Install app
              </Button>
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {installSteps.supported
                ? `To install here: ${installSteps.steps.join(', then ')}.`
                : installSteps.steps.join('. ') + '.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user, login, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const pwForm = useForm();
  const profileForm = useForm();
  const [me, setMe] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getMe()
      .then((res) => {
        setMe(res.data);
        profileForm.reset({
          name: res.data.name || '',
          bio: res.data.bio || '',
          linkedin: res.data.linkedin || '',
          github: res.data.github || '',
        });
      })
      // Without this the profile form sits blank and a save would wipe the
      // user's real name and bio with empty strings.
      .catch(() => toast.error('Could not load your profile — reload to try again'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveProfile = async (data) => {
    try {
      const res = await updateProfile(data);
      setMe(res.data.user);
      // Fresh token keeps the navbar name in sync.
      if (res.data.token) login(res.data.token);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    setAvatarUploading(true);
    try {
      const res = await uploadAvatar(fd);
      setMe((prev) => ({ ...prev, avatarUrl: res.data.avatarUrl }));
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(me.referralCode);
    toast.success('Referral code copied');
  };

  const onChangePassword = async (data) => {
    try {
      const res = await changePassword(data);
      // Changing the password revokes every token issued before it — including
      // this tab's. The server hands back a replacement so the session that
      // made the change survives while all the others are evicted; without
      // adopting it here, the next request 401s and logs the user out.
      if (res.data?.token) login(res.data.token);
      toast.success('Password updated — other devices have been signed out');
      pwForm.reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    }
  };

  const onDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success('Account deleted');
      logout();
      navigate('/register');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">Settings</h1>
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        {user?.name} · {user?.email}
      </p>

      <div className="space-y-4">
        <Card title="Appearance" icon={dark ? Moon : Sun}>
          <button
            onClick={toggle}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Switch to {dark ? 'light' : 'dark'} mode
          </button>
        </Card>

        <AppSection />

        <Card title="Profile" icon={UserRound}>
          {/* Avatar picker */}
          <div className="mb-4 flex items-center gap-4">
            <label className="group relative cursor-pointer">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/40">
                {me?.avatarUrl ? (
                  <img src={me.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {(me?.name || user?.name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  {avatarUploading
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <Camera className="h-5 w-5 text-white" />
                  }
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onAvatarChange}
                disabled={avatarUploading}
              />
            </label>
            <div>
              <p className="text-sm font-medium">{me?.name || user?.name}</p>
              <p className="text-xs text-gray-400">Click photo to change</p>
            </div>
          </div>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-3">
            <input
              placeholder="Name"
              aria-label="Name"
              {...profileForm.register('name', { required: true })}
              className="input"
            />
            <textarea
              rows={2}
              placeholder="Short bio (max 300 chars)"
              aria-label="Bio"
              maxLength={300}
              {...profileForm.register('bio')}
              className="input"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="LinkedIn URL"
                aria-label="LinkedIn URL"
                {...profileForm.register('linkedin')}
                className="input"
              />
              <input
                placeholder="GitHub URL"
                aria-label="GitHub URL"
                {...profileForm.register('github')}
                className="input"
              />
            </div>
            <Button
              type="submit"
              size="md"
              disabled={profileForm.formState.isSubmitting}
            >
              {profileForm.formState.isSubmitting ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Card>

        <SubscriptionCard />

        {/* Dax brings its own Card chrome so it can render its own empty and
            loading states while the memory loads. */}
        <DaxProfilePanel />

        <Card title="Referral code" icon={Gift}>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
            Your personal one-time invite: exactly <strong>one</strong> batchmate can register
            with this code and skip the admin approval queue.
          </p>
          {me?.referralCode ? (
            me.referralUsedBy ? (
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm font-bold tracking-wider text-gray-400 line-through dark:bg-gray-800">
                  {me.referralCode}
                </code>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Used — your invite brought someone in 🎉
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-indigo-50 px-4 py-2 font-mono text-sm font-bold tracking-wider text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {me.referralCode}
                </code>
                <button
                  onClick={copyReferral}
                  aria-label="Copy referral code"
                  className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={whatsappInviteUrl(me.referralCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            )
          ) : (
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          )}
        </Card>

        <DevicesCard />

        <Card title="Change password" icon={KeyRound}>
          <form onSubmit={pwForm.handleSubmit(onChangePassword)} className="space-y-3">
            <input
              type="password"
              placeholder="Current password"
              aria-label="Current password"
              {...pwForm.register('currentPassword', { required: true })}
              className="input"
            />
            <input
              type="password"
              placeholder="New password (8+ chars, letter & number)"
              aria-label="New password"
              {...pwForm.register('newPassword', { required: true, minLength: 8 })}
              className="input"
            />
            <Button
              type="submit"
              size="md"
              disabled={pwForm.formState.isSubmitting}
            >
              {pwForm.formState.isSubmitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </Card>

        <Card title="Delete account" icon={ShieldAlert} danger>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
            This permanently deletes your account and everything you&rsquo;ve created — notes,
            photos, tasks, finances and resume. This cannot be undone.
          </p>
          <button
            onClick={() => {
              setDeletePassword('');
              setDeleteOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" /> Delete my account
          </button>
        </Card>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter your password to confirm. This will erase all your data immediately and
            cannot be undone.
          </p>
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Your password"
            aria-label="Confirm password"
            className="input"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={onDeleteAccount}
              disabled={deleting || !deletePassword}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Permanently delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
