/**
 * Dax Profile Panel — "Here's what I know about you."
 *
 * Purpose: Shows the student everything Dax knows about them, in one place.
 * Every data point is either editable (career preferences) or observed
 * (strengths, weaknesses, stats). This satisfies Product Constitution P3:
 * "Every piece of data Dax uses about a student must be visible."
 *
 * Design: Read-only intelligence summary on top, editable memory fields below.
 * One component, two sections — no tabs, no modal nesting.
 */
import { useEffect, useState } from 'react';
import { Brain, Check, Trash2, Trophy, Target, TrendingUp, BookOpen, Sparkles } from 'lucide-react';
import toast from '../../utils/toast';
import { getDaxMemory, updateDaxMemory, forgetDaxMemory } from '../../api/dax';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import { Skeleton } from './Skeleton';
import { DAX_CAPABILITY } from '../../utils/dax';

const EXPLANATION_STYLES = [
  { value: 'concise',         label: 'Concise' },
  { value: 'detailed',        label: 'Detailed' },
  { value: 'framework-heavy', label: 'Framework-heavy' },
  { value: 'example-heavy',   label: 'Example-heavy' },
];

const asList = (v) => (Array.isArray(v) ? v.join(', ') : '');
const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

function Row({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
        <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function TagList({ items, empty = 'None yet', color = 'gray' }) {
  if (!items?.length) return <span className="text-xs text-gray-400">{empty}</span>;
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className={`rounded-full px-2.5 py-1 text-[11px] ${colorMap[color] || colorMap.gray}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function DaxProfilePanel() {
  const [mem, setMem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [form, setForm] = useState({
    specialization: '',
    careerInterests: '',
    targetCompanies: '',
    targetRoles: '',
    preferredExplanationStyle: 'concise',
  });

  const hydrate = (m) => {
    setMem(m);
    setForm({
      specialization: m?.specialization || '',
      careerInterests: asList(m?.careerInterests),
      targetCompanies: asList(m?.targetCompanies),
      targetRoles: asList(m?.targetRoles),
      preferredExplanationStyle: m?.preferredExplanationStyle || 'concise',
    });
  };

  useEffect(() => {
    getDaxMemory()
      .then((r) => hydrate(r.data))
      .catch(() => toast.error('Could not load what Dax remembers'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateDaxMemory({
        specialization: form.specialization || undefined,
        careerInterests: toList(form.careerInterests),
        targetCompanies: toList(form.targetCompanies),
        targetRoles: toList(form.targetRoles),
        preferredExplanationStyle: form.preferredExplanationStyle,
      });
      const r = await getDaxMemory();
      hydrate(r.data);
      toast.success('Dax updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update Dax');
    } finally {
      setSaving(false);
    }
  };

  const forget = async () => {
    try {
      await forgetDaxMemory();
      const r = await getDaxMemory();
      hydrate(r.data);
      toast.success('Dax has forgotten what it learned');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not clear memory');
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Brain className="h-4 w-4 text-indigo-500" /> {DAX_CAPABILITY.memory}
      </h2>
      <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
        What Dax knows about you — your goals, progress, and preferences.
        Everything here is either something you told Dax or something it observed from your activity.
      </p>

      {/* ── Section 1: Readiness & Stats ───────────────────────────────── */}
      <div className="mb-5 flex flex-wrap gap-4">
        {mem?.readinessScore != null && (
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-sm">
              {mem.readinessScore}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Readiness</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mem.readinessScore >= 75 ? 'On track' : mem.readinessScore >= 50 ? 'Building momentum' : 'Getting started'}
              </p>
              {mem.readinessUpdatedAt && (
                <p className="mt-0.5 text-[10px] text-gray-400">
                  Updated {new Date(mem.readinessUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-1 flex-wrap gap-2">
          <StatTile icon={Trophy} label="Tasks done" value={mem?.tasksCompletedCount ?? 0} />
          <StatTile icon={BookOpen} label="Notes saved" value={mem?.notesCount ?? 0} />
          {mem?.resumeCompletionPct != null && (
            <StatTile icon={TrendingUp} label="Resume" value={`${mem.resumeCompletionPct}%`} />
          )}
        </div>
      </div>

      {/* ── Section 2: Strengths & Weaknesses ──────────────────────────── */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-500" /> Strengths
          </p>
          <TagList items={mem?.strengths} empty="Still learning what you're great at" color="emerald" />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Target className="h-3 w-3 text-amber-500" /> Areas to grow
          </p>
          <TagList items={mem?.weaknesses} empty="None identified yet — keep going" color="amber" />
        </div>
      </div>

      {/* ── Section 3: Career Context ──────────────────────────────────── */}
      {mem?.careerInterests?.length > 0 || mem?.targetCompanies?.length > 0 ? (
        <div className="mb-5 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50">
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Career context</p>
          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
            {mem.careerInterests?.length > 0 && (
              <p>Interested in <span className="font-medium">{mem.careerInterests.join(', ')}</span></p>
            )}
            {mem.targetRoles?.length > 0 && (
              <p>Targeting <span className="font-medium">{mem.targetRoles.join(', ')}</span></p>
            )}
            {mem.targetCompanies?.length > 0 && (
              <p>Looking at <span className="font-medium">{mem.targetCompanies.join(', ')}</span></p>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Section 4: Recent Topics ────────────────────────────────────── */}
      {mem?.recentTopics?.length > 0 && (
        <div className="mb-5">
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Recently discussed</p>
          <div className="flex flex-wrap gap-1.5">
            {mem.recentTopics.slice(-5).reverse().map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="max-w-full truncate rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                title={t}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 5: Editable preferences ────────────────────────────── */}
      <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <p className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">Your preferences</p>
        <div className="space-y-3">
          <Row label="Specialization">
            <input
              className="input"
              value={form.specialization}
              placeholder="e.g. Consulting"
              onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
            />
          </Row>
          <Row label="Career interests">
            <input
              className="input"
              value={form.careerInterests}
              placeholder="Comma separated — e.g. strategy, product"
              onChange={(e) => setForm((f) => ({ ...f, careerInterests: e.target.value }))}
            />
          </Row>
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Target companies">
              <input
                className="input"
                value={form.targetCompanies}
                placeholder="e.g. Bain, McKinsey"
                onChange={(e) => setForm((f) => ({ ...f, targetCompanies: e.target.value }))}
              />
            </Row>
            <Row label="Target roles">
              <input
                className="input"
                value={form.targetRoles}
                placeholder="e.g. Associate Consultant"
                onChange={(e) => setForm((f) => ({ ...f, targetRoles: e.target.value }))}
              />
            </Row>
          </div>
          <Row label="How Dax should explain things">
            <select
              className="input"
              value={form.preferredExplanationStyle}
              onChange={(e) => setForm((f) => ({ ...f, preferredExplanationStyle: e.target.value }))}
            >
              {EXPLANATION_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Row>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button icon={Check} loading={saving} onClick={save}>Save</Button>
          <Button variant="ghost" icon={Trash2} onClick={() => setConfirmForget(true)}>
            Make Dax forget
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirmForget}
        onClose={() => setConfirmForget(false)}
        onConfirm={forget}
        title="Make Dax forget?"
        message="Dax will drop what it has learned and inferred about you. It will start over from your profile, resume and activity — your notes, tasks and resume are not touched."
        danger
        confirmLabel="Forget"
      />
    </section>
  );
}
