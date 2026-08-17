import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { getQuestionBank } from '../../api/companies';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import TierGate from '../../components/common/TierGate';
import { FEATURE } from '../../utils/planFeatures';
import { Page } from '../../components/common/motion';

const CATEGORY_META = {
  hr:          { label: 'HR & Behavioural', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  technical:   { label: 'Technical',        color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  case:        { label: 'Case Study',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  guesstimate: { label: 'Guesstimate',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

function CategorySection({ category, questions }) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category] || { label: category, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-sm text-gray-400">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {questions.map((q, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-5 py-3.5">
              <p className="text-sm">{q.question}</p>
              <Link
                to={`/career/companies/${q.companySlug}`}
                className="flex shrink-0 items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {q.company} <ExternalLink className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InterviewQuestionsPage() {
  const [bank, setBank] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getQuestionBank().then((res) => setBank(res.data)).catch(() => setBank({}));
  }, []);

  if (!bank) return <div className="mx-auto max-w-3xl px-4 py-6"><FeedSkeleton count={4} /></div>;

  const categories = Object.keys(CATEGORY_META);
  const hasAny = categories.some((c) => (bank[c] || []).length > 0);

  const filtered = (questions) => {
    if (!filter.trim()) return questions;
    const q = filter.toLowerCase();
    return questions.filter(
      (item) => item.question.toLowerCase().includes(q) || item.company.toLowerCase().includes(q)
    );
  };

  return (
    <Page>
      <div className="mb-4">
        <h1 className="text-xl font-bold">Interview Question Bank</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Real questions from company prep cards — organised by type
        </p>
      </div>

      <TierGate
        feature={FEATURE.INTERVIEW_QUESTIONS}
        description="Access real HR, technical, case study and guesstimate questions sourced from company prep cards — organised by type and searchable."
      >
        {!hasAny ? (
          <EmptyState
            icon={MessageSquare}
            title="No questions yet"
            subtitle="Questions are pulled from company prep cards. Ask the admin to add companies with interview rounds."
          />
        ) : (
          <>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search questions or companies…"
              className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
            {categories.map((cat) => {
              const qs = filtered(bank[cat] || []);
              if (qs.length === 0) return null;
              return <CategorySection key={cat} category={cat} questions={qs} />;
            })}
          </>
        )}
      </TierGate>
    </Page>
  );
}
