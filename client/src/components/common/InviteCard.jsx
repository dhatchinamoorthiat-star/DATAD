import { useEffect, useState } from 'react';
import toast from '../../utils/toast';
import { Gift, Copy, MessageCircle } from 'lucide-react';
import { getMe } from '../../api/auth';

export const whatsappInviteUrl = (code) => {
  const text =
    `Hey! Join our batch on DATAD — shared notes, planner, finance tools, resume builder & more. ` +
    `Register with my one-time referral code *${code}* for instant access (it only works once, so it's yours!): ` +
    `${window.location.origin}/register`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

// Dashboard banner: shows the member's unused one-time code with copy +
// WhatsApp share. Renders nothing while loading or once the code is spent.
export default function InviteCard() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    getMe()
      .then((res) => setMe(res.data))
      .catch(() => {});
  }, []);

  if (!me?.referralCode || me.referralUsedBy) return null;

  const copy = () => {
    navigator.clipboard.writeText(me.referralCode);
    toast.success('Referral code copied');
  };

  return (
    <div className="card-hover mt-4 flex flex-col gap-3 rounded-2xl border border-indigo-200/70 bg-indigo-50 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Invite a batchmate</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your one-time code lets exactly one friend skip the approval queue.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <code className="rounded-lg bg-white/80 px-3 py-2 font-mono text-sm font-bold tracking-wider text-indigo-700 dark:bg-gray-900/60 dark:text-indigo-300">
          {me.referralCode}
        </code>
        <button
          onClick={copy}
          aria-label="Copy referral code"
          className="rounded-lg border border-indigo-200 p-2 text-indigo-600 hover:bg-white/70 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-gray-900/50"
        >
          <Copy className="h-4 w-4" />
        </button>
        <a
          href={whatsappInviteUrl(me.referralCode)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700"
        >
          <MessageCircle className="h-4 w-4" /> Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
