import { Link } from 'react-router-dom';
import {
  Handshake,
  Megaphone, Camera, Archive, ArrowRight, Pin, ShoppingBag, Award,
  MessageSquare, 
} from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { listAnnouncements } from '../../api/admin';
import { listPosts } from '../../api/posts';
import { listRecentPhotos } from '../../api/photos';
import { formatDate } from '../../utils/dateUtils';
import { FeedSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import DailyTip from '../../components/common/DailyTip';
import { Page } from '../../components/common/motion';
import useAsync from '../../hooks/useAsync';

export default function CommunityHubPage() {
  useDocumentTitle('Community');

  const { data, error, loading, reload } = useAsync(async () => {
    const [announcementsRes, postsRes, photosRes] = await Promise.allSettled([
      listAnnouncements(),
      listPosts({ limit: 4 }),
      listRecentPhotos(),
    ]);
    // Both sections failing is a real error, not an empty campus — otherwise
    // the hub renders as a ghost town and the student assumes nothing happened.
    if (announcementsRes.status === 'rejected' && postsRes.status === 'rejected') {
      throw announcementsRes.reason;
    }
    const announcements = announcementsRes.status === 'fulfilled' ? announcementsRes.value.data.slice(0, 3) : [];
    const raw = postsRes.status === 'fulfilled' ? postsRes.value.data : {};
    const posts = (raw.posts || raw).slice(0, 4);
    // Deliberately not part of the both-failed check above: the gallery strip is
    // a preview, and losing it should never turn the hub into an error page.
    const photos = photosRes.status === 'fulfilled' ? (photosRes.value.data || []).slice(0, 4) : [];
    return { announcements, posts, photos };
  }, []);

  if (loading) return <div className="mx-auto w-full max-w-3xl px-4 py-6"><FeedSkeleton count={4} /></div>;
  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <ErrorState title="Could not load your community" onRetry={reload} />
      </div>
    );
  }

  return (
    <Page overview={{
      pageKey: 'community-hub',
      title: 'Your Community home base',
      blurb: 'One jump-off point for everything the batch shares — feed, announcements, gallery, marketplace and skills.',
      takeaway: 'Start here, then dive into whichever section you need.',
    }}>
      <div className="mb-4">
        <h1 className="text-xl font-bold">Community</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Everything the batch shares</p>
      </div>

      <DailyTip workspace="community" className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Feed preview */}
        <div className="card-hover rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <MessageSquare className="h-4 w-4 text-primary-500" /> Feed
            </h2>
            <Link to="/community/feed" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              Open <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div>
              <p className="text-sm text-gray-400">Nothing posted yet.</p>
              <Link to="/community/feed" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
                Be the first to post <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {data.posts.map((p) => (
                <li key={p._id}>
                  <Link to="/community/feed" className="block text-sm hover:text-primary-600">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-xs text-gray-400">
                      {p.author?.name} · {formatDate(p.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Announcements */}
        <div className="card-hover rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Megaphone className="h-4 w-4 text-primary-500" /> Announcements
            </h2>
            <Link to="/community/announcements" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.announcements.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing announced yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.announcements.map((a) => (
                <li key={a._id} className="text-sm">
                  <p className="font-medium">
                    {a.pinned && <Pin className="mr-1 inline h-3 w-3 text-amber-500" />}
                    {a.title}
                  </p>
                  <p className="text-xs text-gray-400">{a.createdBy?.name} · {formatDate(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Gallery — a live strip once the batch has uploaded anything, and the
            plain tile until then, so an empty gallery still reads as an invitation. */}
        <Link to="/community/memories" className="card-hover block rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <Camera className="mb-2 h-5 w-5 text-primary-500" />
          <p className="font-semibold">Gallery</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Batch albums and photos</p>
          {data.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {data.photos.map((photo) => (
                <img
                  key={photo._id}
                  src={photo.url}
                  alt={photo.caption || `Photo in ${photo.album?.title || 'the gallery'}`}
                  loading="lazy"
                  className="h-14 w-full rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </Link>

        {/* BatchVault (formerly Nostalgia Archive) */}
        <Link to="/community/memories" className="card-hover block rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <Archive className="mb-2 h-5 w-5 text-purple-500" />
          <p className="font-semibold">BatchVault</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Memories, throwbacks and batch milestones</p>
        </Link>

        {/* Marketplace */}
        <Link to="/community/marketplace" className="card-hover block rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <ShoppingBag className="mb-2 h-5 w-5 text-emerald-500" />
          <p className="font-semibold">Marketplace</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Buy, sell and exchange within the batch</p>
        </Link>

        {/* Skills */}
        <Link to="/community/skills" className="card-hover block rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <Award className="mb-2 h-5 w-5 text-amber-500" />
          <p className="font-semibold">Skills Exchange</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Teach, learn and collaborate with batchmates</p>
        </Link>

        <Link to="/community/talent" className="card-hover block rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <Handshake className="mb-2 h-5 w-5 text-emerald-500" />
          <p className="font-semibold">Talent Exchange</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Ask the batch for help, or offer what you are good at</p>
        </Link>
      </div>

    </Page>
  );
}
