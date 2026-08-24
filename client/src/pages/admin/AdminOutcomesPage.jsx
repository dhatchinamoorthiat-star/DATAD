import { useMemo, useState } from 'react';
import { Trophy, Plus, BadgeCheck, Pencil, Building2 } from 'lucide-react';
import toast from '../../utils/toast';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { AdminShell, inputClass } from './shared';
import { RowSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import useAsync from '../../hooks/useAsync';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/dateUtils';
import {
  listOutcomes, getOutcomeStats, createOutcome, updateOutcome, listStudents,
} from '../../api/admin';

// Mirrors the enums on server/models/PlacementOutcome.js.
//
// `gdk` is left as "GD" deliberately: the value appears nowhere in this repo
// except that enum, so its full expansion is undocumented. Labelling it with a
// guess would put a made-up stage name on real placement records.
const STAGES = [
  { value: 'applied', label: 'Applied' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'gdk', label: 'GD' },
  { value: 'interview', label: 'Interview' },
  { value: 'final-round', label: 'Final round' },
  { value: 'offered', label: 'Offered' },
  { value: 'rejected', label: 'Rejected' },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));

const OUTCOMES = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'offer_received', label: 'Offer received' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrew', label: 'Withdrew' },
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label]));
const OUTCOME_CLASS = {
  offer_received: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  withdrew: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function AdminOutcomesPage() {
  useDocumentTitle('Placement outcomes');
  const [company, setCompany] = useState('');
  const [outcome, setOutcome] = useState('');
  const [verified, setVerified] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const params = useMemo(() => ({
    company: company.trim() || undefined,
    outcome: outcome || undefined,
    verified: verified || undefined,
  }), [company, outcome, verified]);

  const { data, error, loading, reload } = useAsync(() => listOutcomes(params), [params]);
  const { data: statsRes, reload: reloadStats } = useAsync(() => getOutcomeStats(), []);

  // Memoised so the fallback array is not a fresh identity each render, which
  // would re-run the roll-up below on every one.
  const stats = useMemo(() => statsRes?.stats || [], [statsRes]);
  const roll = useMemo(() => {
    const total = stats.reduce((s, c) => s + c.total, 0);
    const offers = stats.reduce((s, c) => s + c.offers, 0);
    return { total, offers, companies: stats.length, rate: total ? Math.round((offers / total) * 100) : 0 };
  }, [stats]);

  const refreshAll = () => { reload(); reloadStats(); };

  const onVerify = async (row, next) => {
    setBusyId(row._id);
    try {
      await updateOutcome(row._id, { verified: next });
      toast.success(next ? 'Marked verified' : 'Verification removed');
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update it');
    } finally {
      setBusyId(null);
    }
  };

  const outcomes = data?.outcomes || [];

  return (
    <AdminShell
      title="Placement outcomes"
      icon={Trophy}
      subtitle="Who applied where, and how it ended. Individual rows stay between the student and the placement office — only aggregates go anywhere else."
    >
      <div className="mb-4 flex items-center justify-end">
        <Button size="sm" icon={Plus} onClick={() => setRecordOpen(true)}>Record outcome</Button>
      </div>

      {stats.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Outcomes" value={roll.total} />
          <Stat label="Offers" value={roll.offers} />
          <Stat label="Offer rate" value={`${roll.rate}%`} hint="offers ÷ all outcomes" />
          <Stat label="Companies" value={roll.companies} />
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Filter by company…"
          aria-label="Filter by company"
          className={inputClass}
        />
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Filter by outcome" className={inputClass}>
          <option value="">Any outcome</option>
          {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={verified} onChange={(e) => setVerified(e.target.value)} aria-label="Filter by verification" className={inputClass}>
          <option value="">Verified or not</option>
          <option value="true">Verified only</option>
          <option value="false">Unverified only</option>
        </select>
      </div>

      {loading ? (
        <RowSkeleton count={4} />
      ) : error ? (
        <ErrorState title="Could not load outcomes" onRetry={reload} />
      ) : outcomes.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={company || outcome || verified ? 'Nothing matches those filters' : 'No outcomes recorded yet'}
          subtitle={
            company || outcome || verified
              ? 'Clear a filter to see the rest.'
              : 'Record one as soon as a result is known — a gap here cannot be filled in later.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {outcomes.map((row) => (
            <li key={row._id} className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${OUTCOME_CLASS[row.outcome] || ''}`}>
                  {OUTCOME_LABEL[row.outcome] || row.outcome}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {STAGE_LABEL[row.stageReached] || row.stageReached}
                </span>
                {row.offerAccepted && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    Accepted
                  </span>
                )}
                {row.verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-400">{formatDate(row.placementDate)}</span>
              </div>

              <p className="mt-1 font-medium">
                {row.company} · <span className="font-normal text-gray-600 dark:text-gray-400">{row.role}</span>
              </p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {row.user?.name || 'Unknown student'}
                {row.user?.rollNumber ? ` · ${row.user.rollNumber}` : ''}
                {row.package ? ` · ${row.package}` : ''}
              </p>
              {row.notes && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500 dark:text-gray-400">{row.notes}</p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(row)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={BadgeCheck}
                  disabled={busyId === row._id}
                  onClick={() => onVerify(row, !row.verified)}
                >
                  {row.verified ? 'Unverify' : 'Verify'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {stats.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4 text-gray-400" /> By company
          </h2>
          <ul className="space-y-1.5">
            {stats.map((c) => (
              <li
                key={c._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm dark:border-gray-800/80 dark:bg-gray-900"
              >
                <span className="font-medium">{c._id}</span>
                <span className="text-xs text-gray-400">{c.total} outcome{c.total === 1 ? '' : 's'}</span>
                <span className="ml-auto flex gap-3 text-xs">
                  <span className="text-green-600 dark:text-green-400">{c.offers} offer{c.offers === 1 ? '' : 's'}</span>
                  <span className="text-red-600 dark:text-red-400">{c.rejections} rejected</span>
                  <span className="text-amber-600 dark:text-amber-400">{c.inProgress} open</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecordModal open={recordOpen} onClose={() => setRecordOpen(false)} onSaved={refreshAll} />
      <EditModal row={editing} onClose={() => setEditing(null)} onSaved={refreshAll} />
    </AdminShell>
  );
}

function RecordModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    userId: '', company: '', role: '', stageReached: 'applied',
    outcome: 'in_progress', package: '', notes: '', offerAccepted: false,
  });
  const [saving, setSaving] = useState(false);
  // Only fetched while the modal is open — the roster is not needed to read the
  // page, and it is the largest payload on it.
  const { data: students } = useAsync(() => (open ? listStudents() : Promise.resolve({ data: [] })), [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createOutcome(form);
      toast.success('Outcome recorded');
      setForm({ userId: '', company: '', role: '', stageReached: 'applied', outcome: 'in_progress', package: '', notes: '', offerAccepted: false });
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record it');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record a placement outcome">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="oc-student" className="mb-1 block text-sm font-medium">Student</label>
          <select id="oc-student" required value={form.userId} onChange={(e) => set('userId', e.target.value)} className={inputClass}>
            <option value="">Choose a student…</option>
            {(students || []).map((s) => (
              <option key={s._id} value={s._id}>{s.name} — {s.email}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="oc-company" className="mb-1 block text-sm font-medium">Company</label>
            <input id="oc-company" required value={form.company} onChange={(e) => set('company', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="oc-role" className="mb-1 block text-sm font-medium">Role</label>
            <input id="oc-role" required value={form.role} onChange={(e) => set('role', e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="oc-stage" className="mb-1 block text-sm font-medium">Stage reached</label>
            <select id="oc-stage" value={form.stageReached} onChange={(e) => set('stageReached', e.target.value)} className={inputClass}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="oc-outcome" className="mb-1 block text-sm font-medium">Outcome</label>
            <select id="oc-outcome" value={form.outcome} onChange={(e) => set('outcome', e.target.value)} className={inputClass}>
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="oc-package" className="mb-1 block text-sm font-medium">
            Package <span className="text-gray-400">(optional, free text)</span>
          </label>
          <input id="oc-package" value={form.package} onChange={(e) => set('package', e.target.value)} placeholder="e.g. 12 LPA" className={inputClass} />
        </div>
        <div>
          <label htmlFor="oc-notes" className="mb-1 block text-sm font-medium">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea id="oc-notes" rows={2} maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </div>
        {form.outcome === 'offer_received' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.offerAccepted} onChange={(e) => set('offerAccepted', e.target.checked)} />
            The student accepted this offer
          </label>
        )}
        <p className="text-xs text-gray-400">Recorded by you, so it is saved as verified.</p>
        <Button type="submit" fullWidth disabled={saving}>{saving ? 'Saving…' : 'Record outcome'}</Button>
      </form>
    </Modal>
  );
}

function EditModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Seed from the row the first time it opens, then let the form own its state.
  const current = form && form._id === row?._id ? form : row && {
    _id: row._id,
    stageReached: row.stageReached,
    outcome: row.outcome,
    package: row.package || '',
    notes: row.notes || '',
    offerAccepted: Boolean(row.offerAccepted),
  };

  const set = (k, v) => setForm({ ...current, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { _id, ...body } = current;
      await updateOutcome(_id, body);
      toast.success('Outcome updated');
      setForm(null);
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update it');
    } finally {
      setSaving(false);
    }
  };

  if (!row || !current) return null;

  return (
    <Modal open={!!row} onClose={() => { setForm(null); onClose(); }} title={`${row.company} · ${row.role}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ed-stage" className="mb-1 block text-sm font-medium">Stage reached</label>
            <select id="ed-stage" value={current.stageReached} onChange={(e) => set('stageReached', e.target.value)} className={inputClass}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ed-outcome" className="mb-1 block text-sm font-medium">Outcome</label>
            <select id="ed-outcome" value={current.outcome} onChange={(e) => set('outcome', e.target.value)} className={inputClass}>
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="ed-package" className="mb-1 block text-sm font-medium">Package</label>
          <input id="ed-package" value={current.package} onChange={(e) => set('package', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ed-notes" className="mb-1 block text-sm font-medium">Notes</label>
          <textarea id="ed-notes" rows={2} maxLength={500} value={current.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </div>
        {current.outcome === 'offer_received' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={current.offerAccepted} onChange={(e) => set('offerAccepted', e.target.checked)} />
            The student accepted this offer
          </label>
        )}
        <Button type="submit" fullWidth disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </form>
    </Modal>
  );
}
