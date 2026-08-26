import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react';
import { getForYouNews, toggleBookmark } from '../../api/intelligence';
import { categoryMeta } from '../../utils/intelligence';
import { formatDateTime } from '../../utils/dateUtils';

// Live news pulled from the shared RSS cache (server/services/newsFetcher.js,
// no paid API), scoped to the categories the student's course/program cares
// about (server/config/programs.json). It changes on its own as the feeds
// refresh — nothing here needs a daily job.
export default function CourseNewsCard() {
  const [state, setState] = useState(null);

  useEffect(() => {
    getForYouNews()
      .then((res) => setState(res.data))
      .catch(() => {});
  }, []);

  if (!state?.articles?.length) return null;

  const handleBookmark = async (article) => {
    setState((s) => ({
      ...s,
      articles: s.articles.map((a) =>
        a._id === article._id ? { ...a, bookmarked: !a.bookmarked } : a
      ),
    }));
    try {
      await toggleBookmark(article._id);
    } catch {
      // revert on failure
      setState((s) => ({
        ...s,
        articles: s.articles.map((a) =>
          a._id === article._id ? { ...a, bookmarked: article.bookmarked } : a
        ),
      }));
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] dark:border-gray-800/80 dark:bg-gray-900 dark:shadow-none overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <Newspaper className="h-4 w-4 text-primary-500" /> For {state.program.label}
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Updated today</span>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {state.articles.map((a) => {
          const cat = categoryMeta(a.category);
          return (
            <li key={a._id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <a
                  href={a.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-1 text-sm font-medium text-gray-800 hover:text-primary-600 dark:text-gray-100 dark:hover:text-primary-400"
                >
                  <span className="line-clamp-2">{a.title}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-300" />
                </a>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1"><cat.icon className="h-3 w-3 shrink-0" /> {cat.label}</span>
                  <span>·</span>
                  <span>{a.source}</span>
                  <span>·</span>
                  <span>{formatDateTime(a.publishedAt)}</span>
                </p>
              </div>
              <button
                onClick={() => handleBookmark(a)}
                aria-label={a.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                className={`shrink-0 rounded-lg p-1.5 ${a.bookmarked ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                {a.bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
