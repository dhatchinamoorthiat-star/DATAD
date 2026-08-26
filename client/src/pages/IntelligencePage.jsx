import { useCallback, useEffect, useState } from 'react';
import toast from '../utils/toast';
import { Newspaper, RefreshCw, Sparkles, LineChart, Bookmark, SlidersHorizontal, Star } from 'lucide-react';
import Button from '../components/common/Button';
import {
  listArticles,
  listBookmarked,
  toggleBookmark as toggleBookmarkApi,
  getMarket,
  setInterests as setInterestsApi,
  refreshNews,
} from '../api/intelligence';
import { getMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, TOPICS, categoriesForInterests } from '../utils/intelligence';
import { formatDateTime } from '../utils/dateUtils';
import { CardGridSkeleton } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import IntelligenceCard from '../components/intelligence/IntelligenceCard';
import MarketStrip from '../components/intelligence/MarketStrip';
import DailyBriefingPanel from '../components/intelligence/DailyBriefingPanel';

const chip = (active) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
  }`;

export default function IntelligencePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [articles, setArticles] = useState(null);
  const [market, setMarketState] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [interests, setInterests] = useState([]);
  const [view, setView] = useState('all'); // 'all' | 'foryou' | 'saved'
  const [category, setCategory] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);

  const loadArticles = useCallback(() => {
    const fetcher = view === 'saved' ? listBookmarked() : listArticles(category || undefined);
    fetcher
      .then((res) => setArticles(res.data))
      // Fall through to the empty state instead of an endless skeleton.
      .catch(() => setArticles([]));
  }, [view, category]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    // Market strip and interests are both supplementary — the article list
    // stands on its own, so a failure here just leaves them empty.
    getMarket()
      .then((res) => {
        setMarketState(res.data.indicators || []);
        setUpdatedAt(res.data.updatedAt || null);
      })
      .catch(() => setMarketState([]));
    getMe()
      .then((res) => setInterests(res.data.interests || []))
      .catch(() => setInterests([]));
  }, []);

  const onToggleBookmark = async (article) => {
    try {
      await toggleBookmarkApi(article._id);
      loadArticles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to bookmark');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshNews();
      toast.success(`Refreshed — ${res.data.total} stories, ${res.data.market} live market feeds`);
      loadArticles();
      getMarket()
        .then((r) => {
          setMarketState(r.data.indicators || []);
          setUpdatedAt(r.data.updatedAt || null);
        })
        .catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const saveInterests = async (next) => {
    try {
      const res = await setInterestsApi(next);
      setInterests(res.data.interests);
    } catch {
      toast.error('Failed to save topics');
    }
  };

  // "For you" filters the live feed to the categories behind followed topics.
  const forYouCats = categoriesForInterests(interests);
  const hasInterests = interests.length > 0;
  let shown = articles || [];
  if (view === 'foryou') {
    if (!hasInterests) {
      shown = []; // show onboarding state, not all articles
    } else {
      shown = forYouCats.size ? shown.filter((a) => forYouCats.has(a.category)) : shown;
    }
  }
  // Newest story becomes the highlighted "Top story".
  const topStory = view === 'all' && !category && shown.length ? shown[0] : null;
  const rest = topStory ? shown.slice(1) : shown;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Newspaper className="h-5 w-5 text-indigo-500" /> Intelligence Center
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTopicsOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <SlidersHorizontal className="h-4 w-4" /> Topics
          </button>
          {isAdmin && (
            <Button size="sm" onClick={onRefresh} disabled={refreshing} icon={RefreshCw}>Refresh</Button>
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Live business news, auto-updated from the newsroom and sorted by topic — useful for placement prep and staying market-aware, whatever you&rsquo;re studying.
      </p>

      {/* The briefing the dashboard card, the career journey and the readiness
          breakdown all link here for. It renders nothing on the days the
          scheduler has not produced one. */}
      <DailyBriefingPanel />

      {/* Market snapshot (live) */}
      {market.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <LineChart className="h-3.5 w-3.5" /> Market snapshot
            <span className="inline-flex items-center gap-1 font-normal normal-case text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> live
            </span>
            {updatedAt && <span className="font-normal normal-case">· {formatDateTime(updatedAt)}</span>}
          </p>
          <MarketStrip indicators={market} />
        </div>
      )}

      {/* View + category filters */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button className={chip(view === 'all')} onClick={() => setView('all')}>All</button>
        <button className={chip(view === 'foryou')} onClick={() => setView('foryou')}>
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> For you</span>
        </button>
        <button className={chip(view === 'saved')} onClick={() => setView('saved')}>
          <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> Saved</span>
        </button>
      </div>
      {view !== 'saved' && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button className={chip(!category)} onClick={() => setCategory('')}>All topics</button>
          {CATEGORIES.map((c) => (
            <button key={c.value} className={`${chip(category === c.value)} inline-flex items-center gap-1.5`} onClick={() => setCategory(c.value)}>
              <c.icon className="h-3.5 w-3.5 shrink-0" /> {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      {!articles ? (
        <CardGridSkeleton count={6} cols="grid-cols-1 sm:grid-cols-2" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={view === 'saved' ? Bookmark : view === 'foryou' && !hasInterests ? Star : Newspaper}
          title={
            view === 'saved'
              ? 'No saved stories yet'
              : view === 'foryou' && !hasInterests
                ? 'Your personalised feed is empty'
                : 'No stories yet'
          }
          subtitle={
            view === 'saved'
              ? 'Bookmark stories to build your prep reading list'
              : view === 'foryou' && !hasInterests
                ? 'Follow a few topics and we\'ll show you news that matches your interests.'
                : 'Fresh news is being pulled — check back in a moment'
          }
          action={
            view === 'foryou' && !hasInterests ? (
              <Button onClick={() => setTopicsOpen(true)} className="mt-2">Choose topics</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {topStory && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-500">
                <Sparkles className="h-3.5 w-3.5" /> Top story
              </p>
              <div className="rounded-2xl bg-indigo-500/10 p-0.5">
                <IntelligenceCard article={topStory} onToggleBookmark={onToggleBookmark} />
              </div>
            </div>
          )}
          {rest.map((a) => (
            <IntelligenceCard key={a._id} article={a} onToggleBookmark={onToggleBookmark} />
          ))}
        </div>
      )}

      <Modal open={topicsOpen} onClose={() => setTopicsOpen(false)} title="Follow topics">
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          Pick what you care about — the “For you” feed adapts to your choices.
        </p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const on = interests.includes(t.value);
            return (
              <button
                key={t.value}
                onClick={() => saveInterests(on ? interests.filter((i) => i !== t.value) : [...interests, t.value])}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  on ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {t.value}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
