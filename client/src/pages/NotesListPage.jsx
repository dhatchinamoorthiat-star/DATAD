import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Search } from 'lucide-react';
import { listNotes } from '../api/notes';
import { SUBJECTS } from '../utils/constants';
import { formatDate } from '../utils/dateUtils';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { CardGridSkeleton } from '../components/common/Skeleton';
import useAsync from '../hooks/useAsync';

export default function NotesListPage() {
  const { data: notes, error, loading, reload } = useAsync(() => listNotes({}), []);
  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    if (!notes) return [];
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (subject && n.subject !== subject) return false;
      if (q && !n.title?.toLowerCase().includes(q) && !n.content?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, subject, query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Notes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your learning, in your own words. If it helps a batchmate too — even better.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes"
              className="rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm shadow-sm transition-colors focus:border-primary-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by subject"
            className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Link
            to="/study/notes/new"
            className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md"
          >
            <Plus className="h-4 w-4" /> New note
          </Link>
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState title="Could not load your notes" onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={query || subject ? 'No matching notes' : 'No notes yet'}
          subtitle={query || subject ? 'Try a different search or subject filter' : 'Start your knowledge repository — write down today’s class in your own words'}
          cta={!query && !subject ? { label: 'Write your first note', to: '/study/notes/new' } : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((note) => (
            <Link
              key={note._id}
              to={`/study/notes/${note._id}`}
              className="card card-hover p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                  {note.subject}
                </span>
                {note.semester && (
                  <span className="text-xs text-gray-400">{note.semester}</span>
                )}
              </div>
              <h2 className="mb-1 font-semibold">{note.title}</h2>
              <p className="line-clamp-2 text-sm text-gray-500">{note.content}</p>
              <p className="mt-3 text-xs text-gray-400">
                {note.author?.name} · {formatDate(note.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
