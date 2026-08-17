import { useSearchParams, Link } from 'react-router-dom';
import { BookOpen, CalendarDays, ArrowLeft, PenSquare, ArrowRight } from 'lucide-react';
import { listNotes } from '../../api/notes';
import { listTasks } from '../../api/tasks';
import { formatDate, daysUntil } from '../../utils/dateUtils';
import { CardGridSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { Page } from '../../components/common/motion';
import useAsync from '../../hooks/useAsync';

const ACADEMIC_TYPES = ['case-study', 'exam', 'deadline'];

export default function SubjectPage() {
  const [params] = useSearchParams();
  const subject = params.get('subject') || '';

  const { data, error, loading, reload } = useAsync(async () => {
    if (!subject) return { notes: [], tasks: [] };
    const [n, t] = await Promise.all([listNotes({ subject }), listTasks()]);
    return {
      notes: n.data,
      tasks: t.data.filter(
        (task) =>
          ACADEMIC_TYPES.includes(task.type) &&
          task.subject?.toLowerCase() === subject.toLowerCase() &&
          task.status !== 'done'
      ),
    };
  }, [subject]);

  const notes = data?.notes;
  const tasks = data?.tasks;

  if (!subject) {
    return (
      <Page>
        <EmptyState icon={BookOpen} title="No subject selected" subtitle="Pick a subject from the Study overview." />
      </Page>
    );
  }

  if (loading) return <div className="mx-auto w-full max-w-3xl px-4 py-6"><CardGridSkeleton count={6} /></div>;
  if (error) {
    return (
      <Page>
        <ErrorState title={`Could not load ${subject}`} onRetry={reload} />
      </Page>
    );
  }

  return (
    <Page>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link to="/study" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600">
            <ArrowLeft className="h-3 w-3" /> Study
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{subject}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {tasks && tasks.length > 0 ? ` · ${tasks.length} due` : ''}
          </p>
        </div>
        <Link
          to={`/study/notes/new`}
          className="flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all"
        >
          <PenSquare className="h-4 w-4" /> New note
        </Link>
      </div>

      {/* Upcoming assignments for this subject */}
      {tasks && tasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-warn-200 bg-warn-50 p-4 dark:border-warn-800/60 dark:bg-warn-900/20">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warn-800 dark:text-warn-400">
            <CalendarDays className="h-4 w-4" /> Due for {subject}
          </p>
          <ul className="space-y-1.5">
            {tasks.map((t) => {
              const days = daysUntil(t.dueDate);
              return (
                <li key={t._id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{t.title}</span>
                  <span className={`ml-2 shrink-0 text-xs font-medium ${days < 0 ? 'text-danger-600' : days <= 1 ? 'text-warn-700' : 'text-gray-500'}`}>
                    {days < 0 ? 'Overdue · ' : days === 0 ? 'Today · ' : ''}
                    {formatDate(t.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={`No notes for ${subject} yet`}
          subtitle="Add the first note for this subject."
          action={
            <Link to="/study/notes/new" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all">
              <PenSquare className="h-4 w-4" /> Add note
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note._id}>
              <Link
                to={`/study/notes/${note._id}`}
                className="card card-hover flex items-center justify-between px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{note.title}</p>
                  {note.semester && (
                    <p className="text-xs text-gray-400">{note.semester}</p>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2 text-xs text-gray-400">
                  <span>{formatDate(note.createdAt)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary-400" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
