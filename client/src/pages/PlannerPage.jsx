import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../utils/toast';
import { CalendarDays, Check, Pencil, Plus, Trash2, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { listTasks, createTask, updateTask, deleteTask } from '../api/tasks';
import { useAuth } from '../context/AuthContext';
import { SUBJECTS, TASK_TYPES, TASK_STATUSES } from '../utils/constants';
import { formatDate, daysUntil } from '../utils/dateUtils';
import { FeedSkeleton } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import TierGate from '../components/common/TierGate';
import CrownBadge from '../components/common/CrownBadge';
import DateInput from '../components/common/DateInput';
import Button from '../components/common/Button';
import { DAX_CAPABILITY } from '../utils/dax';

function AIPlannerPanel({ tasks }) {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [showAI, setShowAI] = useState(false);

  if (state === 'idle' || state === 'error') {
    return (
      <button
        onClick={() => setShowAI((s) => !s)}
        className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-900/30 dark:text-indigo-300"
      >
        <Sparkles className="h-4 w-4" />
        {showAI ? 'Hide Dax' : "Ask Dax what to focus on today"}
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-600 dark:border-indigo-800/60 dark:bg-indigo-900/30">
        <Loader2 className="h-4 w-4 animate-spin" /> Thinking through your priorities…
      </div>
    );
  }

  return null;
}

export default function PlannerPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const fetchTasks = async () => {
    try {
      const res = await listTasks();
      setTasks(res.data?.data || res.data || []);
    } catch { toast.error('Could not load tasks'); }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const openCreate = () => {
    setEditingTask(null);
    reset({ title: '', type: 'assignment', subject: '', dueDate: '' });
    setShowForm(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    reset({ title: task.title, type: task.type, subject: task.subject || '', dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '' });
    setShowForm(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingTask) {
        await updateTask(editingTask._id, data);
        toast.success('Task updated');
      } else {
        await createTask(data);
        toast.success('Task created');
      }
      setShowForm(false);
      fetchTasks();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save task'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget._id);
      toast.success('Task deleted');
      setDeleteTarget(null);
      fetchTasks();
    } catch { toast.error('Could not delete task'); }
  };

  const handleStatusToggle = async (task) => {
    const nextStatus = task.status === 'done' ? 'pending' : 'done';
    try {
      await updateTask(task._id, { status: nextStatus });
      fetchTasks();
    } catch { toast.error('Could not update task'); }
  };

  const sorted = [...tasks].sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const { pending, overdue, completed } = {
    pending: sorted.filter((t) => t.status !== 'done' && daysUntil(t.dueDate) >= 0),
    overdue: sorted.filter((t) => t.status !== 'done' && daysUntil(t.dueDate) < 0),
    completed: sorted.filter((t) => t.status === 'done'),
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Planner</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your tasks and deadlines</p>
        </div>
        <Button onClick={openCreate} variant="primary" size="sm" icon={Plus}>Add</Button>
      </div>


      {loading ? <FeedSkeleton count={4} />
      : tasks.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No tasks yet" description="Plan your first task to get started." action={{ label: 'Create task', onClick: openCreate }} />
      ) : (
        <div className="space-y-8">

          {overdue.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-rose-500 mb-3">Overdue ({overdue.length})</h2>
              <div className="space-y-2">
                {overdue.map((task) => <TaskRow key={task._id} task={task} onEdit={openEdit} onDelete={setDeleteTarget} onToggle={handleStatusToggle} />)}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Upcoming ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400">All caught up — nothing pending.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((task) => <TaskRow key={task._id} task={task} onEdit={openEdit} onDelete={setDeleteTarget} onToggle={handleStatusToggle} />)}
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Completed ({completed.length})</h2>
              <div className="space-y-2 opacity-60">
                {completed.map((task) => <TaskRow key={task._id} task={task} onEdit={openEdit} onDelete={setDeleteTarget} onToggle={handleStatusToggle} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingTask ? 'Edit task' : 'New task'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
            <input {...register('title', { required: true })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            {errors.title && <p className="mt-1 text-xs text-rose-500">Required</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <select {...register('type')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                {TASK_TYPES?.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due</label>
              <DateInput {...register('dueDate')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">{editingTask ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete task?" message="This cannot be undone." confirmLabel="Delete" />
    </div>
  );
}

function TaskRow({ task, onEdit, onDelete, onToggle }) {
  const isPast = daysUntil(task.dueDate) < 0 && task.status !== 'done';
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${task.status === 'done' ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50' : isPast ? 'border-rose-100 bg-rose-50/50 dark:border-rose-900/30 dark:bg-rose-950/10' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
      <button onClick={() => onToggle(task)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${task.status === 'done' ? 'border-emerald-400 bg-emerald-400' : isPast ? 'border-rose-300' : 'border-gray-300'}`}>
        {task.status === 'done' && <Check className="h-3 w-3 text-white" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'font-medium text-gray-800 dark:text-gray-100'}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.type && <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{task.type}</span>}
          {task.subject && <><span className="text-gray-300">·</span><span className="text-[10px] text-gray-400">{task.subject}</span></>}
          {task.dueDate && <><span className="text-gray-300">·</span><span className={`text-[10px] ${isPast ? 'text-rose-500 font-medium' : 'text-gray-400'}`}>{formatDate(task.dueDate)}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(task)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => onDelete(task)} className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
