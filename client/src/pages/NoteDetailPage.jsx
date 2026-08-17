import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from '../utils/toast';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { getNote, deleteNote } from '../api/notes';
import { formatDateTime } from '../utils/dateUtils';
import { Skeleton } from '../components/common/Skeleton';
import ConfirmModal from '../components/common/ConfirmModal';

export default function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    getNote(id)
      .then((res) => setNote(res.data?.data || res.data))
      .catch(() => { toast.error('Note not found'); navigate('/study/notes'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleDelete = async () => {
    try {
      await deleteNote(id);
      toast.success('Note deleted');
      navigate('/study/notes');
    } catch { toast.error('Could not delete note'); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-10 w-3/4 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/study/notes" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to notes
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{note.title}</h1>
          {note.subject && <p className="mt-2 text-xs text-gray-400">{note.subject}</p>}
          <p className="mt-1 text-xs text-gray-400">Updated {formatDateTime(note.updatedAt)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link to={`/study/notes/${id}/edit`} className="rounded-full p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/30"><Pencil className="h-4 w-4" /></Link>
          <button onClick={() => setShowDelete(true)} className="rounded-full p-2 text-gray-400 hover:bg-danger-50 hover:text-danger-500 dark:hover:bg-danger-950/30"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-8 prose prose-sm dark:prose-invert max-w-none">
        {note.content ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">{note.content}</div>
        ) : (
          <p className="text-sm text-gray-400 italic">No content</p>
        )}
      </div>


      <ConfirmModal open={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete} title="Delete note?" message="This cannot be undone." confirmLabel="Delete" />
    </div>
  );
}
