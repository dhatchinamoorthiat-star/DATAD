import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Briefcase, Eye, IndianRupee, MessageCircleQuestion } from 'lucide-react';
import { listCompanies } from '../api/companies';
import { SECTORS, sectorMeta } from '../utils/companies';
import { CardGridSkeleton } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import { Page } from '../components/common/motion';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState(null);
  const [sector, setSector] = useState('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    setCompanies(null);
    try {
      const params = {};
      if (sector !== 'all') params.sector = sector;
      if (query.trim()) params.q = query.trim();
      const { data } = await listCompanies(params);
      setCompanies(data);
    } catch {
      setCompanies([]);
    }
  };

  useEffect(() => {
    // Scheduled rather than called inline: load() clears the list synchronously,
    // and doing that in the effect body cascades an extra render on every load.
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);

  return (
    <Page overview={{
      pageKey: 'career-companies',
      title: 'Who hires from here',
      blurb: 'Company profiles with sector, roles, pay ranges and the questions past batches were asked.',
      takeaway: 'Open a company before you apply so you know its process going in.',
    }}>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">
          Company <span className="accent-text">prep cards</span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          One page per recruiter: what they do, what they ask, what they pay — everything
          you need before the drive.
        </p>
        <Link
          to="/placement/questions"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          <MessageCircleQuestion className="h-3.5 w-3.5" /> Browse the full interview question bank
        </Link>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="relative mx-auto mt-5 max-w-xl"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies…"
            aria-label="Search companies"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 bg-white py-3 pl-11 pr-24 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSector('all')}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            sector === 'all'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          All sectors
        </button>
        {SECTORS.map((s) => {
          const Icon = s.icon;
          const active = sector === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSector(s.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {!companies ? (
        <CardGridSkeleton count={6} />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No companies found"
          subtitle="Try a different sector or search term."
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const meta = sectorMeta(c.sector);
            const Icon = meta.icon;
            return (
              <Link
                key={c._id}
                to={`/companies/${c.slug}`}
                className="card-hover flex flex-col rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {meta.label}
                  </span>
                </div>
                <h2 className="font-semibold leading-snug">{c.name}</h2>
                {c.roles?.length > 0 && (
                  <p className="mt-1 flex-1 text-xs text-gray-500 line-clamp-2 dark:text-gray-400">
                    {c.roles.slice(0, 3).join(' · ')}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5 text-[11px] text-gray-400 dark:border-gray-800">
                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <IndianRupee className="h-3 w-3" /> {c.salaryRange || '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {c.views || 0}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
