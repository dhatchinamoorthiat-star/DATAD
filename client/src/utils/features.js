/**
 * Lightweight feature flags for the beta.
 *
 * Flags are configured via VITE_FF_* environment variables in client/.env.
 * A flag is ON by default; set to 'false' to disable.
 *
 * Usage:
 *   import { isEnabled } from '../../utils/features';
 *   if (isEnabled('roadmapBrowseRoles')) { ... }
 *
 * Flag names are camelCase versions of the FF_ env vars (without the prefix).
 */
const PREFIX = 'VITE_FF_';
const DEFAULTS = {
  roadmapBrowseRoles: true,
  roadmapWeeklyTrend: true,
  dashboardOnboardingCard: true,
  roleDiscovery: true,
};

export function isEnabled(name) {
  // Explicit env var wins.
  const envKey = `${PREFIX}${name
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()}`;
  const envVal = import.meta.env[envKey];
  if (envVal !== undefined) return envVal !== 'false';
  // Fallback to default.
  return DEFAULTS[name] !== false;
}
