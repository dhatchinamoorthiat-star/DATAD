/**
 * Classify a failed Dax chat request into a UI-ready shape, shared by every
 * surface that talks to Dax (the embedded DaxPanel, the full-page DaxApp
 * experience) so "Dax failed to respond" means the same thing everywhere —
 * a 429 always reads as a rate limit with an upgrade path, not a generic
 * connection error, no matter which surface hit it.
 */
export function classifyDaxError(err) {
  // Axios v1 rejects an aborted request with a CanceledError (code
  // ERR_CANCELED), not the native fetch AbortError — check both so a
  // client-side Stop always resolves cleanly instead of surfacing as a
  // generic failure.
  const wasAborted =
    err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';
  if (wasAborted) return { wasAborted: true, status: null, message: null, upgradeUrl: null };

  const status = err?.response?.status;
  const message =
    status === 429
      ? err.response.data?.message || 'Daily message limit reached.'
      : err?.response?.data?.message || 'Dax ran into a problem answering that. Please try again.';

  return { wasAborted: false, status, message, upgradeUrl: err?.response?.data?.upgradeUrl };
}
