import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Building2, MessageSquare, ArrowRight, ExternalLink, Contact } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { track } from '../../utils/analytics';
import { listCompanies, getCompanyNews } from '../../api/companies';
import ReadinessCard from '../../components/common/ReadinessCard';
import PlacementCountdown from '../../components/career/PlacementCountdown';
import PlacementJourney from '../../components/career/PlacementJourney';
import ReadinessBreakdown from '../../components/career/ReadinessBreakdown';
import { getReadiness } from '../../api/readiness';
import DailyTip from '../../components/common/DailyTip';
import { Page } from '../../components/common/motion';

const NEWS_LIMIT = 6;

const SOURCE_DOT = {
  'Economic Times':    'bg-orange-400',
  'Moneycontrol':      'bg-blue-400',
  'Business Standard': 'bg-rose-400',
  'Livemint':          'bg-emerald-400',
  'Hindu BusinessLine':'bg-violet-400',
  'Financial Express': 'bg-sky-400',
};

export default function CareerHubPage() {
  useDocumentTitle('Career');
  const [companies, setCompanies] = useState([]);
  const [newsMap, setNewsMap] = useState({});
  const [readiness, setReadiness] = useState(null);

  useEffect(() => {
    track('career_hub_viewed');
    getReadiness().then((r) => setReadiness(r.data)).catch(() => {});
    listCompanies()
      .then((res) => {
        const top = res.data.slice(0, NEWS_LIMIT);
        setCompanies(top);
        top.forEach((c) => {
          getCompanyNews(c.name)
            .then((r) => setNewsMap((prev) => ({ ...prev, [c.name]: r.data?.slice(0, 2) ?? [] })))
            .catch(() => setNewsMap((prev) => ({ ...prev, [c.name]: [] })));
        });
      })
      .catch(() => {});
  }, []);

  const newsCount = Object.values(newsMap).flat().length;

  return (
    <Page overview={{
      pageKey: 'career-hub',
      title: 'Your job-search command centre',
      blurb: 'Readiness score, target companies, open roles, resume and interview prep gathered in one place.',
      takeaway: 'Fix whatever your readiness score flags as weakest before applying anywhere.',
    }}>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Career</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your placement journey</p>
      </div>

      <DailyTip workspace="career" className="mb-8" />


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-1 space-y-6">
          <PlacementCountdown />
          {/* ReadinessCard takes `data` and self-fetches if omitted — pass the
              hub's copy so we don't issue a second getReadiness(). */}
          <ReadinessCard data={readiness} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* PlacementJourney wants the components array, ReadinessBreakdown
              wants the whole payload as `data`. */}
          <PlacementJourney components={readiness?.components || []} />
          <ReadinessBreakdown data={readiness} />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <QuickLink to="/career/resume" icon={FileText} label="Resume" />
          <QuickLink to="/career/linkedin" icon={Contact} label="LinkedIn" />
          <QuickLink to="/career/companies" icon={Building2} label="Companies" />
          <QuickLink to="/career/questions" icon={MessageSquare} label="Interview Qs" />
          <QuickLink to="/career/opportunities" icon={ArrowRight} label="Opportunities" />
        </div>
      </div>

      {companies.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
            Company News
            <span className="ml-2 text-xs font-normal text-gray-400">({newsCount} stories)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((c) => {
              const news = newsMap[c.name] || [];
              return (
                <Link key={c._id} to={`/career/companies/${c.slug}`} className="group rounded-2xl border border-gray-100 p-4 hover:border-primary-200 hover:shadow-sm transition-all dark:border-gray-800 dark:hover:border-primary-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {c.name?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">{c.name}</p>
                      {c.industry && <p className="text-[11px] text-gray-400 truncate">{c.industry}</p>}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary-500 dark:text-gray-600" />
                  </div>
                  {news.length > 0 ? (
                    news.slice(0, 1).map((n, i) => (
                      <div key={i} className="mt-1">
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{n.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {n.source && (
                            <span className="flex items-center gap-1">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${SOURCE_DOT[n.source] || 'bg-gray-300'}`} />
                              <span className="text-[10px] text-gray-400">{n.source}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="mt-1 text-[11px] text-gray-400">No recent news</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Page>
  );
}

function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-600 hover:border-primary-200 hover:text-primary-600 dark:border-gray-800 dark:text-gray-300 dark:hover:border-primary-800/60 dark:hover:text-primary-400 transition-colors">
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
