import { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Lightbulb,
  
  Building2,
  Briefcase,
  ChevronDown,
  ExternalLink,
  Pencil,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { categoryMeta } from '../../utils/intelligence';
import { formatDateTime } from '../../utils/dateUtils';

function Chips({ items, className = '' }) {
  if (!items?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function Block({ icon: Icon, label, children, tint }) {
  return (
    <div className={`rounded-lg p-3 ${tint}`}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {children}
    </div>
  );
}

export default function IntelligenceCard({ article, onToggleBookmark, isAdmin, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const cat = categoryMeta(article.category);
  const hasPrep =
    article.keyTakeaways?.length || article.interviewQuestions?.length || article.businessTerms?.length;

  return (
    <article className="card-hover rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium dark:bg-gray-800">
          <cat.icon className="h-3.5 w-3.5 shrink-0" /> {cat.label}
        </span>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <button onClick={() => onEdit(article)} aria-label="Edit article" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(article._id)} aria-label="Delete article" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => onToggleBookmark(article)}
            aria-label={article.bookmarked ? 'Remove bookmark' : 'Bookmark'}
            className={`rounded-lg p-1.5 ${article.bookmarked ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            {article.bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <h2 className="text-lg font-bold leading-snug">{article.title || article.headline}</h2>
      {article.summary && (
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{article.summary}</p>
      )}

      <div className="mt-3 space-y-2">
        {article.whyItMatters && (
          <Block icon={Lightbulb} label="Why it matters" tint="bg-amber-50 text-amber-900 dark:bg-amber-900/15 dark:text-amber-100">
            <p className="text-sm">{article.whyItMatters}</p>
          </Block>
        )}
        {article.interviewRelevance && (
          <Block icon={Briefcase} label="Interview / case relevance" tint="bg-indigo-50 text-indigo-900 dark:bg-indigo-900/15 dark:text-indigo-100">
            <p className="text-sm">{article.interviewRelevance}</p>
          </Block>
        )}
      </div>

      {(article.concepts?.length > 0 || article.industries?.length > 0) && (
        <div className="mt-3 space-y-2">
          {article.concepts?.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
                <Lightbulb className="h-3.5 w-3.5" /> Key concepts
              </p>
              <Chips items={article.concepts} />
            </div>
          )}
          {article.industries?.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
                <Building2 className="h-3.5 w-3.5" /> Companies / industries
              </p>
              <Chips items={article.industries} />
            </div>
          )}
        </div>
      )}

      {hasPrep ? (
        <div className="mt-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-500" /> Prep pack
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-2 space-y-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              {article.keyTakeaways?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Key takeaways</p>
                  <ul className="ml-4 list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {article.keyTakeaways.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {article.interviewQuestions?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Possible interview questions</p>
                  <ul className="ml-4 list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {article.interviewQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}
              {article.businessTerms?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Key terms</p>
                  <Chips items={article.businessTerms} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400 dark:border-gray-800">
        <span>
          {article.source || 'DATAD Intelligence'} · {formatDateTime(article.publishedAt || article.createdAt)}
        </span>
        {(article.link || article.sourceUrl) && (
          <a href={article.link || article.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-500 hover:underline">
            Read full <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}