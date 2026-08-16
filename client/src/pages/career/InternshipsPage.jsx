import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Building2, ExternalLink, MapPin, Clock, Plus, Search } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { listInternships, createInternship, deleteInternship } from '../../api/internships';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import DateInput from '../../components/common/DateInput';
import { Page } from '../../components/common/motion';


const CONDITION_LABELS = { new: 'New', 'like-new': 'Like New', good: 'Good', fair: 'Fair' };

export default function InternshipsPage() {
  useDocumentTitle('Internship Board');
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [remote, setRemote] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (remote) params.remote = 'true';
    listInternships(params).then((r) => setItems(r.data)).catch(() => setItems([]));
  };

  useEffect(() => { load(); }, [search, remote]);

  const onAdd = async (data) => {
    try {
      const tags = data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      await createInternship({ ...data, tags });
      toast.success('Internship posted');
      setShowAdd(false);
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteInternship(id);
      setItems((prev) => prev.filter((i) => i._id !== id));
      toast.success('Removed');
    } catch { toast.error('Could not remove internship'); }
  };

  return (
    <Page>
      <PageHeader
        icon={Building2}
        title="Internship Board"
        subtitle="Curated opportunities shared by the batch"
        action={{ label: 'Post Internship', onClick: () => setShowAdd(true), icon: Plus }}
      />

      <div className="mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, title, tags…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="rounded" />
          Remote only
        </label>
      </div>

      {items === null ? <FeedSkeleton count={4} /> : items.length === 0 ? (
        <EmptyState icon={Building2} title="No internships yet" description="Be the first to post one!" cta={{ label: 'Post Internship', onClick: () => setShowAdd(true) }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item._id} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.company}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{item.title}</p>
                </div>
                {item.remote && (
                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Remote</span>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500">
                {item.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span>}
                {item.duration && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{item.duration}</span>}
                {item.stipend && <span className="font-medium text-emerald-600 dark:text-emerald-400">{item.stipend}</span>}
              </div>
              {item.eligibility && <p className="mb-2 text-xs text-gray-400">Eligibility: {item.eligibility}</p>}
              {item.deadline && <p className="mb-3 text-xs text-gray-400">Deadline: {new Date(item.deadline).toLocaleDateString()}</p>}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {item.tags?.map((t) => (
                  <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{t}</span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <a href={item.applyLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                  Apply <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="text-xs text-gray-400">Posted by {item.postedBy?.name}</p>
                {user?._id === item.postedBy?._id && (
                  <button onClick={() => onDelete(item._id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="Post Internship">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
          <input {...register('title', { required: true })} placeholder="Role / title *" className="input" />
          <input {...register('company', { required: true })} placeholder="Company *" className="input" />
          <input {...register('applyLink', { required: true })} placeholder="Apply link *" className="input" />
          <input {...register('location')} placeholder="Location (e.g. Mumbai)" className="input" />
          <input {...register('stipend')} placeholder="Stipend (e.g. ₹15,000/month)" className="input" />
          <input {...register('duration')} placeholder="Duration (e.g. 2 months)" className="input" />
          <DateInput {...register('deadline')} />
          <input {...register('eligibility')} placeholder="Eligibility" className="input" />
          <input {...register('tags')} placeholder="Tags (comma-separated: Finance, Excel)" className="input" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('remote')} className="rounded" /> Remote / hybrid
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Post</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
