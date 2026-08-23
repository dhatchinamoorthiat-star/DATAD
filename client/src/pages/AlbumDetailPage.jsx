import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import toast from '../utils/toast';
import Button from '../components/common/Button';
import { getAlbum } from '../api/albums';
import { listAlbumPhotos, uploadPhoto, deletePhoto } from '../api/photos';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateUtils';
import { CardGridSkeleton } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import ConfirmModal from '../components/common/ConfirmModal';
import useAsync from '../hooks/useAsync';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Kept in step with UPLOAD_MAX_IMAGE_MB on the server. Checking here as well is
// not duplication for its own sake: a 30 MB phone photo otherwise uploads in
// full before the server rejects it, on a connection where that is the slowest
// part of the whole interaction.
const MAX_IMAGE_MB = 10;

export default function AlbumDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { data: album, error: albumError, loading: albumLoading, reload: reloadAlbum } =
    useAsync(() => getAlbum(id), [id]);
  const { data: photos, error, loading, reload } = useAsync(() => listAlbumPhotos(id), [id]);

  useDocumentTitle(album?.title || 'Album');

  const isOwner = album?.createdBy?._id === user?.id;

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const tooBig = files.filter((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    const usable = files.filter((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024);
    if (tooBig.length) {
      toast.error(
        tooBig.length === 1
          ? `${tooBig[0].name} is over ${MAX_IMAGE_MB} MB`
          : `${tooBig.length} photos are over ${MAX_IMAGE_MB} MB and were skipped`
      );
    }
    if (!usable.length) return;

    setUploading(usable.length);
    let failed = 0;
    // Sequential on purpose: a batch of phone photos fired in parallel is what
    // the heavy rate limiter exists to stop, and losing the whole batch to a 429
    // is worse than the upload taking longer.
    for (const file of usable) {
      try {
        await uploadPhoto({ albumId: id, file });
      } catch (err) {
        failed += 1;
        toast.error(err.response?.data?.message || `Could not upload ${file.name}`);
      }
      setUploading((n) => n - 1);
    }
    const added = usable.length - failed;
    if (added > 0) toast.success(added === 1 ? 'Photo added' : `${added} photos added`);
    reload();
    reloadAlbum();
  }

  async function onDelete(photoId) {
    try {
      await deletePhoto(photoId);
      toast.success('Photo removed');
      reload();
      reloadAlbum();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove photo');
    }
  }

  if (albumLoading) return <div className="mx-auto max-w-5xl px-4 py-6"><CardGridSkeleton count={6} /></div>;
  if (albumError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ErrorState title="Could not load this album" onRetry={reloadAlbum} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        to="/community/memories"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" /> Albums
      </Link>

      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{album.title}</h1>
          {album.description && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{album.description}</p>
          )}
        </div>
        <Button
          size="sm"
          icon={ImagePlus}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading > 0}
        >
          {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
        </Button>
      </div>
      <p className="mb-4 text-xs text-gray-400">
        {album.createdBy?.name} · {formatDate(album.createdAt)}
        {album.photoCount ? ` · ${album.photoCount} photo${album.photoCount === 1 ? '' : 's'}` : ''}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState title="Could not load photos" onRetry={reload} />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No photos yet"
          subtitle={`Add photos from your device — up to ${MAX_IMAGE_MB} MB each`}
        />
      ) : (
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <figure
              key={photo._id}
              className="card-hover group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900"
            >
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={photo.url}
                  alt={photo.caption || 'Album photo'}
                  loading="lazy"
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </a>
              {photo.caption && (
                <figcaption className="line-clamp-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {photo.caption}
                </figcaption>
              )}
              {(photo.uploadedBy?._id === user?.id || isOwner) && (
                <button
                  onClick={() => setConfirmDeleteId(photo._id)}
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-500 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </figure>
          ))}
          {uploading > 0 && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-300 text-gray-400 dark:border-gray-700">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => onDelete(confirmDeleteId)}
        title="Remove photo"
        message="This photo will be deleted from DATAD and cannot be recovered."
        danger
        confirmLabel="Remove"
      />
    </div>
  );
}
