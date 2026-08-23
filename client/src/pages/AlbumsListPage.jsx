import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from '../utils/toast';
import { Camera, Plus, Image, Trash2, ExternalLink, Images } from 'lucide-react';
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

// An album is either a pointer to Google Photos or a container for photos
// uploaded here. The two need different fields and behave differently once
// created, so the choice is made up front rather than inferred from a blank box.
const ALBUM_KINDS = [
  { value: 'hosted', label: 'Upload photos', blurb: 'Photos live in DATAD. Add them after creating the album.' },
  { value: 'linked', label: 'Link Google Photos', blurb: 'A card that opens a shared Google Photos album.' },
];

export default function AlbumsListPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState('hosted');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { register, handleSubmit, reset, formState } = useForm();
  const { user } = useAuth();

  // `load` doubles as the post-mutation refetch and the retry-after-failure.
  const { data: albums, error, loading, reload: load } = useAsync(() => listAlbums(), []);

  const onCreate = async (data) => {
    try {
      // A hosted album must reach the server with no link at all — sending an
      // empty string would still read as "linked" on the way back out.
      await createAlbum(kind === 'hosted' ? { ...data, link: undefined } : data);
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

  const requestDelete = (e, album) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(album);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">Photo Albums</h1>
        <Button size="sm" onClick={() => setModalOpen(true)} icon={Plus}>Add album</Button>
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Upload photos straight into an album, or add a card that links out to a shared Google Photos album.
      </p>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState title="Could not load albums" onRetry={load} />
      ) : albums.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No albums yet"
          subtitle="Create an album and upload your photos, or link a shared Google Photos album"
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
          // A linked album leaves DATAD, a hosted one opens its own page here.
          // Same card either way; only the element wrapping it changes.
          const hosted = !album.link;
          const CardTag = hosted ? Link : 'a';
          const cardProps = hosted
            ? { to: `/community/albums/${album._id}` }
            : { href: album.link, target: '_blank', rel: 'noreferrer' };
          return (
            <CardTag
              key={album._id}
              {...cardProps}
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
                  {hosted ? <Images className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
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
                  {hosted && ` · ${album.photoCount || 0} photo${album.photoCount === 1 ? '' : 's'}`}
                </p>
              </div>
              {album.createdBy?._id === user?.id && (
                <button
                  onClick={(e) => requestDelete(e, album)}
                  aria-label="Remove album"
                  className="absolute bottom-3 right-3 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </CardTag>
          );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => onDelete(confirmDelete._id)}
        title="Remove album"
        message={
          confirmDelete && !confirmDelete.link
            ? `This album and its ${confirmDelete.photoCount || 0} photo${
                confirmDelete.photoCount === 1 ? '' : 's'
              } will be deleted. Photos cannot be recovered.`
            : 'This album link will be removed from DATAD. The Google Photos album itself is untouched.'
        }
        danger
        confirmLabel="Remove"
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New album">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">What kind of album?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALBUM_KINDS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                    kind === option.value
                      ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-600 dark:bg-indigo-950/30'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="album-kind"
                    value={option.value}
                    checked={kind === option.value}
                    onChange={() => setKind(option.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{option.blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="album-title" className="mb-1 block text-sm font-medium">Title</label>
            <input
              id="album-title"
              {...register('title', { required: true })}
              placeholder="e.g. Orientation Week"
              className="input"
            />
          </div>
          {kind === 'linked' && (
            <>
              <div>
                <label htmlFor="album-link" className="mb-1 block text-sm font-medium">
                  Google Photos shared link
                </label>
                <input
                  id="album-link"
                  {...register('link', { required: kind === 'linked' })}
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
            </>
          )}
          {kind === 'hosted' && (
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              Save the album, then add photos from its page. The newest photo becomes the cover.
            </p>
          )}
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
