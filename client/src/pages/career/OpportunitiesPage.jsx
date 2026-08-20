import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Milestone, Briefcase, GraduationCap, Calendar, ArrowRight, Clock, Plus, ChevronRight } from 'lucide-react';
import { listDrives } from '../../api/placements';
import { listInternships } from '../../api/internships';
import { Page } from '../../components/common/motion';
import { FeedSkeleton } from '../../components/common/Skeleton';
import useDocumentTitle from '../../hooks/useDocumentTitle';

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  return diff;
}

function urgencyColor(days) {
  if (days === null) return 'text-gray-400';
  if (days < 0) return 'text-gray-400 line-through';
  if (days <= 3) return 'text-red-500';
  if (days <= 7) return 'text-amber-500';
  return 'text-gray-500';
}

function MilestoneCard({ icon: Icon, title, subtitle, date, days, badge, badgeColor, href, extra }) {
  const card = (
    <div className="flex items-start gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 hover:shadow-md hover:border-indigo-200 transition-all dark:border-gray-800/80 dark:bg-gray-900 dark:hover:border-indigo-800/60 group">
      <div className="shrink-0 rounded-xl bg-indigo-50 p-2.5 dark:bg-indigo-950/40">
        <Icon className="h-5 w-5 text-indigo-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</p>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>{badge}</span>}
        </div>
        {(date || extra) && (
          <div className="mt-2 flex items-center gap-3">
            {date && (
              <span className={`flex items-center gap-1 text-xs ${urgencyColor(days)}`}>
                <Calendar className="h-3 w-3" />
                {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {days !== null && days >= 0 && ` · ${days}d left`}
              </span>
            )}
            {extra && <span className="text-xs text-gray-400">{extra}</span>}
          </div>
        )}
      </div>
      {href && <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 shrink-0 mt-0.5 transition-colors" />}
    </div>
  );

  return href ? <Link to={href}>{card}</Link> : card;
}

export default function OpportunitiesPage() {
  useDocumentTitle('Opportunities');
  const [drives, setDrives] = useState(null);
  const [internships, setInternships] = useState(null);

  useEffect(() => {
    Promise.allSettled([listDrives(), listInternships()])
      .then(([d, i]) => {
        setDrives(d.status === 'fulfilled' ? d.value.data : []);
        setInternships(i.status === 'fulfilled' ? i.value.data : []);
      })
      // allSettled never rejects, but an unexpected payload shape throwing in
      // the callback above would otherwise pin the page on its skeleton.
      .catch(() => {
        setDrives([]);
        setInternships([]);
      });
  }, []);

  const loading = drives === null || internships === null;

  // Upcoming drives (not closed, sorted by deadline)
  const upcomingDrives = (drives || [])
    .filter((d) => d.status !== 'closed')
    .sort((a, b) => new Date(a.applicationDeadline || 0) - new Date(b.applicationDeadline || 0));

  // Upcoming internships
  const upcomingInternships = (internships || [])
    .filter((i) => i.status !== 'closed')
    .sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));

  return (
    <Page className="space-y-6" overview={{
      pageKey: 'career-opportunities',
      title: 'Open roles and internships',
      blurb: 'Placements, internships and off-campus openings shared for your batch, with deadlines attached.',
      takeaway: 'Sort by deadline and apply to the ones closing this week first.',
    }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Milestone className="h-5 w-5 text-indigo-500" /> Upcoming Milestones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Placement drives and internships coming up — never miss a deadline.
          </p>
        </div>
      </div>

      {loading ? (
        <FeedSkeleton count={5} />
      ) : (
        <>
          {/* Placement drives */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <Briefcase className="h-4 w-4 text-indigo-500" /> Placement Drives
              </h2>
              <Link to="/career/placements" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {upcomingDrives.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-sm text-gray-400">No upcoming drives yet</p>
                <Link to="/career/placements" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  <Plus className="h-3 w-3" /> Add a drive
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingDrives.slice(0, 5).map((d) => {
                  const days = daysLeft(d.applicationDeadline);
                  const badge = d.status === 'active' ? 'Active' : 'Upcoming';
                  const badgeColor = d.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
                  return (
                    <MilestoneCard key={d._id}
                      icon={Briefcase}
                      title={d.company}
                      subtitle={d.role ? `${d.role}${d.package ? ` · ${d.package}` : ''}` : d.name}
                      date={d.applicationDeadline}
                      days={days}
                      badge={badge}
                      badgeColor={badgeColor}
                      href="/career/placements"
                    />
                  );
                })}
                {upcomingDrives.length > 5 && (
                  <Link to="/career/placements" className="flex items-center gap-1 justify-center py-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    View {upcomingDrives.length - 5} more drives <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Internships */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <GraduationCap className="h-4 w-4 text-purple-500" /> Internships
              </h2>
              <Link to="/career/internships" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {upcomingInternships.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-sm text-gray-400">No upcoming internships yet</p>
                <Link to="/career/internships" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  <Plus className="h-3 w-3" /> Add an internship
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingInternships.slice(0, 5).map((i) => {
                  const days = daysLeft(i.deadline);
                  return (
                    <MilestoneCard key={i._id}
                      icon={GraduationCap}
                      title={i.company || i.title}
                      subtitle={i.role || i.description?.slice(0, 60)}
                      date={i.deadline}
                      days={days}
                      badge={i.type || 'Internship'}
                      badgeColor="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      href="/career/internships"
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Calendar tip */}
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 dark:border-amber-800/40 dark:bg-amber-950/20 flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Tip:</strong> Add critical deadlines to your Planner so you get daily reminders.
              {' '}<Link to="/me/planner" className="underline font-medium">Open Planner →</Link>
            </p>
          </div>
        </>
      )}
    </Page>
  );
}
