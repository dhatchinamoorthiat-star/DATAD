import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Clapperboard, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { listItems, createItem, deleteItem } from '../../api/entertainment';
import { AdminShell, inputClass } from './shared';
import ConfirmModal from '../../components/common/ConfirmModal';

const ARCHIVE_CATEGORIES = [
  'cartoons',
  'games',
  'gadgets',
  'snacks',
  'tv_shows',
  'theme_songs',
  'comics',
  'animated_movies',
];

export default function AdminArchivePage() {
  const [items, setItems] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState } = useForm();

  const load = () =>
    listItems()
      .then((res) => setItems(res.data))
      .catch(() => {
        setItems([]);
        toast.error('Could not load archive items');
      });
  useEffect(() => {
    load();
  }, []);

  const onCreate = async (form) => {
    // Assemble the payload the EntertainmentItem schema requires.
    const payload = {
      title: form.title,
      category: form.category,
      releaseYear: Number(form.releaseYear),
      yearsActive: form.yearsActive || String(form.releaseYear),
      country: form.country || undefined,
      studio: form.studio || undefined,
      overview: form.overview,
      history: form.history || undefined,
      psychology: { whyWeLovedThis: form.whyWeLovedThis },
      aiArtworks: form.artworkUrl ? [{ url: form.artworkUrl }] : [],
      isThrowbackPick: Boolean(form.isThrowbackPick),
    };
    try {
      await createItem(payload);
      toast.success('Archive item published');
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish item');
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteItem(id);
      toast.success('Item deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <AdminShell
      title="Nostalgia Archive"
      icon={Clapperboard}
      subtitle="Publish and manage the entertainment archive content"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
            <input {...register('title', { required: true })} placeholder="Title *" aria-label="Title" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <select {...register('category', { required: true })} aria-label="Category" className={inputClass}>
                {ARCHIVE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <input
                {...register('releaseYear', { required: true })}
                type="number"
                placeholder="Release year *"
                aria-label="Release year"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input {...register('yearsActive')} placeholder="Years active (e.g. 2000 - 2005)" aria-label="Years active" className={inputClass} />
              <input {...register('country')} placeholder="Country" aria-label="Country" className={inputClass} />
            </div>
            <input {...register('studio')} placeholder="Studio / maker" aria-label="Studio" className={inputClass} />
            <input {...register('artworkUrl')} placeholder="Cover image URL" aria-label="Cover image URL" className={inputClass} />
            <textarea {...register('overview', { required: true })} rows={3} placeholder="Overview *" aria-label="Overview" className={inputClass} />
            <textarea {...register('history')} rows={2} placeholder="History (optional)" aria-label="History" className={inputClass} />
            <textarea
              {...register('whyWeLovedThis', { required: true })}
              rows={2}
              placeholder="Why we loved this (psychology) *"
              aria-label="Why we loved this"
              className={inputClass}
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" {...register('isThrowbackPick')} className="rounded" /> Feature as Throwback pick
            </label>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {formState.isSubmitting ? 'Publishing…' : 'Publish archive item'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <p className="mb-2 text-xs text-gray-400">
            {items ? `${items.length} item${items.length === 1 ? '' : 's'} published` : 'Loading…'}
          </p>
          <ul className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
            {items?.map((it) => (
              <li key={it._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{it.title}</p>
                  <p className="truncate text-xs text-gray-400">
                    {it.category?.replace('_', ' ')} · {it.releaseYear} · {it.views || 0} views
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    to={`/entertainment/${it.category}/${it.slug}`}
                    aria-label="View item"
                    className="rounded p-1 text-gray-400 hover:text-indigo-500"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => setConfirmDeleteId(it._id)}
                    aria-label="Delete item"
                    className="rounded p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {items?.length === 0 && <li className="py-2 text-sm text-gray-400">No archive items yet.</li>}
          </ul>
        </div>
      </div>
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => onDelete(confirmDeleteId)}
        title="Delete archive item"
        message="This item and all its memories will be permanently deleted."
        danger
        confirmLabel="Delete"
      />
    </AdminShell>
  );
}
