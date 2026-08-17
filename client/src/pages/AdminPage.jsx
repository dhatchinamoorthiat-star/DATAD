import { useEffect, useRef, useState } from 'react';
import toast from '../utils/toast';
import { Link } from 'react-router-dom';
import {
  BookLock,
  BookOpen,
  Camera,
  CalendarDays,
  Crown,
  CreditCard,
  Megaphone,
  Users,
  Clapperboard,
  ScrollText,
  Gift,
  Briefcase,
  BrainCircuit,
  Bot,
  ChevronRight,
  Cpu,
  Activity,
  DollarSign,
  Clock,
  Sparkles,
} from 'lucide-react';
import { getStats } from '../api/admin';
import { getMeta, updateMeta } from '../api/meta';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/common/Loader';
import DateInput from '../components/common/DateInput';
import { AnimatedNumber, Stagger, StaggerItem } from '../components/common/motion';

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="card-hover rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Icon className="h-4 w-4 text-indigo-500" /> {label}
      </div>
      <AnimatedNumber value={value} className="mt-1 block text-2xl font-bold tabular-nums" />
    </div>
  );
}

function NavCard({ to, icon: Icon, title, description, badge }) {
  return (
    <Link
      to={to}
      className="card-hover group flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900"
    >
      <div className="rounded-xl bg-indigo-100 p-3 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          {title}
          {badge > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {badge}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-gray-600" />
    </Link>
  );
}

function PlacementDateForm() {
  const [form, setForm] = useState({ placementDate: '', batchName: '' });
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    getMeta().then((res) => {
      setForm({
        placementDate: res.data.placementDate ? res.data.placementDate.slice(0, 10) : '',
        batchName: res.data.batchName || '',
      });
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMeta(form);
      toast.success('Placement date saved');
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="mb-6 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-5 dark:border-indigo-800/60 dark:bg-indigo-900/20">
      <p className="mb-3 text-sm font-semibold">Placement season settings</p>
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="admin-placement-date" className="mb-1 block text-xs text-gray-500">Placement date</label>
          <DateInput id="admin-placement-date"
            value={form.placementDate}
            onChange={(e) => setForm((f) => ({ ...f, placementDate: e.target.value }))}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="admin-batch-name" className="mb-1 block text-xs text-gray-500">Batch name (optional)</label>
          <input id="admin-batch-name"
            type="text"
            maxLength={100}
            placeholder="e.g. Batch 2024–26"
            value={form.batchName}
            onChange={(e) => setForm((f) => ({ ...f, batchName: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="flex items-end">
          <button
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getStats().then((res) => {
      setStats(res.data);
      setPending(res.data.pendingApprovals ?? 0);
    });
  }, []);

  if (!stats) return <Loader />;

  const sections = [
    {
      to: '/admin/studio',
      icon: Sparkles,
      title: 'Content Studio',
      description: 'Upload anything — Dax files it in the right module',
    },
    {
      to: '/admin/students',
      icon: Users,
      title: 'Students & approvals',
      description: pending
        ? `${pending} signup${pending === 1 ? '' : 's'} waiting for review`
        : 'Member register — everyone approved',
      badge: pending,
    },
    {
      to: '/admin/announcements',
      icon: Megaphone,
      title: 'Announcements',
      description: 'Post to the dashboard, optionally email the batch',
    },
    {
      to: '/admin/logs',
      icon: ScrollText,
      title: 'Activity log',
      description: 'Registrations, approvals, resets — everything, timestamped',
    },
    {
      to: '/admin/referrals',
      icon: Gift,
      title: 'Referral network',
      description: 'Who invited whom, and every code’s status',
    },
    {
      to: '/admin/companies',
      icon: Briefcase,
      title: 'Company prep cards',
      description: 'Publish recruiter pages — process, questions, salaries',
    },
    {
      to: '/admin/cases',
      icon: BrainCircuit,
      title: 'Daily Cases',
      description: 'Publish the daily case that anchors the morning habit',
    },
    {
      to: '/admin/archive',
      icon: Clapperboard,
      title: 'Nostalgia Archive',
      description: 'Publish and manage entertainment content',
    },
    {
      to: '/admin/automation',
      icon: Bot,
      title: 'Dax Automation',
      description: 'Monitor and trigger Dax content generation jobs',
    },
    {
      to: '/admin/ai-center',
      icon: Bot,
      title: 'Dax Center',
      description: 'Live Dax usage, cost tracking and scheduler health',
    },
    {
      to: '/admin/ai-runtime',
      icon: Cpu,
      title: 'AI Runtime',
      description: 'Live AI observability, provider health, model registry',
    },
    {
      to: '/admin/cohort',
      icon: Users,
      title: 'Cohort Intel',
      description: 'Aggregate readiness, strengths, and gaps across students',
    },
    {
      to: '/admin/subscriptions',
      icon: CreditCard,
      title: 'Subscriptions',
      description: 'Review payment requests and manage user tiers',
      badge: stats?.pendingSubscriptions ?? 0,
    },
    {
      to: '/me/journal',
      icon: BookLock,
      title: 'Journal',
      description: 'Your private diary — visible only to you',
    },
  ];

  return (
    <div className="animate-in mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold">
        <Crown className="h-5 w-5 text-amber-500" /> Admin Console
      </h1>
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        Welcome back, {user?.name?.split(' ')[0]} — here&rsquo;s your platform at a glance.
      </p>

      {/* Primary stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Users} label="Total students" value={stats.students} />
        <StatTile icon={BookOpen} label="Notes" value={stats.notes} />
        <StatTile icon={Camera} label="Photos" value={stats.photos} />
        <StatTile icon={CalendarDays} label="Tasks" value={stats.tasks} />
      </div>

      {/* Operational stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
          <div className="fc items-center gap-2 text-xs text-gray-400">
            <Activity className="h-4 w-4 text-emerald-500" /> Active (7d)
          </div>
          <AnimatedNumber value={stats.activeUsers ?? 0} className="mt-1 block text-2xl font-bold tabular-nums" />
        </div>
        <div className={`rounded-2xl border p-4 ${(stats.pendingApprovals ?? 0) > 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20' : 'border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900'}`}>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className={`h-4 w-4 ${(stats.pendingApprovals ?? 0) > 0 ? 'text-amber-500' : 'text-gray-400'}`} /> Pending approvals
          </div>
          <AnimatedNumber value={stats.pendingApprovals ?? 0} className={`mt-1 block text-2xl font-bold tabular-nums ${(stats.pendingApprovals ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`} />
        </div>
        <div className={`rounded-2xl border p-4 ${(stats.pendingSubscriptions ?? 0) > 0 ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700/60 dark:bg-indigo-900/20' : 'border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900'}`}>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CreditCard className={`h-4 w-4 ${(stats.pendingSubscriptions ?? 0) > 0 ? 'text-indigo-500' : 'text-gray-400'}`} /> Pending payments
          </div>
          <AnimatedNumber value={stats.pendingSubscriptions ?? 0} className={`mt-1 block text-2xl font-bold tabular-nums ${(stats.pendingSubscriptions ?? 0) > 0 ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <DollarSign className="h-4 w-4 text-purple-500" /> Dax cost (30d)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">${stats.aiCost30d ?? '0.00'}</p>
          {stats.aiJobCount30d > 0 && (
            <p className="mt-0.5 text-xs text-gray-400">{stats.aiJobCount30d} jobs run</p>
          )}
        </div>
      </div>

      <PlacementDateForm />

      <Stagger className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <StaggerItem key={s.to}>
            <NavCard {...s} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}