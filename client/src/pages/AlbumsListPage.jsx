import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../utils/toast';
import { Camera, Plus, Image, Trash2, ExternalLink } from 'lucide-react';
import Button from '../components/common/Button';
import { listAlbums, createAlbum, deleteAlbum } from '../api/albums';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateUtils';
import { CardGridSkeleton } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import useAsync from '../hooks/useAsync';

export default function AlbumsListPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState } = useForm();
  const { user } = useAuth();

  // `load` doubles as the post-mutation refetch and the retry-after-failure.
  const { data: albums, error, loading, reload: load } = useAsync(() => listAlbums(), []);

  const onCreate = async (data) => {
    try {
      await createAlbum(data);
      toast.success('Album added');
      reset();
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add album');
    }
  };

  const onDelete = async (id) => {
    await deleteAlbum(id);
    toast.success('Album removed');
    load();
  };

  const requestDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">Photo Albums</h1>
        <Button size="sm" onClick={() => setModalOpen(true)} icon={Plus}>Add album</Button>
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Albums link to shared Google Photos — click any card to open the full album.
      </p>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState title="Could not load albums" onRetry={load} />
      ) : albums.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No albums yet"
          subtitle="Paste a Google Photos shared link to add your first batch album"
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <a
              key={album._id}
              href={album.link}
              target="_blank"
              rel="noreferrer"
              className="card-hover group relative block overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900"
            >
              <div className="relative flex h-40 items-center justify-center overflow-hidden bg-indigo-500">
                {album.cover ? (
                  <img
                    src={album.cover}
                    alt={album.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <Image className="h-9 w-9 text-white/80" />
                )}
                <span className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="h-4 w-4" />
                </span>
              </div>
              <div className="p-4">
                <h2 className="font-semibold">{album.title}</h2>
                {album.description && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {album.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {album.createdBy?.name} · {formatDate(album.createdAt)}
                </p>
              </div>
              {album.createdBy?._id === user?.id && (
                <button
                  onClick={(e) => requestDelete(e, album._id)}
                  aria-label="Remove album"
                  className="absolute bottom-3 right-3 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </a>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => onDelete(confirmDeleteId)}
        title="Remove album"
        message="This album link will be removed from DATAD."
        danger
        confirmLabel="Remove"
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add a Google Photos album">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label htmlFor="album-title" className="mb-1 block text-sm font-medium">Title</label>
            <input
              id="album-title"
              {...register('title', { required: true })}
              placeholder="e.g. Orientation Week"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="album-link" className="mb-1 block text-sm font-medium">
              Google Photos shared link
            </label>
            <input
              id="album-link"
              {...register('link', { required: true })}
              placeholder="https://photos.app.goo.gl/…"
              className="input"
            />
            <p className="mt-1 text-xs text-gray-400">
              In Google Photos: open the album → Share → Create link → paste it here.
            </p>
          </div>
          <div>
            <label htmlFor="album-cover" className="mb-1 block text-sm font-medium">
              Cover image URL <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="album-cover"
              {...register('cover')}
              placeholder="https://… (leave blank for a default cover)"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="album-desc" className="mb-1 block text-sm font-medium">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <input id="album-desc" {...register('description')} className="input" />
          </div>
          <Button type="submit" fullWidth disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
