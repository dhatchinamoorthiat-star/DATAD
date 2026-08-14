import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Sparkles, Pin, PinOff, ArrowRight, Clock, TrendingUp } from 'lucide-react';
import useSearch from '../hooks/useSearch';
import useDocumentTitle from '../hooks/useDocumentTitle';
import PageHeader from '../components/common/PageHeader';
import { Page } from '../components/common/motion';

const ICON_MAP = {
  LayoutDashboard: '▦', CalendarDays: '📅', FileText: '📄', Wallet: '💰',
  Briefcase: '💼', FileUser: '📋', Building2: '🏢', MessageSquare: '💬',
  Users: '👥', Rss: '📡', Newspaper: '📰', BookOpen: '📖', Heart: '❤️',
  Settings: '⚙️', GraduationCap: '🎓', ShoppingBag: '🛍️', AddressBook: '📇',
  History: '⏱️', Megaphone: '📢', Target: '🎯', Handshake: '🤝',
  Shield: '🛡️', Brain: '🧠', Activity: '📊', Palette: '🎨', Bot: '🤖',
  Terminal: '⌨️', Navigation: '🧭', User: '👤', Tags: '🏷️', Zap: '⚡',
  CheckSquare: '✅', Award: '🏆', TrendingUp: '📈', TrendingDown: '📉',
  MessageCircle: '💭', CreditCard: '💳', FolderGit2: '📁',
};

function getIcon(item) {
  if (item.icon?.startsWith('http') || item.icon?.startsWith('/')) {
    return <img src={item.icon} alt="" className="h-5 w-5 rounded" />;
  }
  return <span className="text-lg">{ICON_MAP[item.icon] || '•'}</span>;
}

function highlight(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const CATEGORY_ORDER = ['Commands', 'Pages', 'Notes', 'Planner', 'Career', 'Intelligence', 'Finance', 'Community', 'Wellbeing', 'AI History', 'Documents', 'Settings', 'Other'];

function ShimmerBlock({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  useDocumentTitle('Search');
  const navigate = useNavigate();
  const {
    query, setQuery, grouped, flatList, loading, clear,
    intent, pinned, handleSelect, handlePin, isPinned,
    hasPartialResults, activeProviders, totalProviders,
    recentSearches, frequentSearches,
  } = useSearch({ includeCommands: true });
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = useMemo(() => {
    const keys = Object.keys(grouped);
    return CATEGORY_ORDER.filter((c) => keys.includes(c)).concat(keys.filter((k) => !CATEGORY_ORDER.includes(k)));
  }, [grouped]);

  const results = useMemo(() => {
    if (activeCategory === 'all') return flatList;
    return grouped[activeCategory] || [];
  }, [activeCategory, grouped, flatList]);

  const totalResults = flatList.length;

  const handleNavigate = (item) => {
    handleSelect(item);
    if (item.url) navigate(item.url);
    else if (item.action === 'open-chat') window.dispatchEvent(new CustomEvent('dax:open-chat'));
    else if (item.action === 'open-memory') window.dispatchEvent(new CustomEvent('dax:open-memory'));
  };

  const hasDashboardContent = !query && (recentSearches.length > 0 || frequentSearches.length > 0 || pinned.length > 0);

  return (
    <Page>
      <PageHeader
        icon={Search}
        title="Search"
        subtitle="Search across all of DATAD — notes, tasks, people, commands, and more"
      />

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, tasks, people, commands…"
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/30"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {query && query.length >= 2 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 px-1 text-sm">
            <span className="text-gray-500">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </span>
              ) : `${totalResults} result${totalResults !== 1 ? 's' : ''}`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveCategory('all')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {cat}
                  <span className="ml-1.5 text-[10px] opacity-60">{grouped[cat]?.length || 0}</span>
                </button>
              ))}
            </div>
            {intent && intent.intent !== 'search' && intent.confident && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[11px] text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                <Sparkles className="h-3 w-3" />
                {intent.intent === 'navigate' && `Navigating to ${intent.entity}…`}
                {intent.intent === 'create' && `Creating ${intent.entity}…`}
                {intent.intent === 'chat' && 'Chat with Dax'}
                {intent.intent === 'help' && 'Showing commands'}
              </span>
            )}
          </div>
        )}

        {/* Provider loading indicator */}
        {hasPartialResults && activeProviders > 0 && (
          <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading from {activeProviders}/{totalProviders} sources…
          </div>
        )}
      </div>

      {/* ── Empty / Dashboard ── */}
      {(!query || query.length < 2) && !hasDashboardContent && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-400">Search everything in DATAD</p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            Find notes, tasks, journal entries, people, commands, and more from one place
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {['Notes', 'Planner', 'Career', 'Finance', 'Resume', 'Community'].map((hint) => (
              <button
                key={hint}
                onClick={() => setQuery(hint)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:hover:border-indigo-800/60"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard: Recent + Frequent + Pinned */}
      {!query && hasDashboardContent && (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <Section title="Pinned" icon={Pin}>
              {pinned.map((p) => (
                <ResultItem
                  key={p.resultId || p.id}
                  item={p}
                  onAction={handleNavigate}
                  query={query}
                  pinned
                  onPin={handlePin}
                />
              ))}
            </Section>
          )}
          {recentSearches.length > 0 && (
            <Section title="Recent" icon={Clock}>
              {recentSearches.slice(0, 5).map((r) => (
                <button
                  key={`recent-${r.query}`}
                  onClick={() => setQuery(r.query)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-left transition-colors hover:border-indigo-100 hover:bg-indigo-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900/50"
                >
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{r.query}</span>
                </button>
              ))}
            </Section>
          )}
          {frequentSearches.length > 0 && (
            <Section title="Frequent" icon={TrendingUp}>
              {frequentSearches.slice(0, 5).map((f) => (
                <button
                  key={`freq-${f.query}`}
                  onClick={() => setQuery(f.query)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-left transition-colors hover:border-indigo-100 hover:bg-indigo-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900/50"
                >
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-sm flex-1 text-gray-600 dark:text-gray-300">{f.query}</span>
                  <span className="text-[10px] text-gray-400">{f.frequency}x</span>
                </button>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && query.length >= 2 && totalResults === 0 && <ShimmerBlock count={4} />}

      {/* ── No results ── */}
      {query.length >= 2 && !loading && totalResults === 0 && activeProviders === 0 && (
        <div className="text-center py-16">
          <Search className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No results for "{query}"</p>
          <p className="text-sm text-gray-400 mt-1">Try different keywords or browse the categories above</p>
          {intent && intent.intent !== 'search' && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
              {intent.intent === 'navigate' && `Try using the command "Open ${intent.entity}"`}
              {intent.intent === 'chat' && 'Open Dax to start a conversation'}
              {intent.intent === 'create' && `Try going to ${intent.entity === 'note' ? 'Notes' : 'Planner'} to create`}
            </div>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((item) => (
            <ResultItem
              key={item.id || `${item.providerId}-${item.title}`}
              item={item}
              onAction={handleNavigate}
              query={query}
              pinned={isPinned(item.id)}
              onPin={handlePin}
            />
          ))}
        </div>
      )}
    </Page>
  );
}

// Shared by the results list and the Pinned dashboard section, which is why it
// takes `pinned` as a prop rather than calling isPinned itself: the dashboard
// section already knows every item in it is pinned.
function ResultItem({ item, onAction, query, pinned, onPin }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAction(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAction(item);
        }
      }}
      className="group flex w-full cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left transition-all hover:border-indigo-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900/50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
        {getIcon(item)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {query ? highlight(item.title, query) : item.title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {item.subtitle && <span>{highlight(item.subtitle, query)} · </span>}
          <span className="text-[10px] uppercase tracking-wider text-gray-300">{item.category || item.providerLabel}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onPin && (
          <button
            onClick={(e) => { e.stopPropagation(); onPin(item); }}
            className={`text-gray-300 hover:text-amber-500 transition-colors ${pinned ? 'text-amber-500' : 'opacity-0 group-hover:opacity-100'}`}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
        )}
        {item.matchType === 'exact' && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            Exact
          </span>
        )}
        {item.url && <ArrowRight className="h-3.5 w-3.5 text-gray-300" />}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
