import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Mail, Trash2, Sparkles } from 'lucide-react';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from '../../api/admin';
import { formatDate } from '../../utils/dateUtils';
import Loader from '../../components/common/Loader';
import { AdminShell, inputClass } from './shared';
import ConfirmModal from '../../components/common/ConfirmModal';

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState } = useForm();

  const load = () =>
    listAnnouncements()
      .then((res) => setAnnouncements(res.data))
      // Render an empty list rather than pinning the page on <Loader/>.
      .catch(() => {
        setAnnouncements([]);
        toast.error('Could not load announcements');
      });
  useEffect(() => {
    load();
  }, []);

  const onCreate = async (data) => {
    try {
      await createAnnouncement(data);
      toast.success(data.sendEmail ? 'Announcement sent & emailed to the batch' : 'Announcement posted');
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post announcement');
    }
  };

  const onDelete = async (id) => {
    await deleteAnnouncement(id);
    load();
  };

  if (!announcements) return <Loader />;

  return (
    <AdminShell
      title="Announcements"
      icon={Megaphone}
      subtitle="Post to the dashboard — optionally emailed to every member"
    >
      <Link
        to="/admin/studio?dest=announcements"
        className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
      >
        <Sparkles className="h-4 w-4" />
        Have a file to announce? Upload it via the Content Studio →
      </Link>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
            <input
              {...register('title', { required: true })}
              placeholder="Title"
              aria-label="Announcement title"
              className={inputClass}
            />
            <textarea
              rows={5}
              {...register('body', { required: true })}
              placeholder="Write the announcement…"
              aria-label="Announcement body"
              className={inputClass}
            />
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" {...register('pinned')} className="rounded" />
                <Pin className="h-3.5 w-3.5 text-gray-400" /> Pin
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" defaultChecked {...register('sendEmail')} className="rounded" />
                <Mail className="h-3.5 w-3.5 text-gray-400" /> Email everyone
              </label>
              <select
                {...register('priority')}
                aria-label="Priority"
                className="rounded-lg border border-gray-300 bg-transparent px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {formState.isSubmitting ? 'Posting…' : 'Post announcement'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
            Posted ({announcements.length})
          </h2>
          <div className="space-y-2.5">
            {announcements.length === 0 && <p className="text-sm text-gray-400">No announcements yet.</p>}
            {announcements.map((a) => (
              <div key={a._id} className="flex items-start gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.pinned && <Pin className="mr-1 inline h-3 w-3 text-amber-500" />}
                    {a.title}
                    {a.emailed && <Mail className="ml-1 inline h-3 w-3 text-gray-400" />}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(a.createdAt)}</p>
                </div>
                <button
                  onClick={() => setConfirmDeleteId(a._id)}
                  aria-label="Delete announcement"
                  className="rounded p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => onDelete(confirmDeleteId)}
        title="Delete announcement"
        message="This announcement will be permanently deleted."
        danger
        confirmLabel="Delete"
      />
    </AdminShell>
  );
}
