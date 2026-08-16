import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight, Plus, X } from 'lucide-react';
import { listTasks, createTask } from '../../api/tasks';
import { daysUntil, formatDate } from '../../utils/dateUtils';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import DateInput from '../../components/common/DateInput';
import { Page } from '../../components/common/motion';
import toast from '../../utils/toast';
import { TASK_TYPES } from '../../utils/constants';

const ACADEMIC_TYPES = ['case-study', 'exam', 'deadline', 'other'];
const TYPE_LABEL = { 'case-study': 'Case study', exam: 'Exam', deadline: 'Deadline', 'interview-prep': 'Interview Prep', other: 'Task' };


function NewAssignmentModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', type: 'deadline', subject: '', dueDate: '', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await createTask({ ...form, status: 'pending' });
      onCreated(res.data);
      toast.success('Assignment added');
      onClose();
    } catch {
      toast.error('Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">New self-planned assignment</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="e.g. Marketing Case Analysis" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Due date</label>
              <DateInput value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Subject (optional)</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" placeholder="e.g. Marketing" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Notes (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input" placeholder="What do you need to prepare?" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all disabled:opacity-50">
            {saving ? 'Adding…' : 'Add assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const [tasks, setTasks] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    listTasks().then((res) =>
      setTasks(
        res.data
          .filter((t) => ACADEMIC_TYPES.includes(t.type))
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      )
    );
  }, []);

  if (!tasks) return <div className="mx-auto max-w-3xl px-4 py-6"><FeedSkeleton count={5} /></div>;

  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <Page>
      {showModal && (
        <NewAssignmentModal
          onClose={() => setShowModal(false)}
          onCreated={(t) => setTasks((prev) => [t, ...prev].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)))}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Assignments</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Case studies, exams and self-planned tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all"
          >
            <Plus className="h-4 w-4" /> New assignment
          </button>
          <Link to="/me/planner" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
            Planner <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {open.length === 0 && done.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No assignments yet" subtitle="Add a new assignment or add case studies and exams from the Planner." action={{ label: 'New assignment', onClick: () => setShowModal(true) }} />
      ) : (
        <>
          <ul className="space-y-2">
            {open.map((t) => {
              const days = daysUntil(t.dueDate);
              return (
                <li key={t._id} className="card card-hover flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-gray-400">
                      {TYPE_LABEL[t.type] || t.type}
                      {t.subject ? ` · ${t.subject}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${days < 0 ? 'text-danger-600' : days <= 1 ? 'text-warn-700' : 'text-gray-400'}`}>
                    {days < 0 ? 'Overdue · ' : days === 0 ? 'Today · ' : days === 1 ? 'Tomorrow · ' : ''}
                    {formatDate(t.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
          {done.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wide text-gray-400">Completed</p>
              <ul className="space-y-2 opacity-60">
                {done.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-3 text-sm line-through dark:border-gray-800/80 dark:bg-gray-900">
                    <span className="truncate">{t.title}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatDate(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Page>
  );
}
