import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle2, Circle, Clock, ArrowRight, Save, X, Sparkles, RefreshCw, Zap, Flame, Edit3 } from 'lucide-react';
import toast from '../../utils/toast';
import PageHeader from '../../components/common/PageHeader';
import SmartSelect from '../../components/common/SmartSelect';
import { Page } from '../../components/common/motion';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { getPivot, upsertPivot, updateGap, generateRoadmap as apiGenerateRoadmap, getRoadmapProgress } from '../../api/pivot';
import { getTodayLog, updateLog } from '../../api/studyTools';
import { track } from '../../utils/analytics';

const DOMAINS = ['IT / Software', 'Banking / Finance', 'Consulting', 'Manufacturing / Ops', 'Healthcare', 'FMCG / Retail', 'Govt / PSU', 'Media / Content', 'Startup'];

const GAP_STATUS = {
  'not-started': { icon: Circle,       label: 'Not started', color: 'text-gray-400' },
  'in-progress':  { icon: Clock,        label: 'In progress', color: 'text-amber-500' },
  'done':         { icon: CheckCircle2, label: 'Done',        color: 'text-emerald-500' },
};

const NEXT_STATUS = { 'not-started': 'in-progress', 'in-progress': 'done', 'done': 'not-started' };

const ITEM_TYPE_COLORS = {
  course:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  project:       'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  mentorship:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  certification: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  reading:       'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  practice:      'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  other:         'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
};

function GapItem({ gap, onToggle, onDelete, showType }) {
  const { icon: Icon, label, color } = GAP_STATUS[gap.status] || GAP_STATUS['not-started'];
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800">
      <button onClick={() => onToggle(gap._id, NEXT_STATUS[gap.status])} className={`mt-0.5 shrink-0 ${color} hover:opacity-70`} title={label}>
        <Icon className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${gap.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
          {gap.skill}
        </span>
        {showType && gap.itemType && (
          <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${ITEM_TYPE_COLORS[gap.itemType] || ITEM_TYPE_COLORS.other}`}>
            {gap.itemType}
          </span>
        )}
        {gap.link && (
          <a href={gap.link} target="_blank" rel="noopener noreferrer"
            className="ml-2 inline-block text-[10px] text-indigo-500 hover:underline">
            Resource &rarr;
          </a>
        )}
        {gap.notes && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{gap.notes}</p>
        )}
      </div>
      <button onClick={() => onDelete(gap._id)} className="shrink-0 text-gray-300 hover:text-red-400 dark:text-gray-700">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function PivotPage({ mode }) {
  const isRoadmap = mode === 'roadmap';
  useDocumentTitle(isRoadmap ? 'Skill Roadmap' : 'Career Pivot Tracker');

  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({});
  const [newGap, setNewGap] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Daily check-in state
  const [todayLog, setTodayLog] = useState(null);
  const [dailyNote, setDailyNote] = useState('');
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Weekly stats
  const [progress, setProgress] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getPivot().then((r) => {
      setPlan(r.data);
      setForm({
        fromDomain: r.data.fromDomain || '',
        fromRole: r.data.fromRole || '',
        fromYears: r.data.fromYears ?? '',
        toDomain: r.data.toDomain || '',
        toRole: r.data.toRole || '',
        motivation: r.data.motivation || '',
        targetCompanies: r.data.targetCompanies?.join(', ') || '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Scheduled, not called inline: the loader flips loading state
    // synchronously, which cascades an extra render from the effect body.
    queueMicrotask(load);
  }, [load]);

  // Load daily check-in and progress in roadmap mode
  useEffect(() => {
    if (!isRoadmap) return;
    getTodayLog().then((r) => {
      setTodayLog(r.data);
      setDailyNote(r.data.dailyNote || '');
    }).catch(() => {});
    getRoadmapProgress().then((r) => setProgress(r.data)).catch(() => {});
  }, [isRoadmap]);

  const saveCheckin = async () => {
    setSavingCheckin(true);
    try {
      const r = await updateLog({ dailyNote });
      setTodayLog(r.data);
      track('daily_checkin_added', { hasNote: !!dailyNote.trim() });
      toast.success('Check-in saved');
    } catch {
      toast.error('Failed to save check-in');
    } finally {
      setSavingCheckin(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    const targetRole = form.toRole || plan?.toRole || plan?.toDomain || '';
    if (!targetRole) {
      toast.error('Set a target role first');
      return;
    }
    setGenerating(true);
    try {
      const r = await apiGenerateRoadmap({ targetRole });
      setPlan(r.data.roadmap);
      track('roadmap_generated', {
        role: targetRole,
        gapCount: r.data.roadmap?.skillGaps?.length || 0,
        sourceCount: Object.keys(r.data.meta?.contextSources || {}).length,
      });
      toast.success('Roadmap generated!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate roadmap';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        fromYears: form.fromYears ? Number(form.fromYears) : undefined,
        targetCompanies: form.targetCompanies ? form.targetCompanies.split(',').map((s) => s.trim()).filter(Boolean) : [],
        skillGaps: plan?.skillGaps || [],
        planType: isRoadmap ? 'roadmap' : plan?.planType || 'pivot',
      };
      const r = await upsertPivot(payload);
      setPlan(r.data);
      setEditing(false);
      toast.success(isRoadmap ? 'Roadmap saved' : 'Pivot plan saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const addGap = async () => {
    if (!newGap.trim()) return;
    const gaps = [...(plan?.skillGaps || []), { skill: newGap.trim(), status: 'not-started' }];
    const r = await upsertPivot({ skillGaps: gaps });
    setPlan(r.data);
    setNewGap('');
  };

  const toggleGap = async (gapId, status) => {
    const r = await updateGap(gapId, status);
    setPlan(r.data);
    if (status === 'done') {
      const item = plan?.skillGaps?.find((g) => g._id === gapId);
      track('roadmap_item_completed', { skill: item?.skill || 'unknown' });
    }
    // Refresh progress after status change
    getRoadmapProgress().then((r) => setProgress(r.data)).catch(() => {});
  };

  const deleteGap = async (gapId) => {
    const gaps = plan.skillGaps.filter((g) => g._id !== gapId);
    const r = await upsertPivot({ skillGaps: gaps });
    setPlan(r.data);
  };

  const inp = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const done  = plan?.skillGaps?.filter((g) => g.status === 'done').length || 0;
  const total = plan?.skillGaps?.length || 0;

  const title = isRoadmap ? 'Skill Roadmap' : 'Career Pivot Tracker';
  const subtitle = isRoadmap
    ? 'Your personalised 3-month plan — know exactly what to learn next.'
    : 'From your current domain to your target role — map the gap, track the journey.';

  if (loading) {
    return (
      <Page bare>
        <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
          <PageHeader title={title} subtitle={subtitle} />
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page bare>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <PageHeader title={title} subtitle={subtitle} />

        {/* ── Roadmap Hero (roadmap mode only) ──────────────────────────── */}
        {isRoadmap && (
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-indigo-900/30 dark:from-indigo-950/30 dark:to-gray-900 space-y-4">
            {/* Target role & progress */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Target role</p>
                <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">
                  {plan?.toRole || form.toRole || 'Not set'}
                </p>
              </div>
              {progress && progress.total > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{progress.progress}%</p>
                  <p className="text-[10px] text-gray-400">complete</p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {(progress?.total || total) > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>{done} of {total} skills closed</span>
                  {progress?.inProgress > 0 && <span>{progress.inProgress} in progress</span>}
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {total === 0 && (
                <button onClick={handleGenerateRoadmap} disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                  <Sparkles className="h-3.5 w-3.5" />
                  {generating ? 'Generating…' : 'Generate my roadmap'}
                </button>
              )}
              {total > 0 && (
                <button onClick={handleGenerateRoadmap} disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 disabled:opacity-60">
                  <RefreshCw className="h-3 w-3" />
                  {generating ? 'Regenerating…' : 'Regenerate'}
                </button>
              )}
              <button onClick={() => setEditing((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Edit3 className="h-3 w-3" /> {editing ? 'Done' : 'Edit target'}
              </button>
            </div>
          </div>
        )}

        {/* ── Daily Check-in (roadmap mode only) ────────────────────────── */}
        {isRoadmap && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 dark:border-emerald-900/20 dark:bg-emerald-900/10 space-y-3">
            <div className="flex items-center gap-1.5">
              <Edit3 className="h-4 w-4 text-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Today&apos;s check-in</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">What did you work on today toward your skill roadmap?</p>
            <div className="flex gap-2">
              <input
                value={dailyNote}
                onChange={(e) => setDailyNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && saveCheckin()}
                placeholder="e.g. Completed TensorFlow tutorial, worked on ML project…"
                className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800 dark:bg-gray-900 dark:text-gray-100"
                maxLength={500}
              />
              <button onClick={saveCheckin} disabled={savingCheckin || !dailyNote.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {savingCheckin ? 'Saving…' : 'Log'}
              </button>
            </div>
            {todayLog?.studyMinutes > 0 && (
              <p className="text-[11px] text-gray-400">
                Studied {todayLog.studyMinutes} min today &middot; {todayLog.pomodoroCount || 0} pomodoros
              </p>
            )}
          </div>
        )}

        {/* ── Overview / Target Card ──────────────────────────────────── */}
        {/* In pivot mode: show the existing "from → to" overview + edit form */}
        {/* In roadmap mode: show the edit form when inline editing */}
        {(!isRoadmap || editing) && (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">{isRoadmap ? 'Target details' : 'Your pivot'}</h2>
              {!isRoadmap && (
                <button onClick={() => setEditing((v) => !v)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  {editing ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                {!isRoadmap && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <SmartSelect
                        options={DOMAINS}
                        value={form.fromDomain}
                        onChange={(val) => setForm((f) => ({ ...f, fromDomain: val }))}
                        label="Current domain"
                        placeholder="Select…"
                        allowOther={true}
                        variant="dropdown"
                        name="fromDomain"
                      />
                    </div>
                    <div>
                      <label htmlFor="pivot-current-role-title" className="block text-xs font-semibold text-gray-500 mb-1">Current role / title</label>
                      <input id="pivot-current-role-title" value={form.fromRole} onChange={set('fromRole')} placeholder="e.g. Software Engineer" className={inp} />
                    </div>
                  </div>
                )}
                {!isRoadmap && (
                  <div>
                    <label htmlFor="pivot-years-of-experience" className="block text-xs font-semibold text-gray-500 mb-1">Years of experience</label>
                    <input id="pivot-years-of-experience" type="number" min="0" max="20" value={form.fromYears} onChange={set('fromYears')} placeholder="e.g. 2.5" className={inp} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SmartSelect
                      options={DOMAINS}
                      value={form.toDomain}
                      onChange={(val) => setForm((f) => ({ ...f, toDomain: val }))}
                      label="Target domain"
                      placeholder="Select…"
                      allowOther={true}
                      variant="dropdown"
                      name="toDomain"
                    />
                  </div>
                  <div>
                    <label htmlFor="pivot-target-role" className="block text-xs font-semibold text-gray-500 mb-1">Target role</label>
                    <input id="pivot-target-role" value={form.toRole} onChange={set('toRole')} placeholder="e.g. Product Manager" className={inp} />
                  </div>
                </div>
                {!isRoadmap && (
                  <div>
                    <label htmlFor="pivot-why-this-move-your-pivot-narrative" className="block text-xs font-semibold text-gray-500 mb-1">Why this move? (your pivot narrative)</label>
                    <textarea id="pivot-why-this-move-your-pivot-narrative" rows={3} value={form.motivation} onChange={set('motivation')} placeholder="3–4 sentences you'd say in an interview…" className={inp} />
                  </div>
                )}
                <div>
                  <label htmlFor="pivot-target-companies-comma-separated" className="block text-xs font-semibold text-gray-500 mb-1">Target companies (comma-separated)</label>
                  <input id="pivot-target-companies-comma-separated" value={form.targetCompanies} onChange={set('targetCompanies')} placeholder="McKinsey, BCG, Amazon…" className={inp} />
                </div>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : !isRoadmap && (plan?.fromDomain || plan?.toDomain) ? (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">From</p>
                  <p className="font-semibold text-sm">{plan.fromDomain || '—'}</p>
                  {plan.fromRole && <p className="text-xs text-gray-500">{plan.fromRole}</p>}
                  {plan.fromYears ? <p className="text-xs text-gray-400">{plan.fromYears} yrs</p> : null}
                </div>
                <ArrowRight className="h-5 w-5 text-indigo-400 shrink-0" />
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">To</p>
                  <p className="font-semibold text-sm">{plan.toDomain || '—'}</p>
                  {plan.toRole && <p className="text-xs text-gray-500">{plan.toRole}</p>}
                </div>
              </div>
            ) : !isRoadmap ? (
              <p className="text-sm text-gray-400">Click Edit to set up your pivot.</p>
            ) : null}

            {!editing && !isRoadmap && plan?.motivation && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-semibold text-gray-400 mb-1">Your pivot narrative</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{plan.motivation}</p>
              </div>
            )}

            {!editing && plan?.targetCompanies?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {plan.targetCompanies.map((c) => (
                  <span key={c} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{c}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Skill gaps ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              {isRoadmap ? 'Your roadmap' : 'Skill gaps'}
            </h2>
            {total > 0 && (
              <span className="text-xs text-gray-400">{done}/{total} done</span>
            )}
          </div>
          {total > 0 && (
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          )}
          <div className="space-y-2">
            {plan?.skillGaps?.map((g) => (
              <GapItem key={g._id} gap={g} onToggle={toggleGap} onDelete={deleteGap} showType={isRoadmap} />
            ))}
          </div>
          {!isRoadmap && (
            <div className="flex gap-2">
              <input
                value={newGap}
                onChange={(e) => setNewGap(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGap()}
                placeholder="Add a skill gap (e.g. Excel modelling, case frameworks…)"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <button onClick={addGap} className="rounded-lg bg-gray-100 px-3 py-2 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── Weekly summary (roadmap mode only) ──────────────────────── */}
        {isRoadmap && todayLog && (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-3">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">This week</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{todayLog.studyMinutes || 0}</p>
                <p className="text-[10px] text-gray-400">min studied today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{todayLog.pomodoroCount || 0}</p>
                <p className="text-[10px] text-gray-400">pomodoros today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{progress?.completed || 0}</p>
                <p className="text-[10px] text-gray-400">roadmap items done</p>
              </div>
            </div>
            {(plan?.skillGaps?.length > 0) && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <Zap className="mr-1 inline h-3 w-3" />
                  Next up: <strong>{plan.skillGaps.find((g) => g.status !== 'done')?.skill || 'All done!'}</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
