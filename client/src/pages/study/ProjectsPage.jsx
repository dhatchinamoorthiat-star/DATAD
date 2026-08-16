import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { KanbanSquare, Plus, Users, Calendar, ChevronRight, X } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { listProjects, createProject, getProject, createProjectTask, updateProjectTask, deleteProjectTask } from '../../api/projects';
import { FeedSkeleton, RowSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import DateInput from '../../components/common/DateInput';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';


const COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'border-gray-300 dark:border-gray-700' },
  { key: 'in-progress', label: 'In Progress', color: 'border-warn-400' },
  { key: 'done', label: 'Done', color: 'border-success-500' },
];

function TaskCard({ task, projectId, onUpdate, onDelete }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{task.title}</p>
        <button onClick={() => onDelete(task._id)} className="text-gray-300 hover:text-danger-400"><X className="h-3.5 w-3.5" /></button>
      </div>
      {task.assignee && <p className="mt-1 text-xs text-gray-400">👤 {task.assignee.name}</p>}
      {task.dueDate && <p className="mt-1 text-xs text-gray-400">📅 {new Date(task.dueDate).toLocaleDateString()}</p>}
      <select
        value={task.status}
        onChange={(e) => onUpdate(task._id, { status: e.target.value })}
        className="mt-2 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="todo">To Do</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>
  );
}

function KanbanView({ project, onRefresh }) {
  const [tasks, setTasks] = useState(project.tasks || []);
  const [addingCol, setAddingCol] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  const onAddTask = async (col, data) => {
    try {
      const res = await createProjectTask(project._id, { title: data.title, status: col });
      setTasks((prev) => [...prev, res.data]);
      setAddingCol(null);
      reset();
    } catch { toast.error('Failed to add task'); }
  };

  const onUpdate = async (taskId, updates) => {
    try {
      const res = await updateProjectTask(project._id, taskId, updates);
      setTasks((prev) => prev.map((t) => t._id === taskId ? res.data : t));
    } catch { toast.error('Could not update task'); }
  };

  const onDelete = async (taskId) => {
    try {
      await deleteProjectTask(project._id, taskId);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch { toast.error('Could not delete task'); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className={`rounded-xl border-t-2 bg-gray-50 p-3 dark:bg-gray-900/50 ${col.color}`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{col.label} <span className="ml-1 text-gray-400">({colTasks.length})</span></p>
              <button onClick={() => setAddingCol(col.key)} className="rounded-lg p-1 hover:bg-gray-200 dark:hover:bg-gray-700">
                <Plus className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2">
              {colTasks.map((t) => (
                <TaskCard key={t._id} task={t} projectId={project._id} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
              {addingCol === col.key && (
                <form onSubmit={handleSubmit((d) => onAddTask(col.key, d))} className="space-y-2">
                  <input {...register('title', { required: true })} placeholder="Task title" autoFocus className="w-full rounded-lg border border-primary-400 bg-white px-3 py-1.5 text-sm focus:outline-none dark:bg-gray-800" />
                  <div className="flex gap-1">
                    <button type="submit" className="flex-1 rounded-full bg-primary-600 py-1 text-xs font-medium text-white">Add</button>
                    <button type="button" onClick={() => setAddingCol(null)} className="rounded-full border border-gray-300 px-2 py-1 text-xs dark:border-gray-700">✕</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  useDocumentTitle('Group Projects');
  const [projects, setProjects] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    listProjects().then((r) => setProjects(r.data)).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!selected) { setSelectedData(null); return; }
    getProject(selected).then((r) => setSelectedData(r.data)).catch(() => setSelectedData(null));
  }, [selected]);

  const onAdd = async (data) => {
    try {
      const res = await createProject(data);
      setProjects((prev) => [res.data, ...(prev || [])]);
      toast.success('Project created');
      setShowAdd(false);
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <Page>
      {selected && selectedData ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="text-sm text-gray-500 hover:text-primary-600">← Back</button>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{selectedData.title}</h1>
            {selectedData.subject && <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{selectedData.subject}</span>}
          </div>
          <div className="mb-4 flex items-center gap-3">
            <Users className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1">
              {[selectedData.createdBy, ...(selectedData.members || [])].map((m) => m && (
                <span key={m._id} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  {m.name?.[0]?.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          <KanbanView project={selectedData} onRefresh={() => getProject(selected).then((r) => setSelectedData(r.data))} />
        </>
      ) : (
        <>
          <PageHeader
            icon={KanbanSquare}
            title="Group Projects"
            subtitle="Kanban boards for every group assignment"
            action={{ label: 'New Project', onClick: () => setShowAdd(true), icon: Plus }}
          />

          {projects === null ? <FeedSkeleton count={3} /> : projects.length === 0 ? (
            <EmptyState icon={KanbanSquare} title="No projects yet" description="Create your first group project to collaborate with batchmates" cta={{ label: 'New Project', onClick: () => setShowAdd(true) }} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <button key={p._id} onClick={() => setSelected(p._id)} className="card card-hover group p-5 text-left hover:border-primary-200">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold group-hover:text-primary-600">{p.title}</p>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-500" />
                  </div>
                  {p.subject && <p className="mb-2 text-xs text-gray-500">{p.subject}</p>}
                  {p.description && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{1 + (p.members?.length || 0)} member{p.members?.length !== 0 ? 's' : ''}</span>
                    {p.deadline && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(p.deadline).toLocaleDateString()}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="New Project">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
          <input {...register('title', { required: true })} placeholder="Project title *" className="input" />
          <textarea {...register('description')} placeholder="What's this project about?" rows={2} className="input" />
          <input {...register('subject')} placeholder="Subject / course" className="input" />
          <DateInput {...register('deadline')} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 hover:shadow-md transition-all disabled:opacity-50">Create</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
