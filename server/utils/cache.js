/**
 * Simple in-memory cache for read-heavy, non-per-user data.
 *
 * Cached items have a TTL. The cache is a plain Map — no LRU eviction
 * because the data sizes are modest (KB per entry) and the number of keys
 * is bounded by the number of distinct cache keys the app uses (~20-50).
 *
 * Use for: company profiles, news items, briefing content, market snapshots,
 * resume tips, reflections — anything that is the same for all users and
 * doesn't change more than once per cache TTL.
 *
 * Do NOT use for: per-user data (tasks, notes, finance), which belongs in
 * a client-side cache (TanStack Query) or server-side per-request caching.
 */
const cache = new Map();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a value from cache.
 * Returns undefined if the key doesn't exist or is expired.
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Set a value in cache.
 * @param {string} key
 * @param {*} value — must be JSON-serializable
 * @param {number} [ttlMs] — time to live in milliseconds
 */
function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  });
}

/**
 * Delete a key.
 */
function del(key) {
  cache.delete(key);
}

/**
 * Clear all cached entries.
 */
function flush() {
  cache.clear();
}

/**
 * Return cache statistics (for monitoring/debugging).
 */
function stats() {
  const now = Date.now();
  let alive = 0;
  let expired = 0;
  for (const [, entry] of cache) {
    if (now > entry.expiresAt) expired++;
    else alive++;
  }
  return { size: cache.size, alive, expired };
}

module.exports = { get, set, del, flush, stats };
