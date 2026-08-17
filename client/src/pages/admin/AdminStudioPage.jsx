import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, UploadCloud, FileText, Image as ImageIcon, Film, Music,
  FileArchive, File, Loader2, AlertTriangle, CheckCircle2, Clock, PenLine,
} from 'lucide-react';
import { AdminShell } from './shared';
import EmptyState from '../../components/common/EmptyState';
import { uploadFiles, listItems } from '../../api/studio';

const TYPE_ICON = {
  pdf: FileText, word: FileText, excel: FileText, ppt: FileText,
  markdown: FileText, text: FileText, image: ImageIcon, video: Film,
  audio: Music, zip: FileArchive,
};

const STATUS_STYLE = {
  uploaded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  analyzing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  ready_for_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const STATUS_LABEL = {
  uploaded: 'Uploaded', analyzing: 'Analyzing…', ready_for_review: 'Ready for review',
  draft: 'Draft', scheduled: 'Scheduled', published: 'Published',
  rejected: 'Rejected', failed: 'Failed',
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'ready_for_review,analyzing,uploaded', label: 'In review' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'rejected,failed', label: 'Rejected' },
];

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] || ''}`}>
      {status === 'analyzing' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'published' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'scheduled' && <Clock className="h-3 w-3" />}
      {status === 'draft' && <PenLine className="h-3 w-3" />}
      {(status === 'failed' || status === 'rejected') && <AlertTriangle className="h-3 w-3" />}
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function AdminStudioPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dest = searchParams.get('dest') || '';
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('');
  const [items, setItems] = useState(null);

  const refresh = useCallback(() => {
    // Clearing here rather than in the effect body keeps the reset out of the
    // synchronous render path; the poller below reuses refresh() unchanged.
    Promise.resolve()
      .then(() => listItems(tab ? { status: tab } : {}))
      .then((res) => setItems(res.data.items))
      .catch(() => setItems([]));
  }, [tab]);

  useEffect(() => { refresh(); }, [refresh]);

  // While anything is still analyzing, poll so cards flip to "ready" live.
  useEffect(() => {
    if (!items?.some((i) => i.status === 'analyzing' || i.status === 'uploaded')) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [items, refresh]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadFiles(
        files,
        (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
        dest
      );
      if (res.data.length === 1) {
        navigate(`/admin/studio/${res.data[0]._id}`);
      } else {
        setTab('');
        refresh();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminShell
      title="Content Studio"
      icon={Sparkles}
      subtitle="Upload anything — Dax analyses it and suggests where it belongs."
    >
      {dest && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Sparkles className="h-4 w-4" />
          New uploads will publish to <strong>{dest}</strong>.
          <button
            onClick={() => setSearchParams({})}
            className="ml-auto text-xs underline"
          >
            Let Dax decide instead
          </button>
        </div>
      )}
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-gray-300 hover:border-indigo-400 dark:border-gray-700 dark:hover:border-indigo-600'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        {uploading ? (
          <>
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Uploading… {progress}%</p>
            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="mb-2 h-8 w-8 text-indigo-500" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              PDF, Word, Excel, PowerPoint, images, ZIP, video, audio, Markdown, text — up to 100 MB each
            </p>
          </>
        )}
      </div>
      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Recent uploads */}
      {items === null ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Files you upload will appear in this list." />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.file?.type] || File;
            const title = item.meta?.title || item.analysis?.title || item.file?.originalName;
            return (
              <li key={item._id}>
                <Link
                  to={`/admin/studio/${item._id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  {item.analysis?.thumbnailUrl ? (
                    <img
                      src={item.analysis.thumbnailUrl}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                      <Icon className="h-5 w-5 text-gray-500" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {item.destination?.key ? `→ ${item.destination.key}` : item.file?.type}
                      {item.duplicateOf && ' · possible duplicate'}
                      {' · '}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
