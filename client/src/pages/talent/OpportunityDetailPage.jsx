import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Coins, Clock, Users, Send, Check, X, Flag, Lock } from 'lucide-react';
import toast from '../../utils/toast';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { FeedSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import useAsync from '../../hooks/useAsync';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';
import { Page } from '../../components/common/motion';
import {
  getOpportunity, applyToOpportunity, listApplicants, listMyApplications,
  acceptApplication, rejectApplication, closeOpportunity, reportOpportunity,
} from '../../api/talent';
import {
  CATEGORY_LABEL, KIND_LABEL, URGENCY_LABEL, URGENCY_CLASS, STATUS_LABEL,
  APPLICATION_STATUS_LABEL, formatCredits, formatDuration,
} from '../../utils/talent';

function Applicants({ opportunityId, onChanged }) {
  const { data, error, loading, reload } = useAsync(() => listApplicants(opportunityId), [opportunityId]);
  const [busyId, setBusyId] = useState(null);

  const act = async (fn, id, message) => {
    setBusyId(id);
    try {
      await fn(id);
      toast.success(message);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'That did not work');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <FeedSkeleton count={2} />;
  if (error) return <ErrorState title="Could not load applicants" onRetry={reload} />;
  if (!data.length) {
    return (
      <EmptyState
        icon={Users}
        title="No applicants yet"
        subtitle="You will see them here as people apply."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((app) => (
        <li key={app._id} className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{app.applicant?.name}</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {APPLICATION_STATUS_LABEL[app.status] || app.status}
            </span>
            {/* Computed by the matching engine, not by the applicant. */}
            {app.matchScore != null && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                {app.matchScore}% match
              </span>
            )}
            <span className="ml-auto text-xs text-gray-400">{formatDate(app.createdAt)}</span>
          </div>

          {app.pitch && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{app.pitch}</p>
          )}
          {app.proposedCredits != null && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Proposes {formatCredits(app.proposedCredits)}
            </p>
          )}
          {app.matchReasons?.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {app.matchReasons.map((r) => (
                <li key={r} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {r}
                </li>
              ))}
            </ul>
          )}

          {app.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                icon={Check}
                disabled={busyId === app._id}
                onClick={() => act(acceptApplication, app._id, `${app.applicant?.name} accepted`)}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                disabled={busyId === app._id}
                onClick={() => act(rejectApplication, app._id, 'Applicant declined')}
              >
                Decline
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function OpportunityDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Set when this visit does the applying; before that the answer comes from
  // the server. Whether you have applied is not page state — a reload used to
  // put the Apply button back and the next click just 409'd.
  const [justApplied, setJustApplied] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm();

  const { data: opp, error, loading, reload } = useAsync(() => getOpportunity(id), [id]);
  // Own applications, not the opportunity's — the applicants list is owner-only,
  // so an applicant cannot read their own row from it.
  const { data: myApplications, reload: reloadMine } = useAsync(() => listMyApplications(), []);
  useDocumentTitle(opp?.title || 'Opportunity');

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-8"><FeedSkeleton count={4} /></div>;
  if (error) {
    // 403 here is the visibility gate, not a transient failure — retrying will
    // never succeed, so it gets its own wording rather than a Retry button.
    const forbidden = error.response?.status === 403;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        {forbidden ? (
          <EmptyState
            icon={Lock}
            title="This post is not visible to you"
            subtitle="It may be limited to another program, or private to its poster."
          />
        ) : (
          <ErrorState title="Could not load this post" onRetry={reload} />
        )}
        <div className="mt-4 text-center">
          <Link to="/community/talent" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
            Back to the exchange
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = String(opp.user?._id || opp.user) === String(user?.id);
  const myApplication = (myApplications || []).find(
    (a) => String(a.opportunity?._id || a.opportunity) === String(id),
  );
  // A withdrawn application is not a live one — that student may apply again.
  const applied = justApplied || (myApplication && myApplication.status !== 'withdrawn');
  const canApply = !isOwner && opp.status === 'open' && !applied;
  const duration = formatDuration(opp.estDurationMin);

  const onApply = async (form) => {
    try {
      await applyToOpportunity(id, {
        pitch: form.pitch,
        proposedCredits: form.proposedCredits ? Number(form.proposedCredits) : undefined,
      });
      toast.success('Application sent');
      setJustApplied(true);
      reset();
      setApplyOpen(false);
      reloadMine();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not apply');
      // 409 is "already applied" — usually a second tab. Stop offering it and
      // refetch so the status shown is the real one.
      if (err.response?.status === 409) { setJustApplied(true); setApplyOpen(false); reloadMine(); }
    }
  };

  const onClose = async () => {
    try {
      await closeOpportunity(id);
      toast.success('Post closed');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not close it');
    }
  };

  const onReport = async () => {
    const reason = window.prompt('What is wrong with this post?');
    if (!reason?.trim()) return;
    try {
      await reportOpportunity(id, reason.trim());
      toast.success('Reported — thank you');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not report it');
    }
  };

  return (
    <Page className="mx-auto max-w-3xl px-4 py-6">
      <button
        onClick={() => navigate('/community/talent')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" /> Talent Exchange
      </button>

      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
          {CATEGORY_LABEL[opp.category] || opp.category}
        </span>
        <span className="text-[10px] text-gray-400">{KIND_LABEL[opp.kind] || opp.kind}</span>
        {URGENCY_CLASS[opp.urgency] && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${URGENCY_CLASS[opp.urgency]}`}>
            {URGENCY_LABEL[opp.urgency]}
          </span>
        )}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {STATUS_LABEL[opp.status] || opp.status}
        </span>
      </div>

      <h1 className="text-xl font-bold leading-snug">{opp.title}</h1>
      <p className="mt-1 text-xs text-gray-400">
        {opp.user?.name} · {formatDate(opp.createdAt)}
      </p>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {opp.description}
      </p>

      {opp.skills?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {opp.skills.map((s) => (
            <li key={s} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gray-200/80 bg-gray-50/60 px-4 py-3 text-sm dark:border-gray-800/80 dark:bg-gray-900/60">
        <span className="inline-flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-gray-400" /> {formatCredits(opp.priceCredits)}
        </span>
        {duration && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" /> {duration}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4 text-gray-400" /> {opp.slotsFilled}/{opp.slotsTotal} filled
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canApply && <Button icon={Send} onClick={() => setApplyOpen(true)}>Apply</Button>}
        {applied && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {myApplication && myApplication.status !== 'pending'
              ? `Your application was ${(APPLICATION_STATUS_LABEL[myApplication.status] || myApplication.status).toLowerCase()}.`
              : 'You have applied — the poster will see it in their applicants list.'}
          </p>
        )}
        {!isOwner && opp.status !== 'open' && !applied && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This post is {(STATUS_LABEL[opp.status] || opp.status).toLowerCase()} and is not taking applications.
          </p>
        )}
        {isOwner && ['open', 'matched'].includes(opp.status) && (
          <Button variant="ghost" onClick={() => setConfirmClose(true)}>Close post</Button>
        )}
        {!isOwner && (
          <button
            onClick={onReport}
            className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
          >
            <Flag className="h-3.5 w-3.5" /> Report
          </button>
        )}
      </div>

      {isOwner && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Applicants</h2>
          <Applicants opportunityId={id} onChanged={reload} />
        </section>
      )}

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply to help">
        <form onSubmit={handleSubmit(onApply)} className="space-y-4">
          <div>
            <label htmlFor="apply-pitch" className="mb-1 block text-sm font-medium">
              Why you <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="apply-pitch"
              rows={4}
              maxLength={2000}
              {...register('pitch')}
              placeholder="What you have done that is relevant, and how you would approach this."
              className="input"
            />
          </div>
          <div>
            <label htmlFor="apply-credits" className="mb-1 block text-sm font-medium">
              Counter-offer in credits <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="apply-credits"
              type="number"
              min="0"
              {...register('proposedCredits')}
              placeholder={String(opp.priceCredits || 0)}
              className="input"
            />
            <p className="mt-1 text-xs text-gray-400">
              Leave blank to accept the posted {formatCredits(opp.priceCredits).toLowerCase()}.
            </p>
          </div>
          <Button type="submit" fullWidth disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Sending…' : 'Send application'}
          </Button>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={onClose}
        title="Close this post"
        message="It stops accepting applications. Anyone you already accepted keeps their engagement."
        confirmLabel="Close post"
      />
    </Page>
  );
}
