import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Check, X, Loader2, AlertTriangle, Mail, CheckCircle2 } from 'lucide-react';
import toast from '../../utils/toast';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { AdminShell, inputClass } from './shared';
import { RowSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import useAsync from '../../hooks/useAsync';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../utils/dateUtils';
import {
  listPendingPrograms, approveProgram, rejectProgram, getProgramSyncStatus,
} from '../../api/admin';

// Must stay in step with STEPS in server/services/programSyncService.js. The
// labels are what each step actually does, not its variable name — an admin
// watching this needs to know what is being tagged, not which runner is up.
const STEP_LABEL = {
  registry:  'Program registry',
  news:      'News categories',
  companies: 'Company prep cards',
  career:    'Career paths',
  community: 'Community scope',
  study:     'Study resources',
};
const STEP_ORDER = ['registry', 'news', 'companies', 'career', 'community', 'study'];

function StepRow({ step }) {
  const done = step.status === 'completed';
  const failed = step.status === 'failed';
  const running = step.status === 'in_progress';
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-4 shrink-0">
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        {failed && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        {running && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
        {!done && !failed && !running && <span className="block h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />}
      </span>
      <span className={failed ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
        {STEP_LABEL[step.component] || step.component}
      </span>
      {done && step.count > 0 && (
        <span className="text-gray-400">· {step.count} tagged</span>
      )}
      {failed && step.error && (
        <span className="truncate text-red-500" title={step.error}>· {step.error}</span>
      )}
    </li>
  );
}

/**
 * The sync an approval starts, watched while it runs.
 *
 * approve() returns as soon as the sync is queued and the row leaves the
 * pending list, so without this the admin approves and the thing they were
 * told to watch disappears. Polling stops the moment the sync reaches a
 * terminal state — there is nothing further to learn after that.
 */
function SyncProgress({ approvalId, label, onDone }) {
  const [sync, setSync] = useState(null);
  const [error, setError] = useState(false);
  // Flipped once polling has stopped, so the "did not go out" line is only ever
  // shown about a settled state rather than about a gap we happened to read.
  const [emailSettled, setEmailSettled] = useState(false);

  const poll = useCallback(async () => {
    try {
      const { data } = await getProgramSyncStatus(approvalId);
      setSync(data);
      return { status: data.status, emailSent: data.emailSent };
    } catch {
      setError(true);
      return { status: 'failed', emailSent: false };
    }
  }, [approvalId]);

  useEffect(() => {
    let active = true;
    let timer;
    // runProgramSync writes syncStatus='completed' and only then sends the
    // "your program is ready" mail, so the flag lands after the status does.
    // Stopping on 'completed' read that gap and reported a mail that had gone
    // out as one that had not. A few extra passes close it without spinning
    // forever when the mail genuinely failed.
    let confirmations = 0;
    const CONFIRMATIONS_AFTER_DONE = 3;

    const tick = async () => {
      const { status, emailSent } = await poll();
      if (!active) return;

      const terminal = status === 'completed' || status === 'failed';
      // A failed sync never reaches the mail step, so there is nothing to wait
      // for there.
      const settled = status === 'failed' || emailSent || confirmations >= CONFIRMATIONS_AFTER_DONE;

      if (terminal && settled) { setEmailSettled(true); onDone?.(status); return; }
      if (terminal) confirmations += 1;
      timer = setTimeout(tick, terminal ? 1500 : 2000);
    };
    tick();
    return () => { active = false; clearTimeout(timer); };
  }, [poll, onDone]);

  const steps = STEP_ORDER.map(
    (c) => (sync?.progress || []).find((s) => s.component === c) || { component: c, status: 'pending', count: 0 },
  );

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="font-medium">{label}</p>
        {sync?.status === 'completed' ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Sync complete
          </span>
        ) : sync?.status === 'failed' || error ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
            Sync failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Syncing
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => <StepRow key={s.component} step={s} />)}
      </ul>

      {sync?.status === 'completed' && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Mail className="h-3.5 w-3.5" />
          {sync.emailSent
            ? 'The student has been emailed that their program is ready.'
            : emailSettled
              ? 'Content is live, but the "program is ready" email did not go out.'
              : 'Content is live. Confirming the notification email…'}
        </p>
      )}
      {(sync?.status === 'failed' || error) && (
        <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400">
          The program is approved and the student is admitted — only the content tagging stopped.
          Re-running it needs a fix on the server; nothing here will retry it.
        </p>
      )}
    </div>
  );
}

export default function AdminProgramsPage() {
  useDocumentTitle('Program approvals');
  const { data, error, loading, reload } = useAsync(() => listPendingPrograms(), []);
  // Approvals decided in this visit. The server lists only pending ones, so
  // without holding them here an approval would vanish mid-sync.
  const [syncing, setSyncing] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState(null);

  const onApprove = async (a) => {
    setBusyId(a._id);
    try {
      await approveProgram(a._id);
      toast.success(`${a.programLabel} approved — tagging content now`);
      setSyncing((prev) => [{ id: a._id, label: a.programLabel }, ...prev]);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Could not approve it');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async () => {
    const a = rejecting;
    setBusyId(a._id);
    try {
      await rejectProgram(a._id, reason.trim() || undefined);
      toast.success(`${a.programLabel} rejected`);
      setRejecting(null);
      setReason('');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not reject it');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell
      title="Program approvals"
      icon={GraduationCap}
      subtitle="Students who signed up with a program nobody has curated yet. They are already admitted — this decides whether their program gets its own feed."
    >
      {syncing.length > 0 && (
        <section className="mb-6 space-y-3">
          {syncing.map((s) => (
            <SyncProgress key={s.id} approvalId={s.id} label={s.label} />
          ))}
        </section>
      )}

      {loading ? (
        <RowSkeleton count={3} />
      ) : error ? (
        <ErrorState title="Could not load approvals" onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Nothing waiting"
          subtitle="Custom-program signups land here. Preset programs are curated already and never queue."
        />
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li
              key={a._id}
              className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{a.programLabel}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {a.programType}
                </span>
                <span className="font-mono text-[10px] text-gray-400">{a.programId}</span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Requested by {a.requestedBy?.name}
                {a.requestedBy?.email ? ` · ${a.requestedBy.email}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(a.createdAt)}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={Check} disabled={busyId === a._id} onClick={() => onApprove(a)}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={X}
                  disabled={busyId === a._id}
                  onClick={() => { setRejecting(a); setReason(''); }}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.programLabel || ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The student keeps their account and their program label. Rejecting means DATAD will not
            build a curated feed for it — they stay on the general one.
          </p>
          <div>
            <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium">
              Reason <span className="text-gray-400">(optional, stored on the record)</span>
            </label>
            <input
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Folded into the existing Design program"
              className={inputClass}
            />
          </div>
          <Button fullWidth disabled={busyId === rejecting?._id} onClick={onReject}>
            {busyId === rejecting?._id ? 'Rejecting…' : 'Reject program'}
          </Button>
        </div>
      </Modal>
    </AdminShell>
  );
}
