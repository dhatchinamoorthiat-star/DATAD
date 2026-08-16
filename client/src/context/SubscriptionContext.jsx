import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus } from '../api/subscription';

const SubscriptionContext = createContext(null);

// Mirrors server/subscription/tierHierarchy.js.
const TIER_RANK = { free: 0, trial: 1, pro: 2, placement: 3 };

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState({ tier: 'free', tierExpiresAt: null, trialUsed: false, capabilities: {} });
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getSubscriptionStatus()
      .then((res) => setStatus(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const tier = status?.tier ?? user?.tier ?? 'free';
  const tierExpiresAt = status?.tierExpiresAt ? new Date(status.tierExpiresAt) : null;
  const trialUsed = !!status?.trialUsed;
  const capabilities = status?.capabilities ?? {};
  const credits = status?.credits ?? status?.aiQuota ?? null; // {used, limit, remaining}
  const chatQuota = status?.chatQuota ?? null;

  const daysLeft = tierExpiresAt
    ? Math.max(0, Math.ceil((tierExpiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
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
