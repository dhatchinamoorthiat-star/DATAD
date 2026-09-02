import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, Briefcase, FileText, Link2, Building2, MessageSquareQuote,
  Newspaper, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { listTasks } from '../../api/tasks';
import { getTodayCase } from '../../api/dailyCase';
import { listInternships } from '../../api/internships';
import { getRoadmapProgress } from '../../api/pivot';
import { dashboardInsights } from '../../api/dax';
import { daysUntil } from '../../utils/dateUtils';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { track } from '../../utils/analytics';
import { Page } from '../common/motion';
import { Skeleton } from '../common/Skeleton';
import Card from '../common/Card';
import TodayFocus from '../dashboard/TodayFocus';
import ReadinessCard from '../common/ReadinessCard';
import TierGate from '../common/TierGate';
import { FEATURE } from '../../utils/planFeatures';
import PlacementCountdown from '../career/PlacementCountdown';

/**
 * The dashboard a placement-mode student sees.
 *
 * LivingSurface — the admin dashboard — assembles the whole product: notes,
 * finance, community, usage, the programme header. That is the breadth oral
 * testing found overwhelming, and most of it links to sections a student's app
 * no longer has. This is the same idea narrowed to one question: what moves you
 * closer to a placement today?
 *
 * Five things, in the order they matter: where you stand, what is due, what is
 * open, where to go next, what changed in the market. Nothing that needs a
 * second screen to explain itself.
 */

const DEFAULT_BRIEF = "Let's see what today looks like.";

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

// The five destinations that are not already one tap away in the rail's top
// half. Deliberately a short row: a grid of twelve is the thing this dashboard
// exists to avoid.
const QUICK_ACTIONS = [
  { icon: FileText, label: 'Resume', to: '/placement/resume', hint: 'Build & review' },
  { icon: Link2, label: 'LinkedIn', to: '/placement/linkedin', hint: 'Polish your profile' },
  { icon: Building2, label: 'Companies', to: '/placement/companies', hint: 'Research targets' },
  { icon: MessageSquareQuote, label: 'Interview Qs', to: '/placement/questions', hint: 'Practise rounds' },
];

function Arrival({ firstName, brief, loading }) {
  return (
    <section>
      <p className="text-sm text-gray-500 dark:text-gray-400">{greeting()}, {firstName}</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Your placement, today
      </h1>
      {loading ? (
        <Skeleton className="mt-3 h-4 w-2/3" />
      ) : (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">{brief}</p>
      )}
    </section>
  );
}

function Opportunities({ internships, loading }) {
  if (!loading && internships.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Open right now</h2>
        <Link to="/placement/opportunities" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
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

function QuickActions() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Pick up where you left off</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.to} to={a.to}>
            <Card padding="md" hoverable className="flex h-full flex-col gap-2">
              <a.icon className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{a.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{a.hint}</span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Briefing() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Before an interview</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/briefing">
          <Card padding="md" hoverable className="flex h-full flex-col gap-2">
            <Newspaper className="h-4 w-4 text-primary-500" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Today&rsquo;s briefing</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Business news and market moves worth quoting in a room.</p>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
              Read now <ArrowUpRight className="h-3 w-3" />
            </span>
          </Card>
        </Link>
        <Link to="/dax?home">
          <Card padding="md" hoverable className="flex h-full flex-col gap-2">
            <Sparkles className="h-4 w-4 text-warn-500" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Ask Dax</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Mock a round, tighten a bullet, or prep a company in minutes.</p>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
              Start <ArrowUpRight className="h-3 w-3" />
            </span>
          </Card>
        </Link>
      </div>
    </section>
  );
}

export default function PlacementSurface() {
  useDocumentTitle('Dashboard');
  useEffect(() => { track('dashboard_viewed'); }, []);
  const { user } = useAuth();

  // Same reasoning as the admin dashboard: the insights call is Pro-only, so
  // asking for it on a free account is a guaranteed 403. The capability map,
  // not the tier claim in the JWT, decides — a student who upgrades mid-session
  // should not have to sign in again to see what they just paid for.
  const { hasFeature, loaded: plansLoaded } = useSubscription();
  const canSeeInsights = hasFeature('dashboard_insights');

  const [tasks, setTasks] = useState([]);
  const [caseData, setCaseData] = useState(null);
  const [internships, setInternships] = useState([]);
  const [internshipsLoading, setInternshipsLoading] = useState(true);
  const [roadmapProgress, setRoadmapProgress] = useState(null);
  const [brief, setBrief] = useState('');
  const [briefPending, setBriefPending] = useState(true);

  useEffect(() => {
    listTasks().then((res) => setTasks(res.data?.data || res.data || [])).catch(() => {});
    getTodayCase().then((res) => setCaseData(res.data)).catch(() => {});
    getRoadmapProgress().then((res) => setRoadmapProgress(res.data)).catch(() => {});
    listInternships({ limit: 3 })
      .then((res) => setInternships(res.data?.data || res.data || []))
      .catch(() => {})
      .finally(() => setInternshipsLoading(false));
  }, []);

  useEffect(() => {
    if (!plansLoaded || !canSeeInsights) return;
    dashboardInsights()
      .then((res) => {
        const d = res.data || {};
        setBrief(d.nextBestAction || d.overallAssessment || DEFAULT_BRIEF);
      })
      .catch(() => setBrief(DEFAULT_BRIEF))
      .finally(() => setBriefPending(false));
  }, [plansLoaded, canSeeInsights]);

  // The tile is settled once the plan says the call will never be made — it
  // just settles on the free-tier line rather than on a result.
  const briefLoading = briefPending && (!plansLoaded || canSeeInsights);
  const briefText = brief || (plansLoaded && !canSeeInsights ? DEFAULT_BRIEF : '');

  const roadmapTotal = roadmapProgress?.total || 0;
  const roadmapDone = roadmapProgress?.completed || 0;
  const roadmapPending = roadmapProgress?.hasRoadmap ? roadmapTotal - roadmapDone : 0;

  const todayFocusData = useMemo(() => ({
    today: tasks.filter((t) => t.status !== 'done' && t.dueDate && daysUntil(t.dueDate) === 0),
    earlier: tasks.filter((t) => t.status !== 'done' && t.dueDate && daysUntil(t.dueDate) < 0),
    streak: caseData?.streak || 0,
    caseSolved: caseData?.solved || false,
    caseTitle: caseData?.case?.title || null,
    roadmapPending,
    roadmapNext: roadmapProgress?.items?.find((g) => g.status !== 'done')?.skill || null,
    canCreateRoadmap: roadmapProgress !== null && !roadmapProgress?.hasRoadmap,
  }), [tasks, caseData, roadmapPending, roadmapProgress]);

  return (
    <Page wide overview={{
      pageKey: 'dashboard',
      title: 'Your placement, today',
      blurb: 'Where you stand, what is due, and what is open — the placement picture in one screen.',
      takeaway: 'Work top-down: readiness first, then whatever is due today.',
    }}>
      <div className="space-y-10 pb-16">
        <Arrival firstName={user?.name?.split(' ')[0] || 'there'} brief={briefText} loading={briefLoading} />
        <PlacementCountdown />
        <TodayFocus data={todayFocusData} />
        {/* ReadinessCard renders nothing without a score, and a free account
            never gets one — the readiness call is Placement Pass-only. Left
            bare, the section a student most wants ("where do I stand?") was
            simply absent. The gate puts the offer in that space instead, the
            same way the placement hub does. */}
        <section>
          <TierGate
            feature={FEATURE.READINESS_SCORE}
            description="See where you stand — one score built from your resume, your target companies and the prep you have actually done."
          >
            <ReadinessCard />
          </TierGate>
        </section>
        <Opportunities internships={internships} loading={internshipsLoading} />
        <QuickActions />
        <Briefing />
      </div>
    </Page>
  );
}
