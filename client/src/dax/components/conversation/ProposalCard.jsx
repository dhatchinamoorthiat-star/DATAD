import { useState } from 'react';
import { Check, X, Undo2, Loader2, AlertTriangle } from 'lucide-react';
import { confirmProposal, rejectProposal, undoProposal } from '../../../api/dax';
import useNow from '../../../hooks/useNow';

// The confirmation surface for a write Dax has proposed but not performed.
// Nothing has been changed in the student's data at the point this renders —
// the Confirm button is the only path by which it ever will be.

const STATUS_LABEL = {
  executed: 'Done',
  partial: 'Partly done',
  rejected: 'Dismissed',
  expired: 'Expired',
  undone: 'Undone',
};

// After confirming, the student needs to see that it actually happened and
// what changed — a bare "Done" label left them unsure whether the interview had
// really been scheduled. Executed actions therefore switch to the server's
// past-tense wording and a filled check, so the card reads as an outcome rather
// than as a still-pending suggestion.
const SUCCEEDED = new Set(['executed', 'partial']);

export default function ProposalCard({ proposal, onUpdate }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(proposal);
  // Ticks so the undo window closes on screen instead of only on the next render.
  const now = useNow(1000);

  const status = current?.status;
  const isPending = status === 'pending';
  const succeeded = SUCCEEDED.has(status);
  const canUndo =
    (status === 'executed' || status === 'partial') &&
    current.undoableUntil &&
    new Date(current.undoableUntil).getTime() > now;

  async function run(action, fn) {
    setBusy(action);
    setError(null);
    try {
      const { data } = await fn(current._id);
      const next = data.proposal || current;
      setCurrent(next);
      onUpdate?.(next);
    } catch (err) {
      setError(err?.response?.data?.message || 'That did not go through.');
    } finally {
      setBusy(null);
    }
  }

  if (!current?.actions?.length) return null;

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[var(--dax-border)] bg-[var(--dax-surface)]">
      <div className="px-4 pt-3 pb-2">
        <p
          className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
            succeeded ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--dax-text-faint)]'
          }`}
        >
          {succeeded && <Check className="h-3.5 w-3.5" aria-hidden />}
          {isPending ? 'Dax suggests' : STATUS_LABEL[status] || status}
        </p>
        <ul className="mt-2 space-y-1.5">
          {current.actions.map((a) => {
            const done = a.status === 'executed';
            return (
              <li key={a._id} className="flex items-start gap-2 text-sm text-[var(--dax-text)]">
                {done ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dax-accent)]"
                  />
                )}
                <span className="min-w-0">
                  {/* Both wordings come from the server's validated values, not
                      from model output, so the line states what actually
                      happened rather than what the model claimed. */}
                  {done ? a.doneSummary || a.summary : a.summary}
                  {a.status === 'failed' && (
                    <span className="ml-1 text-[var(--dax-text-faint)]">— couldn’t be done</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 px-4 pb-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {(isPending || canUndo) && (
        <div className="flex items-center gap-2 border-t border-[var(--dax-border)] px-3 py-2">
          {isPending ? (
            <>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => run('confirm', confirmProposal)}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--dax-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dax-accent-contrast)] transition-opacity disabled:opacity-50"
              >
                {busy === 'confirm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => run('reject', rejectProposal)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dax-text-muted)] transition-colors hover:bg-[var(--dax-surface-hover)] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => run('undo', undoProposal)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dax-text-muted)] transition-colors hover:bg-[var(--dax-surface-hover)] disabled:opacity-50"
            >
              {busy === 'undo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
