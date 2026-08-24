import { useState } from 'react';
import { Newspaper, Send, Trash2, ShieldAlert, CheckCircle2, ArrowLeft, Users } from 'lucide-react';
import toast from '../../utils/toast';
import Button from '../../components/common/Button';
import ConfirmModal from '../../components/common/ConfirmModal';
import { AdminShell } from './shared';
import { RowSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import useAsync from '../../hooks/useAsync';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import {
  listNewsletterDrafts, getNewsletterDraft,
  sendNewsletterDraft, discardNewsletterDraft,
} from '../../api/admin';

// Mirrors the status enum on models/NewsletterDraft.js. `blocked` and `refused`
// are terminal by design — the server will not mail them at any approval level,
// so this page never offers a send for them.
const STATUS = {
  draft:    { label: 'Awaiting review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  blocked:  { label: 'Blocked',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  refused:  { label: 'Refused',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  sent:     { label: 'Sent',            cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  failed:   { label: 'Delivery failed', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}

function Violations({ violations, notes, title }) {
  if (!violations?.length && !notes) return null;
  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900/50 dark:bg-red-950/20">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
        <ShieldAlert className="h-4 w-4" /> {title}
      </p>
      {notes && <p className="mt-1 text-sm text-red-700/90 dark:text-red-300/90">{notes}</p>}
      {violations?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {violations.map((v, i) => (
            <li key={`${v.field}-${v.rule}-${i}`} className="text-xs text-red-700/90 dark:text-red-300/90">
              <span className="font-mono font-medium">{v.field}</span> · {v.rule} — {v.detail}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">
        This cannot be approved past. Regenerate the newsletter from Dax Automation instead.
      </p>
    </div>
  );
}

function DraftDetail({ id, onBack, onChanged }) {
  const { data, error, loading, reload } = useAsync(() => getNewsletterDraft(id), [id]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [sending, setSending] = useState(false);

  if (loading) return <RowSkeleton count={5} />;
  if (error) return <ErrorState title="Could not load this draft" onRetry={reload} />;

  const sections = Object.entries(data.sections || {}).filter(([, v]) => v);
  // Two independent gates, and both have to hold: the stored status, and the
  // verdict recomputed just now. The server checks again at send time — this
  // only decides whether offering the button is honest.
  const sendable = data.status === 'draft' && data.verdict?.ok;
  // Terminal per the model: sendDraft() refuses these at any approval level.
  const blockedByStatus = ['blocked', 'refused'].includes(data.status);

  const onSend = async () => {
    setSending(true);
    try {
      const { data: result } = await sendNewsletterDraft(id);
      const { sent = 0, failed = 0, skipped = 0 } = result.delivery || {};
      // The draft is marked sent whatever the transport did, so the toast has
      // to report delivery rather than approval. `skipped` means no mail
      // transport is configured — nothing left the building, and saying
      // "sent to N members" there would be the same lie this page exists to
      // stop the product telling.
      if (skipped) {
        toast.error(`Approved, but no mail was sent — no mail transport is configured (${skipped} skipped)`);
      } else if (failed) {
        toast.success(`Sent to ${sent} — ${failed} failed to deliver`);
      } else {
        toast.success(`Sent to ${sent || result.recipients} members`);
      }
      reload();
      onChanged?.();
    } catch (err) {
      const res = err.response?.data;
      toast.error(res?.message || 'Could not send it');
      // A 422 means the send-time re-validation blocked it — the stored status
      // has just changed underneath us, so the page must not keep showing a
      // send button.
      if (err.response?.status === 422 || err.response?.status === 409) { reload(); onChanged?.(); }
    } finally {
      setSending(false);
    }
  };

  const onDiscard = async () => {
    try {
      await discardNewsletterDraft(id);
      toast.success('Draft discarded');
      onChanged?.();
      onBack();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not discard it');
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" /> All drafts
      </button>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <StatusPill status={data.status} />
        <span className="text-xs text-gray-400">Week of {formatDate(data.weekStart)}</span>
        {data.model && <span className="text-xs text-gray-400">· {data.model}</span>}
      </div>

      {/* The mail as a student would receive it. Rendered as the mailer
          composes it — subject, then intro, sections and closing note joined —
          so review is of the actual message, not a summary of it. */}
      <article className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <h2 className="text-lg font-bold leading-snug">{data.subject}</h2>
        {data.preheader && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{data.preheader}</p>
        )}
        {data.headline && <p className="mt-3 font-semibold">{data.headline}</p>}
        {data.intro && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {data.intro}
          </p>
        )}
        {sections.map(([key, body]) => (
          <section key={key} className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{key}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {body}
            </p>
          </section>
        ))}
        {data.closingNote && (
          <p className="mt-4 whitespace-pre-wrap border-t border-gray-200 pt-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            {data.closingNote}
          </p>
        )}
      </article>

      {/* Two different reasons a draft can be un-sendable, and they do not always
          agree. `status` is what was recorded when it was generated or last
          blocked; `verdict` is the check re-run just now. A draft blocked under
          an older rule set can pass today's check — showing only the live
          verdict left those with no explanation at all on screen. */}
      {blockedByStatus && (
        <Violations
          title="This draft was blocked and cannot be sent"
          notes={data.guardNotes || 'No reason was recorded.'}
          violations={data.verdict?.ok === false ? data.verdict.violations : []}
        />
      )}
      {!blockedByStatus && data.verdict?.ok === false && (
        <Violations
          title="The content check rejected this"
          violations={data.verdict.violations}
          notes={data.guardNotes}
        />
      )}
      {data.verdict?.ok && data.status === 'draft' && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" /> Passed the content check. Your approval is what sends it.
        </p>
      )}

      {data.status === 'sent' ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Sent {data.sentAt ? formatDateTime(data.sentAt) : ''} to {data.recipientCount} member
          {data.recipientCount === 1 ? '' : 's'}
          {data.approvedBy?.name ? ` · approved by ${data.approvedBy.name}` : ''}.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {sendable && (
            <Button icon={Send} disabled={sending} onClick={() => setConfirmSend(true)}>
              {sending ? 'Sending…' : `Send to ${data.audienceSize} members`}
            </Button>
          )}
          <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDiscard(true)}>Discard</Button>
          {!sendable && data.status === 'draft' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              It cannot be sent while the content check is failing.
            </p>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={onSend}
        title="Send this newsletter"
        // Names the count and says plainly that it cannot be taken back. This
        // dialog is the last thing between a generated draft and every inbox.
        message={`This emails all ${data.audienceSize} approved members immediately and cannot be undone or recalled.`}
        confirmLabel="Send it"
      />
      <ConfirmModal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={onDiscard}
        title="Discard this draft"
        message="It is deleted. The scheduler writes a new one next week."
        danger
        confirmLabel="Discard"
      />
    </div>
  );
}

export default function AdminNewsletterPage() {
  useDocumentTitle('Weekly newsletter');
  const [openId, setOpenId] = useState(null);
  const { data, error, loading, reload } = useAsync(() => listNewsletterDrafts(), []);

  return (
    <AdminShell
      title="Weekly newsletter"
      icon={Newspaper}
      subtitle="Drafts written each week. Nothing reaches a student until you send it."
    >
      {openId ? (
        <DraftDetail id={openId} onBack={() => setOpenId(null)} onChanged={reload} />
      ) : loading ? (
        <RowSkeleton count={4} />
      ) : error ? (
        <ErrorState title="Could not load drafts" onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No drafts yet"
          subtitle="The weekly-newsletter job writes one every week. Run it from Dax Automation to generate one now."
        />
      ) : (
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d._id}>
              <button
                onClick={() => setOpenId(d._id)}
                className="card-hover w-full rounded-2xl border border-gray-200/80 bg-white p-4 text-left dark:border-gray-800/80 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={d.status} />
                  <span className="text-xs text-gray-400">Week of {formatDate(d.weekStart)}</span>
                  {d.status === 'sent' && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400">
                      <Users className="h-3 w-3" /> {d.recipientCount}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-medium">{d.subject}</p>
                {d.preheader && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{d.preheader}</p>
                )}
                {d.guardNotes && (
                  <p className="mt-1 line-clamp-1 text-xs text-red-600 dark:text-red-400">{d.guardNotes}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
