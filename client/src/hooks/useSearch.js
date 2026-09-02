import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { isPlacementPath } from '../utils/placementNav';
import { searchAll, recordClick, getPinned, togglePin, getRecentSearches, getFrequentSearches } from '../api/search';

const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

const STORAGE_KEYS = {
  recentSearches: 'datad-search-recent-searches',
  frequentSearches: 'datad-search-frequent-searches',
  pinned: 'datad-search-pinned',
};

function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(key, data) {
  // Quota exceeded or storage disabled (private mode): search history is a
  // convenience, never worth breaking a search over.
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

export default function useSearch(options = {}) {
  const {
    debounceMs = DEBOUNCE_MS,
    minLength = MIN_QUERY_LENGTH,
    includeCommands = true,
    enabled = true,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [intent, setIntent] = useState(null);
  const [providerStatus, setProviderStatus] = useState({});
  const [pinned, setPinned] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [frequentSearches, setFrequentSearches] = useState([]);
  const [latency, setLatency] = useState(null);

  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  // Placement mode (see utils/placementNav.js) hides most of the app, but the
  // search index still carries every page. Filtering here rather than in the
  // search providers covers every consumer at once — the ⌘K palette and the
  // /search page both read this hook — so nothing offers a student a link that
  // would only bounce them back to /placement. Results with no url (Dax's
  // open-chat command, say) are actions rather than navigation, so they stay.
  // Read defensively — useSearch is a generic hook and AuthContext has no
  // default value, so a caller mounted outside the provider would otherwise
  // crash on the destructure.
  const placementOnly = useAuth()?.user?.role !== 'admin';
  const allowed = useCallback(
    (item) => !placementOnly || !item?.url || isPlacementPath(item.url.split(/[?#]/)[0]),
    [placementOnly],
  );

  const grouped = useMemo(() => {
    const groups = {};
    for (const r of results.filter(allowed)) {
      const cat = r.category || r.providerLabel || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    }
    for (const c of commands.filter(allowed)) {
      const cat = c.category || 'Commands';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    }
    return groups;
  }, [results, commands, allowed]);

  // Pinned items are stored server-side and predate placement mode, so an
  // older pin can point outside it.
  const visiblePinned = useMemo(() => pinned.filter(allowed), [pinned, allowed]);

  const flatList = useMemo(() => {
    const all = [];
    for (const [, items] of Object.entries(grouped)) {
      for (const item of items) {
        all.push(item);
      }
    }
    return all;
  }, [grouped]);


  const loadLocalData = useCallback(async () => {
    setPinned(loadFromStorage(STORAGE_KEYS.pinned));
    setRecentSearches(loadFromStorage(STORAGE_KEYS.recentSearches));
    setFrequentSearches(loadFromStorage(STORAGE_KEYS.frequentSearches));

    try {
      const [pinnedRes, recentRes, frequentRes] = await Promise.allSettled([
        getPinned(),
        getRecentSearches(),
        getFrequentSearches(),
      ]);
      if (pinnedRes.status === 'fulfilled') setPinned(pinnedRes.value.data || []);
      if (recentRes.status === 'fulfilled') setRecentSearches(recentRes.value.data || []);
      if (frequentRes.status === 'fulfilled') setFrequentSearches(frequentRes.value.data || []);
    } catch { /* suggestions are optional — the search box still works without them */ }
  }, []);

  useEffect(() => {
    // loadLocalData awaits before its first setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLocalData();
  }, [loadLocalData]);

  const search = useCallback(async (q) => {
    if (!q || q.length < minLength) {
      setResults([]);
      setCommands([]);
      setIntent(null);
      setProviderStatus({});
        setLatency(null);
      setLoading(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort?.();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setProviderStatus({});

    const startTime = performance.now();

    try {
      const res = await searchAll(q, includeCommands);
      const endTime = performance.now();
      if (mountedRef.current) {
        setResults(res.data?.results || []);
        setCommands(res.data?.commands || []);
        setIntent(res.data?.intent || null);
        setLatency(endTime - startTime);

        const status = {};
        if (res.data?.providerTimings) {
          for (const [id, ms] of Object.entries(res.data.providerTimings)) {
            status[id] = { status: 'done', latencyMs: ms };
          }
        }
        setProviderStatus(status);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current && err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.message || err.message || 'Search failed');
        setResults([]);
        setCommands([]);
        setLoading(false);
      }
    }
  }, [minLength, includeCommands]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Owns the debounce timer; clearing results when the query drops below the
  // minimum is part of that, not state that could be derived in render.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled) return;

    if (query.length < minLength) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setCommands([]);
      setIntent(null);
      setProviderStatus({});
        setLatency(null);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => search(query), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, minLength, enabled, search]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setCommands([]);
    setIntent(null);
    setError(null);
    setProviderStatus({});
    setLatency(null);
  }, []);

  const handleSelect = useCallback(async (item) => {
    try {
      await recordClick(query, item.id || item.title, item.category);
    } catch { /* click analytics must never block navigating to the result */ }

    const recent = loadFromStorage(STORAGE_KEYS.recentSearches);
    const updated = [{ query, timestamp: Date.now() }, ...recent.filter((r) => r.query !== query)].slice(0, 10);
    saveToStorage(STORAGE_KEYS.recentSearches, updated);
    setRecentSearches(updated);
  }, [query]);

  const handlePin = useCallback(async (item) => {
    try {
      const res = await togglePin({
        id: item.id || item.title,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        icon: item.icon,
        category: item.category,
        action: item.action,
      });
      if (res.data?.pinned) {
        setPinned((prev) => [item, ...prev.filter((p) => p.resultId !== item.id && p.id !== item.id)]);
      } else {
        setPinned((prev) => prev.filter((p) => p.resultId !== item.id && p.id !== item.id));
      }
      saveToStorage(STORAGE_KEYS.pinned, res.data?.pinned
        ? [item, ...pinned.filter((p) => p.resultId !== item.id && p.id !== item.id)]
        : pinned.filter((p) => p.resultId !== item.id && p.id !== item.id));
    } catch { /* the optimistic UI update above already reflects the intent */ }
  }, [pinned]);

  const isPinned = useCallback((itemId) => {
    return pinned.some((p) => p.resultId === itemId || p.id === itemId);
  }, [pinned]);

  return {
    query,
    setQuery,
    results,
    commands,
    grouped,
    flatList,
    loading,
    error,
    intent,
    providerStatus,
    latency,
    pinned: visiblePinned,
    recentSearches,
    frequentSearches,
    clear,
    search,
    handleSelect,
    handlePin,
    isPinned,
  };
}
