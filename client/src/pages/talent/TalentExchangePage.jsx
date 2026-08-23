import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Handshake, Plus, Search, X, Clock, Coins, Users } from 'lucide-react';
import toast from '../../utils/toast';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { CardGridSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import useAsync from '../../hooks/useAsync';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';
import { Page } from '../../components/common/motion';
import { listOpportunities, searchOpportunities, createOpportunity } from '../../api/talent';
import {
  KINDS, CATEGORIES, URGENCIES, CATEGORY_LABEL, KIND_LABEL,
  URGENCY_LABEL, URGENCY_CLASS, STATUS_LABEL, formatCredits, formatDuration,
} from '../../utils/talent';

const chip = (active) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
  }`;

function OpportunityCard({ opp }) {
  const duration = formatDuration(opp.estDurationMin);
  return (
    <Link
      to={`/community/talent/${opp._id}`}
      className="card-hover block rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900"
    >
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
        {opp.status !== 'open' && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {STATUS_LABEL[opp.status] || opp.status}
          </span>
        )}
      </div>

      <h2 className="font-semibold leading-snug">{opp.title}</h2>
      <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{opp.description}</p>

      {opp.skills?.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {opp.skills.slice(0, 4).map((s) => (
            <li key={s} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3 w-3" /> {formatCredits(opp.priceCredits)}
        </span>
        {duration && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}</span>
        )}
        {opp.slotsTotal > 1 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {opp.slotsFilled}/{opp.slotsTotal} filled
          </span>
        )}
        <span className="ml-auto">{opp.user?.name} · {formatDate(opp.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function TalentExchangePage() {
  useDocumentTitle('Talent Exchange');
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm();

  // Search and browse are different server endpoints, not a filter over one
  // list — search is a text index over open posts only. Which one runs is
  // decided here so the page has a single loading and error path.
  const { data, error, loading, reload } = useAsync(
    () => (submittedQuery
      ? searchOpportunities(submittedQuery)
      : listOpportunities({ category: category || undefined, mine: mine || undefined })),
    [submittedQuery, category, mine],
  );

  const opportunities = useMemo(() => data || [], [data]);

  const onCreate = async (form) => {
    try {
      await createOpportunity({
        ...form,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        priceCredits: Number(form.priceCredits) || 0,
        estDurationMin: form.estDurationMin ? Number(form.estDurationMin) : undefined,
      });
      toast.success('Posted to the exchange');
      reset();
      setModalOpen(false);
      setMine(false);
      setSubmittedQuery('');
      reload();
    } catch (err) {
      // A failed publish leaves a real draft behind; saying "failed" flatly
      // would be untrue and would invite a duplicate post.
      toast.error(
        err.draftId
          ? 'Saved as a draft, but could not publish it. Open “My posts” to publish or delete it.'
          : err.response?.data?.message || 'Could not post that',
      );
      if (err.draftId) { setModalOpen(false); setMine(true); }
    }
  };

  const runSearch = (e) => {
    e.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const clearSearch = () => { setQuery(''); setSubmittedQuery(''); };

  return (
    <Page overview={{
      pageKey: 'community-talent',
      title: 'Ask the batch, or help them',
      blurb: 'Post what you need help with, or offer what you are good at. Helpers apply, you pick one.',
      takeaway: 'A specific title and the skills involved get far more applicants than a vague ask.',
    }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Handshake className="h-5 w-5 text-indigo-500" /> Talent Exchange
        </h1>
        <Button size="sm" icon={Plus} onClick={() => setModalOpen(true)}>Post</Button>
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Paid in Talent Credits — the exchange&rsquo;s own unit, not money.
      </p>

      <form onSubmit={runSearch} className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search open posts…"
            aria-label="Search opportunities"
            className="input pl-9"
          />
          {submittedQuery && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" size="sm" variant="ghost">Search</Button>
      </form>

      {/* Search already spans every category and only covers open posts, so
          these filters would silently contradict it. */}
      {!submittedQuery && (
        <div className="dax-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setMine(false)} className={chip(!mine && !category)}>All</button>
          <button type="button" onClick={() => { setMine(true); setCategory(''); }} className={chip(mine)}>My posts</button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => { setCategory(category === c.value ? '' : c.value); setMine(false); }}
              className={chip(!mine && category === c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : error ? (
        <ErrorState title="Could not load the exchange" onRetry={reload} />
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={submittedQuery ? 'Nothing matches that' : mine ? 'You have not posted yet' : 'Nothing posted yet'}
          subtitle={
            submittedQuery
              ? 'Try a different word, or clear the search to browse everything open.'
              : 'Post what you need help with — a specific ask gets answered fastest.'
          }
        />
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {opportunities.map((opp) => <OpportunityCard key={opp._id} opp={opp} />)}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Post to the exchange">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label htmlFor="opp-kind" className="mb-1 block text-sm font-medium">What is this?</label>
            <select id="opp-kind" {...register('kind', { required: true })} className="input">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="opp-category" className="mb-1 block text-sm font-medium">Category</label>
            <select id="opp-category" {...register('category', { required: true })} className="input">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="opp-title" className="mb-1 block text-sm font-medium">Title</label>
            <input
              id="opp-title"
              {...register('title', { required: true, maxLength: 120 })}
              placeholder="e.g. Help me debug a React useEffect loop"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="opp-desc" className="mb-1 block text-sm font-medium">Details</label>
            <textarea
              id="opp-desc"
              rows={4}
              {...register('description', { required: true, maxLength: 4000 })}
              placeholder="What you need, what you have tried, and what done looks like."
              className="input"
            />
          </div>
          <div>
            <label htmlFor="opp-skills" className="mb-1 block text-sm font-medium">
              Skills <span className="text-gray-400">(comma separated, optional)</span>
            </label>
            <input id="opp-skills" {...register('skills')} placeholder="React, JavaScript" className="input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="opp-credits" className="mb-1 block text-sm font-medium">Credits</label>
              <input id="opp-credits" type="number" min="0" defaultValue={0} {...register('priceCredits')} className="input" />
            </div>
            <div>
              <label htmlFor="opp-mins" className="mb-1 block text-sm font-medium">Minutes</label>
              <input id="opp-mins" type="number" min="0" {...register('estDurationMin')} placeholder="60" className="input" />
            </div>
            <div>
              <label htmlFor="opp-urgency" className="mb-1 block text-sm font-medium">Urgency</label>
              <select id="opp-urgency" defaultValue="normal" {...register('urgency')} className="input">
                {URGENCIES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Posting as {user?.name}. It goes live immediately and anyone in your batch can apply.
          </p>
          <Button type="submit" fullWidth disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Posting…' : 'Post'}
          </Button>
        </form>
      </Modal>
    </Page>
  );
}
