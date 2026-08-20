import { Megaphone, Pin } from 'lucide-react';
import { listAnnouncements } from '../../api/admin';
import { formatDate } from '../../utils/dateUtils';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { Page } from '../../components/common/motion';
import useAsync from '../../hooks/useAsync';

export default function AnnouncementsPage() {
  const { data: announcements, error, loading, reload } = useAsync(() => listAnnouncements(), []);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-6"><FeedSkeleton count={5} /></div>;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <ErrorState title="Could not load announcements" onRetry={reload} />
      </div>
    );
  }

  return (
    <Page overview={{
      pageKey: 'community-announcements',
      title: 'Official batch updates',
      blurb: 'Admin announcements, pinned and dated, so nothing important gets buried in chat.',
      takeaway: "Check pinned items first — they're usually time-sensitive.",
    }}>
      <h1 className="mb-4 text-xl font-bold">Announcements</h1>
      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" subtitle="Batch updates from the admin will appear here." />
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div
              key={a._id}
              className={`flex items-start gap-2 rounded-2xl border p-4 text-sm ${
                a.priority === 'important'
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20'
                  : 'border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900'
              }`}
            >
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="font-medium">
                  {a.pinned && <Pin className="mr-1 inline h-3 w-3 text-amber-500" />}
                  {a.title}
                </p>
                <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">{a.body}</p>
                <p className="mt-1 text-xs text-gray-400">{a.createdBy?.name} · {formatDate(a.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
