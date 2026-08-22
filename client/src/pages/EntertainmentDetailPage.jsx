import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles, Clock, MapPin, Tv, BookOpen, ArrowLeft, Quote, Heart, Bookmark } from 'lucide-react';
import toast from '../utils/toast';
import NostalgiaMeter from '../components/entertainment/NostalgiaMeter';
import PsychologySection from '../components/entertainment/PsychologySection';
import TriviaQuiz from '../components/entertainment/TriviaQuiz';
import MemoryStream from '../components/entertainment/MemoryStream';
import Loader from '../components/common/Loader';
import { getItem, addMemory, toggleLike, toggleBookmark } from '../api/entertainment';
import { buildTrivia } from '../utils/trivia';

export default function EntertainmentDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [memories, setMemories] = useState([]);

  useEffect(() => {
    getItem(slug)
      .then(({ data }) => {
        setData(data.item);
        setMemories(data.memories || []);
      })
      .catch((err) => console.error('Error fetching detail:', err));
  }, [slug]);

  // Build the quiz once per item so answers don't reshuffle mid-quiz.
  const trivia = useMemo(() => buildTrivia(data), [data?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onToggleLike = async () => {
    try {
      const { data: res } = await toggleLike(data._id);
      setData((d) => ({ ...d, liked: res.active, likes: res.likes, nostalgiaScore: res.nostalgiaScore }));
    } catch {
      toast.error('Could not update like');
    }
  };

  const onToggleBookmark = async () => {
    try {
      const { data: res } = await toggleBookmark(data._id);
      setData((d) => ({
        ...d,
        bookmarked: res.active,
        bookmarksCount: res.bookmarksCount,
        nostalgiaScore: res.nostalgiaScore,
      }));
      toast.success(res.active ? 'Saved to your bookmarks' : 'Removed from bookmarks');
    } catch {
      toast.error('Could not update bookmark');
    }
  };

  const handleAddMemory = async (draft) => {
    if (!data?._id) return;
    try {
      const { data: saved } = await addMemory(data._id, draft);
      setMemories((prev) => [saved, ...prev]);
    } catch {
      toast.error('Could not post your memory');
    }
  };

  if (!data) return <Loader />;

  return (
    <div className="animate-in mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        to="/community/archive"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="h-4 w-4" /> Back to archive
      </Link>

      {/* Hero */}
      <div className="card-hover relative mb-6 overflow-hidden rounded-2xl border border-gray-200/80 dark:border-gray-800/80">
        <div className="relative h-56 w-full bg-gray-100 dark:bg-gray-800 sm:h-72">
          {data.aiArtworks?.[0]?.url && (
            <img
              src={data.aiArtworks[0].url}
              alt={data.title}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-indigo-600 backdrop-blur">
                {data.category?.replace('_', ' ')}
              </span>
              {data.yearsActive && (
                <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 backdrop-blur">
                  {data.yearsActive}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white drop-shadow sm:text-4xl">{data.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-200">
              {data.country && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {data.country}</span>
              )}
              {data.studio && (
                <span className="flex items-center gap-1"><Tv className="h-3.5 w-3.5" /> {data.studio}</span>
              )}
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {data.readingTime || 5} min read</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onToggleLike}
              aria-label={data.liked ? 'Unlike' : 'Like'}
              aria-pressed={data.liked}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors ${
                data.liked
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/90 text-gray-700 hover:bg-white'
              }`}
            >
              <Heart className={`h-4 w-4 ${data.liked ? 'fill-current' : ''}`} />
              {data.likes || 0}
            </button>
            <button
              onClick={onToggleBookmark}
              aria-label={data.bookmarked ? 'Remove bookmark' : 'Bookmark'}
              aria-pressed={data.bookmarked}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors ${
                data.bookmarked
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/90 text-gray-700 hover:bg-white'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${data.bookmarked ? 'fill-current' : ''}`} />
              {data.bookmarksCount || 0}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800/80 dark:bg-gray-900">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <BookOpen className="h-5 w-5 text-indigo-500" /> Story &amp; overview
            </h2>
            <p className="leading-relaxed text-gray-700 dark:text-gray-300">{data.overview}</p>
            {data.history && (
              <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-800">
                <h3 className="mb-1.5 font-semibold">History</h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{data.history}</p>
              </div>
            )}
          </section>

          {data.psychology && <PsychologySection psychology={data.psychology} />}

          <div className="grid gap-6 md:grid-cols-2">
            {data.lifeLessons?.length > 0 && (
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
                <h3 className="mb-3 font-semibold">Life lessons</h3>
                <ul className="space-y-3">
                  {data.lifeLessons.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <span className="font-medium">{item.lesson}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.psychologicalTheme}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.iconicQuotes?.length > 0 && (
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
                <h3 className="mb-3 flex items-center gap-1.5 font-semibold">
                  <Quote className="h-4 w-4 text-indigo-500" /> Memorable quotes
                </h3>
                <div className="space-y-3">
                  {data.iconicQuotes.map((q, idx) => (
                    <blockquote
                      key={idx}
                      className="border-l-2 border-indigo-400 pl-3 text-sm italic text-gray-600 dark:text-gray-300"
                    >
                      “{q.quote}”
                      <cite className="mt-0.5 block text-xs font-normal not-italic text-gray-400">
                        — {q.character}
                      </cite>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}
          </div>

          <MemoryStream memories={memories} itemId={data._id} onAddMemory={handleAddMemory} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <NostalgiaMeter score={data.nostalgiaScore || 0} />
          {trivia.length > 0 && <TriviaQuiz questions={trivia} title="Nostalgia trivia" />}

          {data.interestingFacts?.length > 0 && (
            <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold">Did you know?</h3>
              <ul className="space-y-2.5">
                {data.interestingFacts.map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    {fact}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.aiArtworks?.length > 1 && (
            <section className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold">Gallery</h3>
              <div className="space-y-3">
                {data.aiArtworks.slice(1).map((art, idx) => (
                  <figure key={idx} className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                    <img src={art.url} alt={art.caption || data.title} loading="lazy" className="h-36 w-full object-cover" />
                    {art.caption && (
                      <figcaption className="p-2 text-[11px] italic text-gray-400">{art.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
