import { useEffect, useState } from 'react';
import toast from '../../utils/toast';
import { BrainCircuit, Loader2, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { listCases, createCase, updateCase, deleteCase } from '../../api/dailyCase';
import { generateFramework } from '../../api/dax';
import DateInput from '../../components/common/DateInput';
import { AdminShell, inputClass } from './shared';
import Loader from '../../components/common/Loader';
import ConfirmModal from '../../components/common/ConfirmModal';

const CATEGORIES = ['strategy', 'marketing', 'operations', 'finance', 'hr', 'guesstimate', 'other'];

const emptyForm = {
  dateKey: new Date().toISOString().slice(0, 10),
  title: '',
  category: 'strategy',
  scenario: '',
  question: '',
  framework: '',
};

export default function AdminCasesPage() {
  const [cases, setCases] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null); // null = create mode
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = () => listCases().then((res) => setCases(res.data));
  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const startEdit = (c) => {
    setForm({
      dateKey: c.dateKey,
      title: c.title,
      category: c.category,
      scenario: c.scenario,
      question: c.question,
      framework: c.framework || '',
    });
    setEditingId(c._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleGenerate = async () => {
    if (!form.title || !form.scenario || !form.question) {
      toast.error('Fill in title, scenario, and question first');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateFramework({
        title: form.title,
        category: form.category,
        scenario: form.scenario,
        question: form.question,
      });
      setForm((f) => ({ ...f, framework: res.data.framework }));
      toast.success('Framework generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dax could not generate this case');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateCase(editingId, form);
        toast.success('Case updated');
      } else {
        await createCase(form);
        toast.success('Daily case published');
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the case');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteCase(id);
    if (editingId === id) cancelEdit();
    toast.success('Case deleted');
    load();
  };

  if (!cases) return <Loader />;

  return (
    <AdminShell
      title="Daily MBA cases"
      icon={BrainCircuit}
      subtitle="One mini case per day — the morning habit anchor on every student's dashboard."
    >
      <form onSubmit={handleSubmit} className="mb-8 space-y-3 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        {editingId && (
          <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            <span>Editing existing case</span>
            <button type="button" onClick={cancelEdit} className="flex items-center gap-1 hover:text-indigo-900 dark:hover:text-indigo-100">
              <X className="h-3.5 w-3.5" /> Cancel edit
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <DateInput required value={form.dateKey} onChange={set('dateKey')} />
          <select value={form.category} onChange={set('category')} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={set('title')}
            placeholder="Case title"
            className={`${inputClass} sm:col-span-1`}
          />
        </div>
        <textarea required rows={4} maxLength={4000} value={form.scenario} onChange={set('scenario')} placeholder="Scenario — the business situation in 3-6 sentences" className={inputClass} />
        <textarea required rows={2} maxLength={1000} value={form.question} onChange={set('question')} placeholder="The question students should think through" className={inputClass} />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">Suggested framework (revealed after they solve it)</span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800/60 dark:bg-violet-900/30 dark:text-violet-300"
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generating ? 'Dax is writing…' : 'Generate with Dax'}
            </button>
          </div>
          <textarea rows={4} maxLength={4000} value={form.framework} onChange={set('framework')} placeholder="Write your own or generate with Dax above" className={inputClass} />
        </div>
        <button
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (editingId ? 'Updating…' : 'Publishing…') : (editingId ? 'Update case' : 'Publish case')}
        </button>
      </form>

      {cases.length === 0 ? (
        <p className="text-sm text-gray-400">No cases yet — publish the first one above.</p>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li
              key={c._id}
              className={`flex items-start justify-between gap-3 rounded-2xl border bg-white p-4 dark:bg-gray-900 ${
                editingId === c._id
                  ? 'border-indigo-400 dark:border-indigo-600'
                  : 'border-gray-200/80 dark:border-gray-800/80'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-gray-400">{c.dateKey} · {c.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(c)}
                  aria-label="Edit case"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(c._id)}
                  aria-label="Delete case"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => handleDelete(confirmDeleteId)}
        title="Delete case"
        message="This daily case will be permanently deleted."
        danger
        confirmLabel="Delete"
      />
    </AdminShell>
  );
}
