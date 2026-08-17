import { useState } from 'react';
import { MessageSquare, Heart, Send, Pin, User } from 'lucide-react';


export default function MemoryStream({ memories = [], onAddMemory }) {
  const memoryList = memories;
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !story || submitting) return;

    setSubmitting(true);
    try {
      if (onAddMemory) await onAddMemory({ title, story });
      setTitle('');
      setStory('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <MessageSquare className="h-4 w-4 text-indigo-500" /> Share your childhood memory
        </h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Where were you when you watched this? What was your after-school routine like?
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Title (e.g. Friday evenings with my grandmother)"
            aria-label="Memory title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
          <textarea
            rows={3}
            placeholder="Write your story…"
            aria-label="Memory story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            className="input"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> {submitting ? 'Posting…' : 'Post memory'}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {memoryList.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white py-8 text-center text-sm text-gray-400 dark:border-gray-800/80 dark:bg-gray-900">
            Be the first to share a memory!
          </div>
        ) : (
          memoryList.map((mem) => (
            <div
              key={mem._id}
              className="space-y-1.5 rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">{mem.user?.name || 'Anonymous'}</span>
                </div>
                {mem.isPinned && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold">{mem.title}</h4>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{mem.story}</p>
              <div className="flex items-center gap-4 pt-1 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" /> {mem.likes?.length || 0} likes
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
