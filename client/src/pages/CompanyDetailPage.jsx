import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Target,
  IndianRupee,
  ListChecks,
  MessageCircleQuestion,
  Lightbulb,
  ExternalLink,
  MapPin,
  Briefcase,
  Newspaper,
  Clock,
  
  ShieldCheck,
} from 'lucide-react';
import { getCompany, getCompanyNews } from '../api/companies';
import { sectorMeta, QUESTION_LABELS } from '../utils/companies';
import { FeedSkeleton } from '../components/common/Skeleton';
import TierGate from '../components/common/TierGate';
import { FEATURE } from '../utils/planFeatures';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-indigo-500" /> {title}
      </h2>
      {children}
    </section>
  );
}

const QUESTION_TINTS = {
  hr: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  technical: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
  case: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  guesstimate: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const SOURCE_COLORS = {
  'Economic Times':    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Moneycontrol':      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Business Standard': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'Livemint':          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Hindu BusinessLine':'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Financial Express': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function NewsSection({ articles, loading }) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Newspaper className="h-4 w-4 text-indigo-500" /> Latest news
        </h2>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="h-3.5 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!articles || articles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Newspaper className="h-4 w-4 text-indigo-500" /> Latest news
        <span className="ml-auto text-[10px] font-normal text-gray-400">auto-fetched · updates hourly</span>
      </h2>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {articles.map((a, i) => (
          <li key={i} className="group py-3 first:pt-0 last:pb-0">
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1 hover:no-underline"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug text-gray-800 group-hover:text-indigo-600 dark:text-gray-200 dark:group-hover:text-indigo-400">
                  {a.title}
                </p>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-indigo-400 dark:text-gray-600" />
              </div>
              {a.snippet && (
                <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {a.snippet}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_COLORS[a.source] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {a.source}
                </span>
                {a.publishedAt && (
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <Clock className="h-2.5 w-2.5" /> {timeAgo(a.publishedAt)}
                  </span>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CompanyDetailPage() {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getCompany(slug)
      .then((res) => {
        setCompany(res.data);
        // Fetch news once we have the company name
        setNewsLoading(true);
        return getCompanyNews(res.data.name);
      })
      .then((res) => setNews(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
        setNews([]);
      })
      .finally(() => setNewsLoading(false));
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-gray-400">
        Company not found.{' '}
        <Link to="/placement/companies" className="text-indigo-500 hover:underline">
          Back to companies
        </Link>
      </div>
    );
  }
  if (!company) return <div className="mx-auto max-w-3xl px-4 py-6"><FeedSkeleton count={4} /></div>;

  const meta = sectorMeta(company.sector);
  const MetaIcon = meta.icon;

  return (
    <div className="animate-in mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        to="/placement/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="h-4 w-4" /> All companies
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-indigo-200/70 bg-indigo-50 p-6 dark:border-indigo-900/50 dark:bg-indigo-950/40 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400">
          <MetaIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium uppercase tracking-wide dark:bg-gray-900/60">
              {meta.label}
            </span>
            {company.headquarters && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {company.headquarters}</span>
            )}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        {company.salaryRange ? (
          <div className="shrink-0 rounded-xl bg-white/80 px-4 py-2 text-center dark:bg-gray-900/60">
            <p className="flex items-center justify-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="h-4 w-4" /> {company.salaryRange.replace(/^₹\s*/, '')}
            </p>
            <p className="text-[10px] text-gray-400">indicative — verify at the drive</p>
          </div>
        ) : company._salaryLocked && (
          // The server strips the band rather than sending it and hiding it, so
          // there is nothing here to read out of the response.
          <div className="shrink-0 rounded-xl bg-white/80 px-4 py-2 text-center dark:bg-gray-900/60">
            <p className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">Salary band</p>
            <TierGate feature={FEATURE.COMPANY_PREMIUM} inline />
          </div>
        )}
      </div>

      <div className="space-y-5">
        <Section icon={Building2} title="What they do">
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{company.overview}</p>
          {company.businessModel && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 className="mb-1.5 text-sm font-semibold">How they make money</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{company.businessModel}</p>
            </div>
          )}
        </Section>

        <div className="grid gap-5 md:grid-cols-2">
          {company.whatTheyLookFor && (
            <Section icon={Target} title="What they look for">
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{company.whatTheyLookFor}</p>
            </Section>
          )}

          {(company.roles?.length > 0 || company.rounds?.length > 0 || company._salaryLocked) && (
            <Section icon={ListChecks} title="Roles & hiring process">
              {company._salaryLocked && (
                <div className="mb-3">
                  <p className="mb-1.5 text-sm text-gray-500 dark:text-gray-400">
                    The round-by-round hiring process is part of the Placement Pass.
                  </p>
                  <TierGate feature={FEATURE.COMPANY_PREMIUM} inline />
                </div>
              )}
              {company.roles?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {company.roles.map((r) => (
                    <span
                      key={r}
                      className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    >
                      <Briefcase className="h-3 w-3" /> {r}
                    </span>
                  ))}
                </div>
              )}
              {company.rounds?.length > 0 && (
                <ol className="space-y-2">
                  {company.rounds.map((round, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                        {i + 1}
                      </span>
                      {round}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          )}
        </div>

        <TierGate
          feature={FEATURE.COMPANY_RESEARCH}
          description="See the questions they actually ask and expert prep tips — curated for every company."
        >
          <>
          {company.interviewQuestions?.length > 0 && (
            <Section icon={MessageCircleQuestion} title="Questions they actually ask">
              <ul className="space-y-2.5">
                {company.interviewQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        QUESTION_TINTS[q.category] || QUESTION_TINTS.hr
                      }`}
                    >
                      {QUESTION_LABELS[q.category] || q.category}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{q.question}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {company.prepTips?.length > 0 && (
            <Section icon={Lightbulb} title="Prep tips">
              <ul className="space-y-2">
                {company.prepTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          </>
        </TierGate>

        <NewsSection articles={news} loading={newsLoading} />

        {/* Data sources disclaimer */}
        <div className="rounded-2xl border border-gray-200/60 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-indigo-500" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Data sources &amp; transparency</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Company profiles are compiled from publicly available information across these sources:
              </p>
              <ul className="flex flex-wrap gap-2 mt-1">
                {[
                  { label: 'LinkedIn Jobs', url: 'https://linkedin.com/jobs' },
                  { label: 'Glassdoor', url: 'https://glassdoor.co.in' },
                  { label: 'AmbitionBox', url: 'https://ambitionbox.com' },
                  { label: 'Economic Times', url: 'https://economictimes.indiatimes.com' },
                  { label: 'Company website', url: company.website || null },
                  { label: 'Moneycontrol', url: 'https://moneycontrol.com' },
                ].filter(Boolean).map((s) => s.label && (
                  <li key={s.label}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        {s.label} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">{s.label}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Salary figures are indicative and based on reported data — always verify at the placement drive. Interview questions are sourced from student experiences and public forums.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
