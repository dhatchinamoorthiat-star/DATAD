/**
 * RBAC tier gate — wraps premium features.
 * Shows children when the user meets the requirement; otherwise shows a lock
 * panel explaining WHY the feature is premium.
 *
 * Prefer `feature` over `required`.
 *
 *   <TierGate feature={FEATURE.RESUME_ATS}>        ← follows the server
 *   <TierGate required="pro">                      ← hardcoded, can drift
 *
 * `feature` resolves against the capabilities map the server computes from
 * subscription/featureRegistry.js, so moving a feature between tiers there
 * updates every gate and every lock label automatically. `required` hardcodes a
 * tier on the client, which is how the UI came to unlock Placement-only tools
 * for Pro users and let them walk into a 403. It is kept only for the handful of
 * gates that guard a whole page rather than one registry feature.
 *
 * Props:
 *   feature      string — a FEATURE key from the server registry (preferred)
 *   required     'trial' | 'pro' | 'placement' — fallback when there is no
 *                registry feature. Ignored when `feature` is given.
 *   description  string — one sentence explaining the value (shown when locked)
 *   inline       boolean — compact inline badge instead of full block panel
 */
import { Link } from 'react-router-dom';
import { Crown, Lock } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { tierTheme } from '../../utils/tiers';
import { FEATURE_MIN_TIER } from '../../utils/planFeatures';

const DEFAULT_DESCRIPTIONS = {
  trial: 'Start your free trial to use the AI study tools.',
  pro: 'Included with Pro — your everyday study and career toolkit.',
  placement: 'Part of the Placement Pass, for the season that decides the offer.',
};

export default function TierGate({ feature, required = 'pro', description, inline = false, children }) {
  const sub = useSubscription();

  // Fail open while context loads (brief flash avoided by subscription fetch on mount)
  if (!sub) return children;

  const unlocked = feature ? sub.hasFeature(feature) : sub.hasAccess(required);
  if (unlocked) return children;

  // Name the plan the student actually has to buy. For a registry feature that
  // is whatever tier owns it today, not whatever this call site was written with.
  const gateTier = (feature && FEATURE_MIN_TIER[feature]) || required;
  const { label, colors: c } = tierTheme(gateTier);
  const desc = description || DEFAULT_DESCRIPTIONS[gateTier] || DEFAULT_DESCRIPTIONS.pro;

  if (inline) {
    return (
      <Link
        to="/subscribe"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 ${c.inline}`}
      >
        <Crown className="h-3 w-3" /> Unlock with {label}
      </Link>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center ${c.bg} ${c.border}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${c.iconBg}`}>
        <Lock className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div className="max-w-xs">
        <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${c.badge}`}>
          <Crown className="h-3 w-3" /> DATAD {label}
        </div>
        <p className="font-semibold text-gray-800 dark:text-gray-200">
          ✨ Unlock with DATAD {label}
        </p>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
      <Link
        to="/subscribe"
        className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${c.btn}`}
      >
        View Plans
      </Link>
    </div>
  );
}
