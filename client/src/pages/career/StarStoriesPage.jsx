import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Edit2 } from 'lucide-react';
import toast from '../../utils/toast';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import { Page } from '../../components/common/motion';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { listStories, createStory, updateStory, deleteStory } from '../../api/starStories';

const COMPETENCIES = [
  'Leadership', 'Problem Solving', 'Communication', 'Teamwork', 'Initiative',
  'Conflict Resolution', 'Client Management', 'Stakeholder Management',
  'Data Analysis', 'Project Management', 'Adaptability', 'Other',
];

const EMPTY = { title: '', competency: '', situation: '', task: '', action: '', result: '', tags: '' };

function StoryCard({ story, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm text-gray-900 dark:text-gray-100">{story.title}</p>
          {story.competency && (
            <span className="inline-block mt-0.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {story.competency}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 dark:border-gray-800">
          {[['Situation', story.situation], ['Task', story.task], ['Action', story.action], ['Result', story.result]].map(([label, val]) =>
            val ? (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{val}</p>
              </div>
            ) : null
          )}
          {story.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {story.tags.map((t) => (
                <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{t}</span>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => onEdit(story)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              <Edit2 className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => onDelete(story._id)} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ta = (label, key, rows = 3) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <textarea rows={rows} value={form[key]} onChange={set(key)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        placeholder={`Describe the ${label.toLowerCase()}…`}
      />
    </div>
  );

  const submit = async () => {
    if (!form.title.trim()) return toast.error('Title required');
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] };
      await onSave(payload);
      onClose();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="star-stories-story-title" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Story title *</label>
        <input id="star-stories-story-title" value={form.title} onChange={set('title')} placeholder="e.g. Led cross-functional team during ERP migration"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label htmlFor="star-stories-competency" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Competency</label>
        <select id="star-stories-competency" value={form.competency} onChange={set('competency')}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Select competency</option>
          {COMPETENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {ta('Situation — what was the context?', 'situation')}
      {ta('Task — what was your responsibility?', 'task')}
      {ta('Action — what did you specifically do?', 'action', 4)}
      {ta('Result — what was the measurable outcome?', 'result')}
      <div>
        <label htmlFor="star-stories-tags-comma-separated" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tags (comma-separated)</label>
        <input id="star-stories-tags-comma-separated" value={form.tags} onChange={set('tags')} placeholder="e.g. cross-functional, cost reduction, agile"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
        <button onClick={submit} disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >{saving ? 'Saving…' : 'Save story'}</button>
      </div>
    </div>
  );
}

export default function StarStoriesPage() {
  useDocumentTitle('STAR Story Bank');
  const [stories, setStories] = useState(null);
  const [modal, setModal] = useState(null); // null | 'new' | story-object

  const load = () => listStories().then((r) => setStories(r.data)).catch(() => setStories([]));
  useEffect(() => { load(); }, []);

  const handleSave = async (payload) => {
    if (modal === 'new') {
      await createStory(payload);
      toast.success('Story saved');
    } else {
      await updateStory(modal._id, payload);
      toast.success('Story updated');
    }
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this story?')) return;
    await deleteStory(id);
    toast.success('Deleted');
    load();
  };

  return (
    <Page bare>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <PageHeader
          title="STAR Story Bank"
          subtitle="Your prior work experience, structured for behavioral interviews. One story = one interview answer."
        />

        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 dark:bg-indigo-950/30 dark:border-indigo-900/40">
          <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-1">What is a STAR story?</p>
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            <strong>S</strong>ituation → <strong>T</strong>ask → <strong>A</strong>ction → <strong>R</strong>esult.
            Every behavioral question (&ldquo;Tell me about a time…&rdquo;) is best answered this way.
            Build your bank now, polish under pressure later.
          </p>
        </div>

        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Add story
        </button>

        {stories === null ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <BookOpen className="h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">No stories yet</p>
            <p className="text-xs text-gray-400">Add your first work experience story — it&rsquo;ll pay off in every HR round.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((s) => (
              <StoryCard key={s._id} story={s} onEdit={(s) => setModal(s)} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {modal && (
          <Modal
            open
            onClose={() => setModal(null)}
            title={modal === 'new' ? 'New STAR story' : 'Edit story'}
            size="lg"
          >
            <StoryForm
              initial={modal === 'new' ? null : { ...modal, tags: modal.tags?.join(', ') || '' }}
              onSave={handleSave}
              onClose={() => setModal(null)}
            />
          </Modal>
        )}
      </div>
    </Page>
  );
}
