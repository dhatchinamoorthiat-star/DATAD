import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../utils/toast';
import { BookLock, Lock, PenLine, Pencil, Trash2 } from 'lucide-react';
import {
  listJournal,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../api/journal';
import { formatDate } from '../utils/dateUtils';
import { FeedSkeleton } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import useAsync from '../hooks/useAsync';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import DateInput from '../components/common/DateInput';
import Button from '../components/common/Button';
import { Page } from '../components/common/motion';
import { JOURNAL_PROMPTS } from '../utils/prompts';
import { pickDaily } from '../utils/rotation';

const MOODS = [
  { value: 'great', label: '😄 Great' },
  { value: 'good', label: '🙂 Good' },
  { value: 'okay', label: '😐 Okay' },
  { value: 'low', label: '😔 Low' },
  { value: 'rough', label: '😣 Rough' },
];

const moodEmoji = (mood) => MOODS.find((m) => m.value === mood)?.label.split(' ')[0] || '🙂';

export default function JournalPage() {
  // A blank box is the main reason an entry never gets written, so the empty
  // state and the composer both offer today's prompt. It is a suggestion, not a
  // field — nothing is prefilled, so an entry never starts as someone else's
  // words.
  const prompt = pickDaily(JOURNAL_PROMPTS, 'journal-prompt');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // entry _id to delete
  const { register, handleSubmit, reset, formState } = useForm();

  // `load` doubles as the post-mutation refetch and the retry-after-failure.
  const { data: entries, error, loading, reload: load } = useAsync(() => listJournal(), []);

  const openNew = () => {
    setEditing(null);
    reset({
      title: '',
      content: '',
      mood: 'good',
      entryDate: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    reset({
      title: entry.title || '',
      content: entry.content,
      mood: entry.mood,
      entryDate: entry.entryDate.slice(0, 10),
    });
    setModalOpen(true);
  };

  const onSave = async (data) => {
    try {
      if (editing) {
        await updateJournalEntry(editing._id, data);
        toast.success('Entry updated');
      } else {
        await createJournalEntry(data);
        toast.success('Entry saved');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save entry');
    }
  };

  const onDelete = async (id) => {
    await deleteJournalEntry(id);
    toast.success('Entry deleted');
    load();
  };

  return (
    <Page overview={{
      pageKey: 'life-journal',
      title: 'A private log, just yours',
      blurb: 'Dated entries nobody else can read — for thinking something through rather than performing it.',
      takeaway: 'Write one honest paragraph today; the value shows up when you reread it in a month.',
    }}>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <BookLock className="h-5 w-5 text-indigo-500" /> My Journal
        </h1>
        <Button onClick={openNew} size="sm" icon={PenLine}>New entry</Button>
      </div>
      <p className="mb-5 flex items-center gap-1 text-xs text-gray-400">
        <Lock className="h-3 w-3" /> Completely private — only you can ever see this.
      </p>

      {loading ? (
        <FeedSkeleton count={4} />
      ) : error ? (
        <ErrorState title="Could not load your journal" onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookLock}
          title="Your journal is empty"
          subtitle={prompt ? `Today's prompt — ${prompt}` : 'Capture a memory, a thought, or how today went'}
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article
              key={entry._id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-400">
                    {moodEmoji(entry.mood)} {formatDate(entry.entryDate)}
                  </p>
                  {entry.title && <h2 className="mt-0.5 font-semibold">{entry.title}</h2>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(entry)}
                    aria-label="Edit entry"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(entry._id)}
                    aria-label="Delete entry"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {entry.content}
              </p>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => onDelete(confirmDelete)}
        title="Delete journal entry"
        message="This entry will be permanently deleted and cannot be recovered."
        danger
        confirmLabel="Delete"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit entry' : 'New journal entry'}
      >
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="j-date" className="mb-1 block text-sm font-medium">Date</label>
              <DateInput id="j-date" {...register('entryDate', { required: true })} />
            </div>
            <div>
              <label htmlFor="j-mood" className="mb-1 block text-sm font-medium">Mood</label>
              <select id="j-mood" {...register('mood')} className="input">
                {MOODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="j-title" className="mb-1 block text-sm font-medium">
              Title <span className="text-gray-400">(optional)</span>
            </label>
            <input id="j-title" {...register('title')} placeholder="e.g. First day of Sem 2" className="input" />
          </div>
          <div>
            <label htmlFor="j-content" className="mb-1 block text-sm font-medium">What happened?</label>
            <textarea
              id="j-content"
              rows={6}
              {...register('content', { required: true })}
              placeholder="Write freely — this stays between you and the page…"
              className="input"
            />
            {/* Only offered on a new entry; when editing, the reader already has
                something on the page and a prompt is just noise. */}
            {!editing && prompt && (
              <p className="mt-1.5 text-xs text-gray-400">
                Stuck? {prompt}
              </p>
            )}
          </div>
          <Button type="submit" fullWidth disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Saving…' : 'Save entry'}</Button>
        </form>
      </Modal>
    </Page>
  );
}
