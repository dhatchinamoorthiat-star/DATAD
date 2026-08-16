import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from '../../utils/toast';
import {
  MessageSquare, Heart, Reply, Pin, Trash2, ChevronDown, ChevronUp, Send, Plus, X, Pencil, Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listPosts, createPost, updatePost, deletePost, likePost,
  createReply, deleteReply, likeReply,
} from '../../api/posts';
import { formatDate } from '../../utils/dateUtils';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { FeedSkeleton } from '../../components/common/Skeleton';
import { Page } from '../../components/common/motion';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const TAG_META = {
  question: { label: 'Question',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  update:   { label: 'Update',    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  resource: { label: 'Resource',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  win:      { label: '🎉 Win',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  help:     { label: 'Help',      color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  general:  { label: 'General',   color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};
const TAGS = Object.keys(TAG_META);

// ── New-post form ────────────────────────────────────────────────────────
function NewPostForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', tag: 'general' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createPost(form);
      onCreated(res.data);
      setForm({ title: '', body: '', tag: 'general' });
      setOpen(false);
    } catch {
      toast.error('Could not post');
    } finally { setSaving(false); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-5 flex w-full items-center gap-2 rounded-2xl border border-dashed border-indigo-300 px-5 py-3.5 text-sm font-medium text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
      >
        <Plus className="h-4 w-4" /> Start a discussion…
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">New post</span>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <input
          required maxLength={200} placeholder="Title" value={form.title} onChange={set('title')}
          className="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700"
        />
        <textarea
          required rows={3} maxLength={5000} placeholder="What's on your mind?" value={form.body} onChange={set('body')}
          className="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700"
        />
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t} type="button"
              onClick={() => setForm((f) => ({ ...f, tag: t }))}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity ${TAG_META[t].color} ${form.tag === t ? 'opacity-100 ring-2 ring-indigo-400 ring-offset-1' : 'opacity-60'}`}
            >
              {TAG_META[t].label}
            </button>
          ))}
        </div>
        <button
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}

// ── Reply box ────────────────────────────────────────────────────────────
function ReplyBox({ postId, onReplied }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await createReply(postId, body.trim());
      onReplied(res.data);
      setBody('');
    } catch { toast.error('Could not reply'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <textarea
        ref={ref} rows={1} maxLength={2000} placeholder="Write a reply…"
        value={body} onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
        className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
      />
      <button disabled={saving || !body.trim()} className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-white disabled:opacity-40 hover:bg-indigo-700">
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}

// ── Single post card ─────────────────────────────────────────────────────
function PostCard({ post: initial, currentUserId, isAdmin }) {
  const [post, setPost] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', body: '', tag: '' });
  const [saving, setSaving] = useState(false);
  const [deletePostOpen, setDeletePostOpen] = useState(false);
  const [deleteReplyId, setDeleteReplyId] = useState(null);

  const startEdit = () => {
    setEditForm({ title: post.title, body: post.body, tag: post.tag || 'general' });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updatePost(post._id, editForm);
      setPost((p) => ({ ...p, ...res.data }));
      setEditing(false);
    } catch {
      toast.error('Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  const setField = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const handleExpand = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (replies !== null) return;
    setLoadingReplies(true);
    try {
      const { getPost } = await import('../../api/posts');
      const res = await getPost(post._id);
      setReplies(res.data.replies);
    } catch { setReplies([]); }
    finally { setLoadingReplies(false); }
  };

  const handleLikePost = async () => {
    try {
      const res = await likePost(post._id);
      setPost((p) => ({ ...p, likes: Array(res.data.likes).fill(0), liked: res.data.liked }));
    } catch { /* silent */ }
  };

  const handleDeletePost = async () => {
    try { await deletePost(post._id); setPost(null); setDeletePostOpen(false); }
    catch { toast.error('Could not delete'); setDeletePostOpen(false); }
  };

  const handleLikeReply = async (replyId) => {
    try {
      const res = await likeReply(post._id, replyId);
      setReplies((prev) => prev.map((r) =>
        r._id === replyId ? { ...r, likes: Array(res.data.likes).fill(0), liked: res.data.liked } : r
      ));
    } catch { /* silent */ }
  };

  const handleDeleteReply = async () => {
    if (!deleteReplyId) return;
    try {
      await deleteReply(post._id, deleteReplyId);
      setReplies((prev) => prev.filter((r) => r._id !== deleteReplyId));
      setPost((p) => ({ ...p, replyCount: Math.max(0, (p.replyCount || 1) - 1) }));
      setDeleteReplyId(null);
    } catch { toast.error('Could not delete'); setDeleteReplyId(null); }
  };

  if (!post) return null;
  const tag = TAG_META[post.tag] || TAG_META.general;
  const canEdit   = post.author?._id === currentUserId;
  const canDelete = isAdmin || post.author?._id === currentUserId;

  return (
    <div className={`rounded-2xl border bg-white dark:bg-gray-900 ${post.pinned ? 'border-amber-300 dark:border-amber-700/60' : 'border-gray-200/80 dark:border-gray-800/80'}`}>
      <div className="p-5">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {post.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
            {!editing && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag.color}`}>{tag.label}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{post.author?.name}</span>
            <span>·</span>
            <span>{formatDate(post.createdAt)}</span>
            {!editing && canEdit && (
              <button onClick={startEdit} className="rounded p-0.5 hover:text-indigo-500" title="Edit post">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!editing && canDelete && (
              <button onClick={() => setDeletePostOpen(true)} className="rounded p-0.5 hover:text-rose-500" title="Delete post">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <form onSubmit={submitEdit} className="space-y-2.5">
            <input
              required maxLength={200} value={editForm.title} onChange={setField('title')}
              className="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm font-semibold focus:border-indigo-400 focus:outline-none dark:border-gray-700"
            />
            <textarea
              required rows={3} maxLength={5000} value={editForm.body} onChange={setField('body')}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
            />
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => setEditForm((f) => ({ ...f, tag: t }))}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity ${TAG_META[t].color} ${editForm.tag === t ? 'opacity-100 ring-2 ring-indigo-400 ring-offset-1' : 'opacity-50'}`}
                >
                  {TAG_META[t].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="submit" disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button" onClick={cancelEdit}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="font-semibold">{post.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{post.body}</p>
          </>
        )}

        {!editing && (
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={handleLikePost}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${post.liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'}`}
            >
              <Heart className={`h-4 w-4 ${post.liked ? 'fill-rose-500' : ''}`} />
              {post.likes?.length ?? 0}
            </button>
            <button
              onClick={handleExpand}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-indigo-600"
            >
              <Reply className="h-4 w-4" />
              {post.replyCount ?? 0} {post.replyCount === 1 ? 'reply' : 'replies'}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 dark:border-gray-800">
          {loadingReplies && (
            <div className="space-y-2 pb-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {replies && replies.length > 0 && (
            <ul className="mb-3 space-y-3">
              {replies.map((r) => (
                <li key={r._id} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {r.author?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{r.author?.name}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{formatDate(r.createdAt)}</span>
                        {(isAdmin || r.author?._id === currentUserId) && (
                          <button onClick={() => setDeleteReplyId(r._id)} className="hover:text-rose-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{r.body}</p>
                    <button
                      onClick={() => handleLikeReply(r._id)}
                      className={`mt-1 flex items-center gap-1 text-xs ${r.liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'}`}
                    >
                      <Heart className={`h-3 w-3 ${r.liked ? 'fill-rose-500' : ''}`} />
                      {r.likes?.length ?? 0}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ReplyBox
            postId={post._id}
            onReplied={(r) => {
              setReplies((prev) => [...(prev || []), r]);
              setPost((p) => ({ ...p, replyCount: (p.replyCount || 0) + 1 }));
            }}
          />
        </div>
      )}

      <Modal open={deletePostOpen} onClose={() => setDeletePostOpen(false)} title="Delete post?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This will permanently remove the post and all its replies. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeletePostOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancel
            </button>
            <Button variant="danger" size="sm" onClick={handleDeletePost}>
              Delete post
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteReplyId} onClose={() => setDeleteReplyId(null)} title="Delete reply?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This will permanently remove the reply. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteReplyId(null)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancel
            </button>
            <Button variant="danger" size="sm" onClick={handleDeleteReply}>
              Delete reply
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function DiscussionsPage() {
  useDocumentTitle('Discussions');
  const { user } = useAuth();
  const [posts, setPosts]     = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage]       = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tag, setTag]         = useState('');
  const [q, setQ]             = useState('');
  const searchTimer = useRef(null);

  const load = (params) =>
    listPosts({ ...params, page: 1 })
      .then((res) => {
        setPosts(res.data.posts);
        setHasMore(res.data.hasMore);
        setPage(1);
      })
      .catch(() => setPosts([]));

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await listPosts({ tag: tag || undefined, q: q || undefined, page: nextPage });
      setPosts((prev) => [...prev, ...res.data.posts]);
      setHasMore(res.data.hasMore);
      setPage(nextPage);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  useEffect(() => { load({}); }, []);

  const handleFilter = (newTag) => {
    const t = newTag === tag ? '' : newTag;
    setTag(t);
    load({ tag: t || undefined, q: q || undefined });
  };

  const handleSearch = (e) => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load({ tag: tag || undefined, q: v || undefined });
    }, 320);
  };

  return (
    <Page>
      <div className="mb-4">
        <h1 className="text-xl font-bold">Discussions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions, share wins, help batchmates</p>
      </div>

      <NewPostForm onCreated={(post) => setPosts((prev) => [post, ...(prev || [])])} />

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <input
          value={q} onChange={handleSearch} placeholder="Search discussions…"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t} onClick={() => handleFilter(t)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity ${TAG_META[t].color} ${tag === t ? 'opacity-100 ring-2 ring-indigo-400 ring-offset-1' : 'opacity-60 hover:opacity-80'}`}
            >
              {TAG_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {!posts ? (
        <FeedSkeleton count={5} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No discussions yet"
          subtitle="Be the first — ask a question or share an update."
        />
      ) : (
        <>
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard
                key={p._id}
                post={p}
                currentUserId={user?._id || user?.id}
                isAdmin={user?.role === 'admin'}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full rounded-2xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </Page>
  );
}
