import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Sparkles, Send, Loader2, FileText, Wallet,
  CalendarDays, BookOpen, Briefcase, Newspaper, Flame, GraduationCap, Bot,
  Map,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getReadiness } from '../../api/experience';
import { listTasks } from '../../api/tasks';
import { listNotes } from '../../api/notes';
import { getTodayReflection } from '../../api/reflection';
import { getTodayCase } from '../../api/dailyCase';
import { getMyResume } from '../../api/resume';
import { listInternships } from '../../api/internships';
import { daxChat, dashboardInsights } from '../../api/dax';
import { getRoadmapProgress } from '../../api/pivot';
import { daysUntil, formatDate } from '../../utils/dateUtils';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { track } from '../../utils/analytics';
import { Page } from '../common/motion';
import { Skeleton } from '../common/Skeleton';
import Card from '../common/Card';
import Button from '../common/Button';
import UsageSummary from '../dashboard/UsageSummary';
import TodayFocus from '../dashboard/TodayFocus';
import { ProgramHeader } from '../program/ProgramHeader';

// ── 1. Arrival — a personalised morning briefing, not a chat window ────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Arrival({ firstName, brief, briefLoading }) {
  return (
    <div className="py-10 sm:py-14">
      <p className="text-sm font-medium text-gray-400">
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
        {greeting()}, {firstName}.
      </h1>
      <div className="mt-4 max-w-2xl">
        {briefLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        ) : (
          <p className="flex items-start gap-2 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            <Sparkles className="mt-1.5 h-4 w-4 shrink-0 text-primary-500" />
            <span>{brief}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── 2. Today's Focus ────────────────────────────────────────────────────────

function TodaysFocus({ tasks, loading }) {
  const upcoming = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status !== 'done')
        .sort((a, b) => new Date(a.dueDate || 8640000000000000) - new Date(b.dueDate || 8640000000000000))
        .slice(0, 5),
    [tasks]
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Today's focus</h2>
        <Link to="/me/planner" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
          Open planner
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : upcoming.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nothing due — a clear runway. Good day to get ahead.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map((t) => {
            const d = t.dueDate ? daysUntil(t.dueDate) : null;
            const overdue = d != null && d < 0;
            const dueToday = d === 0;
            return (
              <Card key={t._id} padding="sm" className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{t.title}</p>
                  {t.type && <p className="text-xs capitalize text-gray-400">{t.type}</p>}
                </div>
                {t.dueDate && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      overdue
                        ? 'bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300'
                        : dueToday
                        ? 'bg-warn-50 text-warn-800 dark:bg-warn-950/40 dark:text-warn-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {overdue ? 'Overdue' : dueToday ? 'Today' : formatDate(t.dueDate)}
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── 3. Student Snapshot — motivating, not analytical ────────────────────────

function SnapshotTile({ icon: Icon, label, value, suffix, tone }) {
  const TONE = {
    primary: 'text-primary-500',
    success: 'text-success-500',
    warn: 'text-warn-600',
    danger: 'text-danger-500',
  };
  return (
    <Card padding="md" className="flex flex-col gap-2">
      <Icon className={`h-4 w-4 ${TONE[tone] || TONE.primary}`} />
      <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-50">
        {value}
        {suffix && <span className="ml-0.5 text-base font-medium text-gray-400">{suffix}</span>}
      </p>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
    </Card>
  );
}

function StudentSnapshot({ readiness, tasks, resume, streak, loading }) {
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    return total ? Math.round((done / total) * 100) : null;
  }, [tasks]);

  const resumeStrength = useMemo(() => {
    if (!resume) return null;
    const sections = [
      resume.summary,
      resume.education?.length > 0,
      resume.experience?.length > 0,
      resume.skills?.length > 0,
      resume.projects?.length > 0,
    ];
    return Math.round((sections.filter(Boolean).length / sections.length) * 100);
  }, [resume]);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Your snapshot</h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SnapshotTile icon={GraduationCap} label="Career readiness" value={readiness ?? '—'} suffix={readiness != null ? '/100' : ''} tone="primary" />
          <SnapshotTile icon={CalendarDays} label="Tasks completed" value={taskStats ?? '—'} suffix={taskStats != null ? '%' : ''} tone="success" />
          <SnapshotTile icon={FileText} label="Resume strength" value={resumeStrength ?? '—'} suffix={resumeStrength != null ? '%' : ''} tone="warn" />
          <SnapshotTile icon={Flame} label="Study streak" value={streak ?? 0} suffix={streak === 1 ? ' day' : ' days'} tone="danger" />
        </div>
      )}
    </section>
  );
}


// ── 5. Ask Dax — a spotlight-style input, not a chat window ────────────────

const ASK_SUGGESTIONS = [
  'Plan my week',
  'Summarize my notes',
  'Generate quiz questions',
  'Improve my resume',
  'Find internships',
];

function AskDax() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const ask = async (text) => {
    const q = (text ?? message).trim();
    if (!q || loading) return;
    setLoading(true);
    setReply(null);
    try {
      const res = await daxChat(q);
      setReply(res.data?.reply || res.data?.message || res.data?.result || 'Done.');
    } catch {
      setReply("I couldn't reach that just now — try again in a moment.");
    } finally {
      setLoading(false);
      setMessage('');
    }
  };

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Ask Dax</h2>
      <Card padding="md">
        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-primary-400 dark:border-gray-800 dark:bg-gray-950"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-primary-500" />
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything — plan my week, summarize my notes…"
            className="flex-1 border-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-white transition-opacity disabled:opacity-30"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </form>

        {(loading || reply) && (
          <div className="mt-3 rounded-xl bg-primary-50 p-4 text-sm leading-relaxed text-gray-700 dark:bg-primary-950/20 dark:text-gray-200">
            {loading ? <span className="text-gray-400">Dax is thinking…</span> : reply}
          </div>
        )}

        {!reply && !loading && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ASK_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-primary-300 hover:text-primary-600 dark:border-gray-800 dark:text-gray-400 dark:hover:border-primary-700 dark:hover:text-primary-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

// ── 6. Continue Working — quick links back into real work ──────────────────

function ContinueWorking({ latestNote }) {
  const LINKS = [
    { icon: Bot, label: 'Dax AI', to: '/dax' },
    { icon: BookOpen, label: 'Notes', to: '/study/notes' },
    { icon: CalendarDays, label: 'Planner', to: '/me/planner' },
    { icon: FileText, label: 'Resume', to: '/career/resume' },
    { icon: Wallet, label: 'Finance', to: '/finance' },
  ];
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Continue working</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card padding="md" hoverable className="flex h-full flex-col gap-2">
              <l.icon className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{l.label}</span>
            </Card>
          </Link>
        ))}
      </div>
      {latestNote && (
        <Link to={`/study/notes/${latestNote._id}`}>
          <Card padding="md" hoverable className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pick up where you left off</p>
            <p className="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{latestNote.title}</p>
          </Card>
        </Link>
      )}
    </section>
  );
}

// ── 7. Opportunities — personalised, real listings ──────────────────────────

function Opportunities({ internships, loading }) {
  if (!loading && internships.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Opportunities for you</h2>
        <Link to="/career/opportunities" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
          See all
        </Link>
      </div>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {internships.slice(0, 3).map((i) => (
            <a key={i._id} href={i.applyLink} target="_blank" rel="noreferrer">
              <Card padding="md" hoverable className="flex h-full flex-col gap-1">
                <Briefcase className="h-4 w-4 text-primary-500" />
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{i.title}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{i.company}</p>
              </Card>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 8. Discover — the day's concept, and where to explore ──────────────────

function Discover({ reflection }) {
  const concept = reflection?.dailyConcept;
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Discover</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/briefing">
          <Card padding="md" hoverable className="flex h-full flex-col gap-2">
            <Newspaper className="h-4 w-4 text-primary-500" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Today's briefing</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">News and concepts picked for your interests.</p>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
              Read now <ArrowUpRight className="h-3 w-3" />
            </span>
          </Card>
        </Link>
        {concept?.concept ? (
          <Card padding="md" className="flex h-full flex-col gap-2">
            <Sparkles className="h-4 w-4 text-warn-500" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{concept.concept}</p>
            {concept.whyToday && <p className="text-xs text-gray-500 dark:text-gray-400">{concept.whyToday}</p>}
          </Card>
        ) : (
          <Card padding="md" className="flex h-full flex-col justify-center gap-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Your daily concept will appear here once it's ready.</p>
          </Card>
        )}
      </div>
    </section>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────

export default function LivingSurface() {
  useDocumentTitle('Dashboard');
  useEffect(() => { track('dashboard_viewed'); }, []);
  const { user } = useAuth();

  const [readiness, setReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [reflection, setReflection] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [resume, setResume] = useState(null);
  const [internships, setInternships] = useState([]);
  const [internshipsLoading, setInternshipsLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [briefLoading, setBriefLoading] = useState(true);
  const [roadmapProgress, setRoadmapProgress] = useState(null);

  useEffect(() => {
    getReadiness()
      .then((res) => setReadiness(typeof res.data === 'object' ? res.data?.score : res.data))
      .catch(() => {})
      .finally(() => setReadinessLoading(false));

    listTasks()
      .then((res) => setTasks(res.data?.data || res.data || []))
      .catch(() => {})
      .finally(() => setTasksLoading(false));

    listNotes({ limit: 1 }).then((res) => setNotes(res.data?.data || res.data || [])).catch(() => {});
    getTodayReflection().then((res) => setReflection(res.data)).catch(() => {});
    getTodayCase().then((res) => setCaseData(res.data)).catch(() => {});
    getMyResume().then((res) => setResume(res.data?.data || res.data)).catch(() => {});

    listInternships({ limit: 3 })
      .then((res) => setInternships(res.data?.data || res.data || []))
      .catch(() => {})
      .finally(() => setInternshipsLoading(false));

    dashboardInsights()
      .then((res) => {
        const d = res.data || {};
        setBrief(d.nextBestAction || d.overallAssessment || "Let's see what today looks like.");
      })
      .catch(() => setBrief("Let's see what today looks like."))
      .finally(() => setBriefLoading(false));

    getRoadmapProgress()
      .then((res) => setRoadmapProgress(res.data))
      .catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const streak = caseData?.streak || 0;

  // Roadmap props for TodayFocus
  const roadmapTotal = roadmapProgress?.total || 0;
  const roadmapDone = roadmapProgress?.completed || 0;
  const roadmapPending = roadmapProgress?.hasRoadmap ? roadmapTotal - roadmapDone : 0;
  const roadmapNext = roadmapProgress?.items?.find((g) => g.status !== 'done')?.skill || null;
  const canCreateRoadmap = roadmapProgress !== null && !roadmapProgress?.hasRoadmap;

  const todayFocusData = useMemo(() => ({
    today: tasks.filter((t) => t.status !== 'done' && t.dueDate && daysUntil(t.dueDate) === 0),
    earlier: tasks.filter((t) => t.status !== 'done' && t.dueDate && daysUntil(t.dueDate) < 0),
    streak: caseData?.streak || 0,
    caseSolved: caseData?.solved || false,
    caseTitle: caseData?.case?.title || null,
    roadmapPending,
    roadmapNext,
    canCreateRoadmap,
  }), [tasks, caseData, roadmapPending, roadmapNext, canCreateRoadmap]);

  return (
    <Page wide>
      {/* The measure comes from <Page wide> — an inner max-w here would just
          fight it (the old max-w-4xl was already dead under the 3xl cap). */}
      <div className="space-y-12 pb-16">
        {/* ⭐ Program Header */}
        <ProgramHeader />
        <Arrival firstName={firstName} brief={brief} briefLoading={briefLoading} />
        <UsageSummary />

        {/* Today's Focus — from the rich rules engine */}
        <TodayFocus data={todayFocusData} />

        {/* Onboarding card — invite to create a roadmap */}
        {canCreateRoadmap && (
          <Link to="/roadmap" className="group block">
            <div className="flex items-start gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-indigo-900/30 dark:from-indigo-950/30 dark:to-gray-900">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                <Map className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  Build your skill roadmap
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Set a target role and get a 3-month plan of courses, projects, and resources to get there.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-indigo-400 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        )}

        <TodaysFocus tasks={tasks} loading={tasksLoading} />
        <StudentSnapshot readiness={readiness} tasks={tasks} resume={resume} streak={streak} loading={readinessLoading || tasksLoading} />
        <AskDax />
        <ContinueWorking latestNote={notes?.[0]} />
        <Opportunities internships={internships} loading={internshipsLoading} />
        <Discover reflection={reflection} />
      </div>
    </Page>
  );
}
