import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Link } from 'react-router-dom';
import {
  FileText, FileSpreadsheet, Link2, Video, Download, Search,
  Plus, ExternalLink, Upload, Sparkles, Folder, FolderOpen,
  ArrowLeft, Files,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { listResources, createResource, uploadResourceFile, deleteResource, downloadResource } from '../../api/resources';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { Page } from '../../components/common/motion';


const TYPE_ICONS = {
  pdf: FileText, word: FileText, excel: FileSpreadsheet, ppt: FileText,
  zip: FileText, video: Video, link: Link2,
};
const TYPE_COLORS = {
  pdf: 'text-red-500', word: 'text-blue-500', excel: 'text-green-600',
  ppt: 'text-orange-500', zip: 'text-yellow-600', video: 'text-purple-500', link: 'text-primary-500',
};
const TYPES = ['pdf', 'word', 'excel', 'ppt', 'zip', 'video', 'link'];

// Folder accents cycle the four Google-ecosystem colors, never more.
const FOLDER_COLORS = [
  'text-primary-600 bg-primary-50 dark:bg-primary-950/40 border-primary-200/80 dark:border-primary-800/60',
  'text-success-600 bg-success-50 dark:bg-success-950/40 border-success-200/80 dark:border-success-800/60',
  'text-warn-700 bg-warn-50 dark:bg-warn-950/40 border-warn-200/80 dark:border-warn-800/60',
  'text-danger-600 bg-danger-50 dark:bg-danger-950/40 border-danger-200/80 dark:border-danger-800/60',
];

function groupBySubject(items) {
  const groups = {};
  items.forEach((item) => {
    const key = item.subject || 'General';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function ResourcesPage() {
  useDocumentTitle('Resource Library');
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState('link');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [openFolder, setOpenFolder] = useState(null); // null = folder view
  const fileRef = useRef(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (sortBy === 'downloads') params.sort = 'downloads';
    listResources(params).then((r) => setItems(r.data)).catch(() => setItems([]));
  };

  useEffect(() => { load(); }, [search, sortBy]);

  const onAddLink = async (data) => {
    try {
      const tags = data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      await createResource({ ...data, tags });
      toast.success('Resource added');
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const onUploadFile = async (data) => {
    if (!selectedFile) return toast.error('Please select a file');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', data.title);
      if (data.subject) fd.append('subject', data.subject);
      if (data.semester) fd.append('semester', data.semester);
      if (data.professor) fd.append('professor', data.professor);
      if (data.tags) fd.append('tags', data.tags);
      await uploadResourceFile(fd);
      toast.success('File uploaded');
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => { setShowAdd(false); setSelectedFile(null); setAddTab('link'); reset(); };

  const handleOpen = async (item) => {
    downloadResource(item._id).catch(() => {});
    window.open(item.url, '_blank', 'noopener');
    setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, downloads: i.downloads + 1 } : i));
  };

  const folders = items ? groupBySubject(items) : [];
  const folderItems = openFolder ? (items || []).filter((i) => (i.subject || 'General') === openFolder) : [];

  return (
    <Page>
      <PageHeader
        icon={FileText}
        title="Resource Library"
        subtitle="Notes, PDFs, spreadsheets and links — organised by subject"
      />

      {/* Search + sort */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setOpenFolder(null); }}
            placeholder="Search resources…"
            className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900">
          <option value="newest">Newest</option>
          <option value="downloads">Most downloaded</option>
        </select>
      </div>

      {items === null ? <FeedSkeleton count={6} /> : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <EmptyState icon={Files} title="No resources yet" description="Add the first resource for your batch" />
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all">
            <Plus className="h-4 w-4" /> Add Resource
          </button>
        </div>
      ) : openFolder ? (
        /* ── Inside a folder ── */
        <>
          <button onClick={() => setOpenFolder(null)} className="mb-4 flex items-center gap-2 text-sm text-primary-600 hover:underline dark:text-primary-400">
            <ArrowLeft className="h-4 w-4" /> All folders
          </button>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary-500" />
              <h2 className="text-xl font-semibold">{openFolder}</h2>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{folderItems.length} file{folderItems.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folderItems.map((item) => {
              const Icon = TYPE_ICONS[item.type] || FileText;
              const iconColor = TYPE_COLORS[item.type] || 'text-gray-500';
              return (
                <div key={item._id} className="card card-hover p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <Icon className={`h-7 w-7 shrink-0 ${iconColor}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.professor || item.semester || item.type?.toUpperCase()}</p>
                    </div>
                  </div>
                  {item.tags?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {item.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] dark:bg-gray-800">{t}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-gray-400"><Download className="h-3.5 w-3.5" />{item.downloads}</span>
                    <button onClick={() => handleOpen(item)} className="flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700">
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : search ? (
        /* ── Search results flat view ── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || FileText;
            const iconColor = TYPE_COLORS[item.type] || 'text-gray-500';
            return (
              <div key={item._id} className="card p-4">
                <div className="mb-3 flex items-start gap-3">
                  <Icon className={`h-7 w-7 shrink-0 ${iconColor}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-gray-400">{[item.subject, item.professor].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Download className="h-3.5 w-3.5" />{item.downloads}</span>
                  <button onClick={() => handleOpen(item)} className="flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700">
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Folder grid ── */
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map(([subject, files], i) => {
              const colors = FOLDER_COLORS[i % FOLDER_COLORS.length];
              return (
                <button
                  key={subject}
                  onClick={() => setOpenFolder(subject)}
                  className={`flex items-center gap-4 rounded-2xl border p-5 text-left shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] hover:shadow-[0_2px_4px_rgba(60,64,67,0.08),0_6px_16px_rgba(60,64,67,0.1)] transition-all duration-200 hover:-translate-y-0.5 dark:shadow-none ${colors}`}
                >
                  <FolderOpen className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm">{subject}</p>
                    <p className="text-xs opacity-70">{files.length} file{files.length !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Centred Add Resource block */}
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-8 py-5 text-sm font-medium text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-500"
            >
              <Plus className="h-5 w-5" /> Add a new resource
            </button>
          </div>
        </>
      )}

      <Modal open={showAdd} onClose={closeModal} title="Add Resource">
        {user?.role === 'admin' && (
          <Link to="/admin/studio?dest=resources"
            className="mb-4 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-900 dark:bg-primary-950/40 dark:text-primary-300">
            <Sparkles className="h-3.5 w-3.5" /> Admin tip: upload via the Content Studio and Dax fills the metadata →
          </Link>
        )}
        <div className="mb-4 flex rounded-full border border-gray-200 p-1 dark:border-gray-700">
          {[['link', 'Link / URL'], ['file', 'Upload File']].map(([key, label]) => (
            <button key={key} onClick={() => setAddTab(key)}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${addTab === key ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
        {addTab === 'link' ? (
          <form onSubmit={handleSubmit(onAddLink)} className="space-y-3">
            <input {...register('title', { required: true })} placeholder="Title *" className="input" />
            <input {...register('url', { required: true })} placeholder="URL / link *" className="input" />
            <select {...register('type')} className="input">{TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select>
            <input {...register('subject')} placeholder="Subject / folder name" className="input" />
            <input {...register('semester')} placeholder="Semester (e.g. Sem 2)" className="input" />
            <input {...register('professor')} placeholder="Professor name" className="input" />
            <input {...register('tags')} placeholder="Tags (comma-separated)" className="input" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all disabled:opacity-50">Add</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit(onUploadFile)} className="space-y-3">
            <input {...register('title', { required: true })} placeholder="Title *" className="input" />
            <div onClick={() => fileRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-6 hover:border-primary-400 hover:bg-primary-50/50 dark:border-gray-700">
              <Upload className="h-7 w-7 text-gray-400" />
              {selectedFile ? <p className="text-sm font-medium text-primary-600">{selectedFile.name}</p> : <p className="text-sm text-gray-500">Click to select a file (PDF, PPT, Word, Excel, ZIP, Video · max 50 MB)</p>}
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp4,.webm" onChange={(e) => setSelectedFile(e.target.files[0] || null)} />
            </div>
            <input {...register('subject')} placeholder="Subject / folder name" className="input" />
            <input {...register('semester')} placeholder="Semester (e.g. Sem 2)" className="input" />
            <input {...register('professor')} placeholder="Professor name" className="input" />
            <input {...register('tags')} placeholder="Tags (comma-separated)" className="input" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
              <button type="submit" disabled={uploading} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all disabled:opacity-50">{uploading ? 'Uploading…' : 'Upload'}</button>
            </div>
          </form>
        )}
      </Modal>
    </Page>
  );
}
