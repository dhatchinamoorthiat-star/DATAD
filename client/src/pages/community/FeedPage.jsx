import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { MessageSquare, Trophy, Image, BarChart2, Plus, Loader2 } from 'lucide-react';
import { getFeed, createPost, reactToPost, votePoll } from '../../api/feed';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';
import PageHeader from '../../components/common/PageHeader';

const EMOJIS = ['👍', '❤️', '🔥', '😂', '👏'];
const TYPE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'achievement', label: '🏆 Achievements' },
  { key: 'poll', label: '📊 Polls' },
  { key: 'photo', label: '📷 Photos' },
];

function PostCard({ post: initialPost }) {
  const [post, setPost] = useState(initialPost);

  const react = async (emoji) => {
    try {
      await reactToPost(post._id, emoji);
      const counts = { ...post.reactionCounts };
      const was = post.myReaction;
      if (was) counts[was] = Math.max(0, (counts[was] || 0) - 1);
      if (was !== emoji) counts[emoji] = (counts[emoji] || 0) + 1;
      setPost((p) => ({ ...p, reactionCounts: counts, myReaction: was === emoji ? null : emoji }));
    } catch { toast.error('Could not react to post'); }
  };

  const vote = async (idx) => {
    if (post.myVote != null) return;
    try {
      const res = await votePoll(post._id, idx);
      setPost((p) => ({ ...p, pollOptions: res.data.pollOptions, myVote: res.data.myVote }));
    } catch (err) { toast.error(err.response?.data?.message || 'Could not submit vote'); }
  };

  const totalVotes = post.pollOptions?.reduce((s, o) => s + o.votes, 0) || 0;
  const isAchievement = post.type === 'achievement';

  return (
    <div className={`rounded-2xl border bg-white p-5 dark:bg-gray-900 ${isAchievement ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-gray-200/80 dark:border-gray-800/80'}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {post.author?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold">{post.author?.name || 'Anonymous'}</p>
            {isAchievement && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
          </div>
          <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</p>
        </div>
        {post.tag && (
          <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">{post.tag}</span>
        )}
      </div>

      {post.title && <p className="mb-1.5 font-semibold">{post.title}</p>}
      {post.body && <p className="mb-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post.body}</p>}
      {post.imageUrl && <img src={post.imageUrl} alt="" className="mb-3 rounded-xl w-full object-cover max-h-72" />}

      {post.pollOptions?.length > 0 && (
        <div className="mb-3 space-y-2">
          {post.pollOptions.map((opt, idx) => {
            const pct = totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0;
            const voted = post.myVote === idx;
            return (
              <button key={idx} onClick={() => vote(idx)} disabled={post.myVote != null}
                className={`relative w-full overflow-hidden rounded-xl border py-2.5 px-4 text-left text-sm disabled:cursor-default ${
                  voted ? 'border-indigo-400' : 'border-gray-200 hover:enabled:border-indigo-400 dark:border-gray-700'
                }`}>
                <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20" style={{ width: `${pct}%` }} />
                <span className="relative">{opt.text}{voted && ' ✓'}</span>
                <span className="relative float-right font-medium text-indigo-600 dark:text-indigo-400">{pct}%</span>
              </button>
            );
          })}
          <p className="text-xs text-gray-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {post.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">#{t}</span>)}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => react(emoji)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors ${
              post.myReaction === emoji
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {emoji} {post.reactionCounts?.[emoji] > 0 && <span>{post.reactionCounts[emoji]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedPage() {
  useDocumentTitle('Community Feed');
  const [posts, setPosts] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [postType, setPostType] = useState('text');
  const [pollInputs, setPollInputs] = useState(['', '']);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = useCallback(async (pg = 1, type = typeFilter) => {
    try {
      const params = { page: pg, limit: 10 };
      if (type) params.type = type;
      const res = await getFeed(params);
      const data = res.data;
      if (pg === 1) setPosts(data.posts);
      else setPosts((prev) => [...(prev || []), ...data.posts]);
      setHasMore(pg < data.pages);
      // load() owns `page` now, so switching filters no longer needs a
      // synchronous setPage(1) in the effect body below.
      setPage(pg);
    } catch { setPosts([]); }
  }, [typeFilter]);

  // load() awaits before its first setState, so nothing is set synchronously
  // here — the rule cannot see across the await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(1, typeFilter); }, [load, typeFilter]);

  const onPost = async (data) => {
    try {
      const tags = data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const pollOptions = postType === 'poll' ? pollInputs.filter(Boolean) : undefined;
      const res = await createPost({ ...data, type: postType, tags, pollOptions });
      setPosts((prev) => [res.data, ...(prev || [])]);
      setShowCompose(false);
      reset();
      setPollInputs(['', '']);
      setPostType('text');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post');
    }
  };

  return (
    <Page overview={{
      pageKey: 'community-feed',
      title: 'The batch timeline',
      blurb: 'A fast, casual stream for wins, questions, photos and polls — built so you can post in seconds.',
      takeaway: "Skim it daily to stay in sync with what everyone's up to.",
    }}>
      <PageHeader
        icon={MessageSquare}
        title="Community Feed"
        subtitle="The batch timeline — wins, questions and updates"
        action={{ label: 'Post', onClick: () => setShowCompose((v) => !v), icon: Plus }}
      />

      {/* Compose Box */}
      {showCompose && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex gap-2">
            {/* Icon components, not elements: elements built inside an array
                literal are children React expects to be keyed. */}
            {[['text', MessageSquare, 'Text'],
              ['achievement', Trophy, 'Win'],
              ['photo', Image, 'Photo'],
              ['poll', BarChart2, 'Poll']].map(([key, Icon, label]) => (
              <button key={key} onClick={() => setPostType(key)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${postType === key ? 'bg-indigo-600 text-white' : 'border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit(onPost)} className="space-y-3">
            {postType !== 'poll' && (
              <input {...register('title')} placeholder={postType === 'achievement' ? '🏆 What did you achieve?' : 'Title (optional)'} className="input" />
            )}
            <textarea {...register('body', { required: true })} placeholder={postType === 'poll' ? 'Ask your question…' : 'Share something with the batch…'} rows={3} className="input" />
            {postType === 'photo' && <input {...register('imageUrl')} placeholder="Image URL" className="input" />}
            {postType === 'poll' && (
              <div className="space-y-2">
                {pollInputs.map((val, i) => (
                  <input key={i} value={val} onChange={(e) => setPollInputs((p) => p.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`Option ${i + 1}`} className="input" />
                ))}
                {pollInputs.length < 4 && (
                  <button type="button" onClick={() => setPollInputs((p) => [...p, ''])} className="text-xs text-indigo-600 hover:underline">+ Add option</button>
                )}
              </div>
            )}
            <input {...register('tags')} placeholder="Tags (comma-separated, optional)" className="input" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCompose(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Pills */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setTypeFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${typeFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {posts === null ? <FeedSkeleton count={4} /> : posts.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No posts yet" description="Be the first to post something!" cta={{ label: 'Post', onClick: () => setShowCompose(true) }} />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => <PostCard key={p._id} post={p} />)}
          {hasMore && (
            <button onClick={() => load(page + 1)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              Load more
            </button>
          )}
        </div>
      )}
    </Page>
  );
}
