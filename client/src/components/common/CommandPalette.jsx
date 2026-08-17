import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Pin, Sparkles, ArrowRight, Clock, TrendingUp, Command } from 'lucide-react';
import useSearch from '../../hooks/useSearch';

const ICON_MAP = {
  LayoutDashboard: '▦', CalendarDays: '📅', FileText: '📄', Wallet: '💰',
  Briefcase: '💼', FileUser: '📋', Building2: '🏢', MessageSquare: '💬',
  Users: '👥', Rss: '📡', Newspaper: '📰', BookOpen: '📖', Heart: '❤️',
  Settings: '⚙️', GraduationCap: '🎓', ShoppingBag: '🛍️', AddressBook: '📇',
  History: '⏱️', Megaphone: '📢', Target: '🎯', Handshake: '🤝',
  Shield: '🛡️', Brain: '🧠', Activity: '📊', Palette: '🎨', Bot: '🤖',
  ScrollText: '📜', Archive: '🗂️', GitFork: '🔀', CreditCard: '💳',
  CheckSquare: '✅', Award: '🏆', Certificate: '📜', TrendingUp: '📈',
  TrendingDown: '📉', Tags: '🏷️', MessageCircle: '💭', Calendar: '📅',
  User: '👤', FolderGit2: '📁', Zap: '⚡', Key: '🔑', Trash2: '🗑️',
  Download: '⬇️', AlertTriangle: '⚠️', Terminal: '⌨️', Navigation: '🧭',
  Sparkles: '✨', Bell: '🔔', Clock: '🕐', Pin: '📌', Command: '⌘',
};

function getIcon(item) {
  if (item.icon?.startsWith('http') || item.icon?.startsWith('/')) {
    return <img src={item.icon} alt="" className="h-4 w-4 rounded" />;
  }
  return <span className="text-[15px]">{ICON_MAP[item.icon] || '•'}</span>;
}

function highlight(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary-100 dark:bg-primary-800/50 text-primary-700 dark:text-primary-300 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ShimmerBlock({ lines = 1 }) {
  return (
    <div className="px-4 py-3 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

const CATEGORY_ORDER = ['Commands', 'Pages', 'Notes', 'Planner', 'Career', 'Intelligence', 'Finance', 'Community', 'Wellbeing', 'AI History', 'Documents', 'Settings', 'Other'];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const {
    query, setQuery, grouped, flatList, loading,
    pinned, recentSearches, frequentSearches,
    handleSelect, handlePin, isPinned, intent,
  } = useSearch({ includeCommands: true, enabled: open });

  const categories = useMemo(() => {
    const keys = Object.keys(grouped);
    return CATEGORY_ORDER.filter((c) => keys.includes(c)).concat(keys.filter((k) => !CATEGORY_ORDER.includes(k)));
  }, [grouped]);

  const commandsGroup = useMemo(() => grouped['Commands'], [grouped]);

  const entries = useMemo(() => {
    const result = [];
    let idx = 0;

    if (!query) {
      if (pinned.length > 0) {
        result.push({ type: 'header', label: 'Pinned', idx: idx++ });
        for (const p of pinned) {
          result.push({ type: 'item', ...p, section: 'pinned', idx: idx++ });
        }
      }
      if (recentSearches.length > 0) {
        result.push({ type: 'header', label: 'Recent', idx: idx++ });
        for (const r of recentSearches.slice(0, 5)) {
          result.push({ type: 'recent', query: r.query, idx: idx++ });
        }
      }
      if (frequentSearches.length > 0) {
        result.push({ type: 'header', label: 'Frequent', idx: idx++ });
        for (const f of frequentSearches.slice(0, 5)) {
          result.push({ type: 'frequent', query: f.query, count: f.frequency, idx: idx++ });
        }
      }
      return result;
    }

    if (commandsGroup?.length > 0) {
      result.push({ type: 'header', label: 'Commands', idx: idx++ });
      for (const c of commandsGroup) {
        result.push({ type: 'item', ...c, section: 'commands', idx: idx++ });
      }
    }

    for (const cat of categories) {
      if (cat === 'Commands') continue;
      const items = grouped[cat];
      if (!items || items.length === 0) continue;
      result.push({ type: 'header', label: cat, idx: idx++ });
      for (const item of items) {
        result.push({ type: 'item', ...item, section: 'results', idx: idx++ });
      }
    }

    // The palette is now the only search entry point, so it has to be able to
    // reach the full search page — otherwise /search is unreachable from the UI.
    if (query.trim().length >= 2) {
      result.push({ type: 'fullsearch', query: query.trim(), idx: idx++ });
    }

    return result;
  }, [query, pinned, recentSearches, frequentSearches, categories, grouped, commandsGroup]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Adjusting state during render rather than in an effect: React re-runs this
  // component before committing, so the highlight never paints on a stale row.
  const [lastReset, setLastReset] = useState({ open, query });
  if (lastReset.open !== open || lastReset.query !== query) {
    setLastReset({ open, query });
    setSelectedIdx(0);
  }

  const execute = useCallback((item) => {
    handleSelect(item);
    if (item.url) {
      navigate(item.url);
    } else if (item.action === 'open-chat') {
      window.dispatchEvent(new CustomEvent('dax:open-chat'));
    } else if (item.action === 'open-memory') {
      window.dispatchEvent(new CustomEvent('dax:open-memory'));
    } else if (item.action === 'clear-chat') {
      window.dispatchEvent(new CustomEvent('dax:clear-chat'));
    } else if (item.action === 'delete-account') {
      window.dispatchEvent(new CustomEvent('settings:delete-account'));
    }
    onClose?.();
  }, [navigate, onClose, handleSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, entries.length - 1));
    }
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = entries[selectedIdx];
      if (!selected) return;
      if (selected.type === 'item') execute(selected);
      if (selected.type === 'recent' || selected.type === 'frequent') {
        setQuery(selected.query);
      }
      if (selected.type === 'fullsearch') {
        navigate(`/search?q=${encodeURIComponent(selected.query)}`);
        onClose();
      }
    }
    if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const selected = entries[selectedIdx];
      if (selected && selected.type === 'item') handlePin(selected);
    }
  }, [entries, selectedIdx, execute, onClose, setQuery, handlePin, navigate]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  const hasResults = entries.length > 0;
  const showEmptyState = query.length >= 2 && !loading && !hasResults;
  const showLoading = loading && query.length >= 2 && !hasResults;

  const totalItems = pinned.length + recentSearches.slice(0, 5).length + frequentSearches.slice(0, 5).length;
  const showDashboard = !query && totalItems === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
      {/* Visual scrim only. Escape is bound in handleKeyDown below, which is
          this click's keyboard equivalent. */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950 overflow-hidden"
        style={{ maxHeight: '70vh' }}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search anything…"
            className="flex-1 border-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none dark:text-gray-100"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
          <kbd className="hidden rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-gray-700 dark:bg-gray-800 sm:inline-block">esc</kbd>
        </div>

        {/* ── Results list ── */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 53px)' }}>
          {/* Loading shimmer */}
          {showLoading && <ShimmerBlock lines={4} />}

          {/* Empty state */}
          {showEmptyState && (
            <div className="px-6 py-10 text-center">
              <Search className="h-8 w-8 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
              {intent && intent.intent !== 'search' && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-xs text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
                  <Sparkles className="h-3 w-3" />
                  {intent.intent === 'navigate' && `Try "Open ${intent.entity}" as a command`}
                  {intent.intent === 'create' && `Try "New ${intent.entity}" in its section`}
                  {intent.intent === 'chat' && 'Open Dax to chat'}
                  {intent.intent === 'help' && 'Type a command like "Open Planner"'}
                </div>
              )}
            </div>
          )}

          {/* Dashboard / Empty state */}
          {showDashboard && (
            <div className="px-6 py-8 text-center">
              <div className="mb-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Command className="h-3 w-3" /> <span>Start typing to search</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['Dashboard', 'Notes', 'Planner', 'Tasks', 'Resume', 'Finance', 'Community'].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setQuery(hint)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:border-primary-200 hover:text-primary-600 dark:border-gray-700 dark:hover:border-primary-800/60"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {hasResults && entries.map((entry) => {
            if (entry.type === 'header') {
              return (
                <div key={entry.label} className="px-5 pt-3 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    {entry.label}
                  </span>
                </div>
              );
            }

            if (entry.type === 'fullsearch') {
              const isSelected = entry.idx === selectedIdx;
              return (
                <button
                  key="fullsearch"
                  data-idx={entry.idx}
                  onClick={() => { navigate(`/search?q=${encodeURIComponent(entry.query)}`); onClose(); }}
                  onMouseEnter={() => setSelectedIdx(entry.idx)}
                  className={`flex w-full items-center gap-3 border-t border-gray-100 px-5 py-2.5 text-left transition-colors dark:border-gray-800 ${
                    isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Search className="h-3.5 w-3.5 text-primary-500" />
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    See all results for <span className="font-semibold">{entry.query}</span>
                  </span>
                </button>
              );
            }

            if (entry.type === 'recent') {
              const isSelected = entry.idx === selectedIdx;
              return (
                <button
                  key={`recent-${entry.query}`}
                  data-idx={entry.idx}
                  onClick={() => setQuery(entry.query)}
                  onMouseEnter={() => setSelectedIdx(entry.idx)}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                  </span>
                  <span className={`text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'}`}>
                    {entry.query}
                  </span>
                </button>
              );
            }

            if (entry.type === 'frequent') {
              const isSelected = entry.idx === selectedIdx;
              return (
                <button
                  key={`freq-${entry.query}`}
                  data-idx={entry.idx}
                  onClick={() => setQuery(entry.query)}
                  onMouseEnter={() => setSelectedIdx(entry.idx)}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                  </span>
                  <span className={`text-sm flex-1 ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'}`}>
                    {entry.query}
                  </span>
                  <span className="text-[10px] text-gray-400">{entry.count}x</span>
                </button>
              );
            }

            if (entry.type === 'item') {
              const isSelected = entry.idx === selectedIdx;
              const pinned = isPinned(entry.id);

              return (
                <button
                  key={entry.id || `${entry.section}-${entry.title}`}
                  data-idx={entry.idx}
                  onClick={() => execute(entry)}
                  onMouseEnter={() => setSelectedIdx(entry.idx)}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    {getIcon(entry)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${
                      isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200'
                    }`}>
                      {query ? highlight(entry.title, query) : entry.title}
                    </p>
                    {entry.subtitle && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {highlight(entry.subtitle, query)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pinned ? (
                      <span className="text-[10px] text-amber-500"><Pin className="h-3 w-3" /></span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePin(entry); }}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-gray-300 hover:text-amber-500 transition-opacity"
                        title="Pin"
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                    )}
                    {entry.matchType === 'exact' && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Exact
                      </span>
                    )}
                    {entry.action === 'open-chat' && (
                      <Sparkles className="h-3.5 w-3.5 text-primary-400" />
                    )}
                    {entry.url && (
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                    )}
                  </div>
                </button>
              );
            }

            return null;
          })}

        </div>

        {/* ── Footer ── */}
        {hasResults && (
          <div className="flex items-center gap-4 border-t border-gray-100 px-5 py-2 dark:border-gray-800">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <kbd className="rounded border border-gray-200 px-1 text-[9px] dark:border-gray-700">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <kbd className="rounded border border-gray-200 px-1 text-[9px] dark:border-gray-700">⏎</kbd> Open
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <kbd className="rounded border border-gray-200 px-1 text-[9px] dark:border-gray-700">⌘P</kbd> Pin
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <kbd className="rounded border border-gray-200 px-1 text-[9px] dark:border-gray-700">esc</kbd> Close
            </span>
            {flatList.length > 0 && (
              <span className="ml-auto text-[10px] text-gray-300">{flatList.length} results</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
