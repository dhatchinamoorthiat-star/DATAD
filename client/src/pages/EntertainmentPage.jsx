import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Search, Heart, Tv, Gamepad2, Smartphone,
  Cookie, Film, Music, BookOpen, Clapperboard, Flame,
  Calendar, Clock, Filter, Popcorn,
} from 'lucide-react';
import InteractiveTimeline from '../components/entertainment/InteractiveTimeline';
import EmptyState from '../components/common/EmptyState';
import Loader from '../components/common/Loader';
import { listItems } from '../api/entertainment';

const categories = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'cartoons', label: 'Cartoons', icon: Tv },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'gadgets', label: 'Old gadgets', icon: Smartphone },
  { id: 'snacks', label: 'Snacks', icon: Cookie },
  { id: 'tv_shows', label: 'TV shows', icon: Film },
  { id: 'theme_songs', label: 'Theme songs', icon: Music },
  { id: 'comics', label: 'Comics', icon: BookOpen },
  { id: 'animated_movies', label: 'Animated movies', icon: Clapperboard },
];

const nostalgia = (item) =>
  Math.min(100, Math.floor((item.views || 0) * 0.1 + (item.likes || 0) * 2 + (item.bookmarksCount || 0) * 3));

export default function EntertainmentPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [items, setItems] = useState(null);

  // The search term is read through a ref, not a dependency: changing category
  // or year should keep whatever is already typed, but typing itself must not
  // refire the request — search is submit-driven.
  const searchRef = useRef('');

  const fetchArchiveItems = useCallback(async () => {
    setItems(null);
    try {
      const params = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedYear !== 'all') params.year = selectedYear;
      if (searchRef.current) params.q = searchRef.current;

      const { data } = await listItems(params);
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch entertainment archives:', error);
      setItems([]);
    }
  }, [selectedCategory, selectedYear]);

  useEffect(() => {
    // Scheduled, not called inline: the loader flips loading state
    // synchronously, which cascades an extra render from the effect body.
    queueMicrotask(fetchArchiveItems);
  }, [fetchArchiveItems]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchArchiveItems();
  };

  const throwback = items?.find((i) => i.isThrowbackPick) || null;

  return (
    <div className="animate-in mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          <Popcorn className="h-3.5 w-3.5" /> Digital museum of childhood memories
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">
          Welcome back to your <span className="accent-text">childhood</span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Take a well-deserved break from studying. Explore the cartoons, games and shows
          that shaped an entire generation.
        </p>

        <form onSubmit={handleSearchSubmit} className="relative mx-auto mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search cartoons, characters, shows…"
            aria-label="Search the archive"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchRef.current = e.target.value; }}
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

      {/* Categories */}
      <div className="mb-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
          <Filter className="h-3.5 w-3.5 text-indigo-500" /> Categories
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Era timeline */}
      <div className="mb-6">
        <InteractiveTimeline activeYear={selectedYear} onSelectYear={setSelectedYear} />
      </div>

      {/* Throwback highlight */}
      {throwback && (
        <div className="card-hover mb-6 flex flex-col gap-4 rounded-2xl border border-indigo-200/70 bg-indigo-50 p-6 dark:border-indigo-900/50 dark:bg-indigo-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Calendar className="h-3 w-3" /> Throwback highlight
            </div>
            <h3 className="text-lg font-bold">{throwback.title}</h3>
            <p className="mt-1 max-w-xl text-sm text-gray-600 line-clamp-2 dark:text-gray-300">
              {throwback.overview}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to={`/entertainment/${throwback.category}/${throwback.slug}`}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Relive memory
            </Link>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" /> {throwback.readingTime || 5} min read
            </span>
          </div>
        </div>
      )}

      {/* Archive grid */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Flame className="h-4 w-4 text-rose-500" /> Trending archives
        </h2>
        {items && (
          <span className="text-xs text-gray-400">
            {items.length} memor{items.length === 1 ? 'y' : 'ies'} cataloged
          </span>
        )}
      </div>

      {!items ? (
        <Loader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Popcorn}
          title="No memories found for this filter"
          subtitle="Try another category, era or search term."
        />
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item._id || item.slug}
              to={`/entertainment/${item.category}/${item.slug}`}
              className="card-hover group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900"
            >
              <div className="relative h-40 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {item.aiArtworks?.[0]?.url && (
                  <img
                    src={item.aiArtworks[0].url}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 backdrop-blur dark:bg-gray-950/80 dark:text-indigo-300">
                  {item.category?.replace('_', ' ')}
                </span>
                <span className="absolute bottom-3 right-3 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-600 backdrop-blur dark:bg-gray-950/80 dark:text-gray-300">
                  {item.yearsActive || item.releaseYear}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {item.title}
                </h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-gray-500 line-clamp-2 dark:text-gray-400">
                  {item.overview}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5 text-[11px] dark:border-gray-800">
                  <span className="flex items-center gap-1 font-medium text-rose-500">
                    <Heart className="h-3.5 w-3.5" /> {nostalgia(item)}% nostalgia
                  </span>
                  <span className="text-gray-400">{item.studio || item.country}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
