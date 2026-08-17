import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus } from '../api/subscription';
import useNow from '../hooks/useNow';

const SubscriptionContext = createContext(null);

// Mirrors server/subscription/tierHierarchy.js.
const TIER_RANK = { free: 0, trial: 1, pro: 2, placement: 3 };

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState({ tier: 'free', tierExpiresAt: null, trialUsed: false, capabilities: {} });
  const [loading, setLoading] = useState(false);
  const now = useNow();

  // Keyed on the id, not the user object: a new object identity for the same
  // signed-in user must not refire the request.
  const userId = user?.id;
  const fetch = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getSubscriptionStatus()
      .then((res) => setStatus(res.data))
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

  const hasAccess = (required) =>
    (TIER_RANK[tier] ?? 0) >= (TIER_RANK[required] ?? 1);

  const hasFeature = (feature) => capabilities[feature] === true;

  return (
    <SubscriptionContext.Provider value={{ tier, tierExpiresAt, trialUsed, daysLeft, loading, hasAccess, hasFeature, capabilities, credits, chatQuota, refresh: fetch }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
