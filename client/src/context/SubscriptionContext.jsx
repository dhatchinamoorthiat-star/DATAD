import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus } from '../api/subscription';
import { TIER_RANK, normalizeTier } from '../utils/tiers';
import useNow from '../hooks/useNow';

const SubscriptionContext = createContext(null);

const MAX_RANK = Math.max(...Object.values(TIER_RANK));

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState({ tier: 'free', tierExpiresAt: null, trialUsed: false, capabilities: {} });
  const [loading, setLoading] = useState(false);
  // Distinct from `!loading`: before the first response `loading` is also
  // false, and `capabilities` is an empty object that reads as "nothing is
  // permitted". A caller that skips a request when a capability is absent
  // needs to tell "not allowed" apart from "not asked yet", or it suppresses
  // the feature for the people who paid for it.
  const [loaded, setLoaded] = useState(false);
  const now = useNow();

  // Keyed on the id, not the user object: a new object identity for the same
  // signed-in user must not refire the request.
  const userId = user?.id;
  const fetch = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getSubscriptionStatus()
      .then((res) => {
        setStatus(res.data);
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    // Scheduled, not called inline: the loader flips loading state
    // synchronously, which cascades an extra render from the effect body.
    queueMicrotask(fetch);
  }, [fetch]);

  const tier = status?.tier ?? user?.tier ?? 'free';
  const tierExpiresAt = status?.tierExpiresAt ? new Date(status.tierExpiresAt) : null;
  const trialUsed = !!status?.trialUsed;
  const capabilities = status?.capabilities ?? {};
  const credits = status?.credits ?? status?.aiQuota ?? null; // {used, limit, remaining}
  const chatQuota = status?.chatQuota ?? null;

  const daysLeft = tierExpiresAt
    ? Math.max(0, Math.ceil((tierExpiresAt - now) / (24 * 60 * 60 * 1000)))
    : null;

  // Unknown `required` values fail CLOSED. This previously fell back to `?? 1`,
  // i.e. trial — so `<TierGate required="max">` (a tier the server retired)
  // resolved to a trial-level gate and showed the Placement-only Career Advisor
  // to trial users, who then got a 403 from the API. A gate we cannot resolve
  // must be the strictest one, never the loosest.
  const hasAccess = (required) => {
    const need = TIER_RANK[normalizeTier(required)];
    return (TIER_RANK[normalizeTier(tier)] ?? 0) >= (need ?? MAX_RANK);
  };

  const hasFeature = (feature) => capabilities[feature] === true;

  return (
    <SubscriptionContext.Provider value={{ tier, tierExpiresAt, trialUsed, daysLeft, loading, loaded, hasAccess, hasFeature, capabilities, credits, chatQuota, refresh: fetch }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
