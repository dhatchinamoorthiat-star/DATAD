/**
 * Build a MongoDB regex from user-supplied search text.
 *
 * Search boxes across the app fed `req.query.*` straight into `new RegExp(…)`
 * and put the result in a query. Two things go wrong with that.
 *
 * INJECTION / ReDoS. The value is a pattern, not a literal, so the caller —
 * any authenticated student — chooses the matching program that MongoDB then
 * runs over the collection. `(a+)+$` and friends backtrack catastrophically:
 * one short query string can pin a database thread for as long as the server
 * will let it, and the request costs the attacker nothing to repeat. It also
 * lets the pattern match documents the plain substring never would.
 *
 * CRASHES. Metacharacters do not have to be malicious to break the endpoint.
 * A student searching for "C++" or an unclosed "[" is an invalid pattern, and
 * `new RegExp` throws — turning an ordinary search into a 500.
 *
 * Escaping every metacharacter fixes both: the input becomes a literal
 * substring match, which is what a search box means in the first place.
 */

// Every character with meaning in a regex. `-` is included for safety inside
// character classes even though we never build one.
const METACHARACTERS = /[.*+?^${}()|[\]\\\-]/g;

/**
 * Longest search string we will turn into a pattern. Well past any real query,
 * and short enough that even a pathological input stays cheap to scan.
 */
const MAX_PATTERN_LENGTH = 100;

/** Escape `input` so it matches literally inside a regex. */
function escapeRegex(input) {
  return String(input ?? '').replace(METACHARACTERS, '\\$&');
}

/**
 * A case-insensitive literal-substring RegExp, or null when there is nothing
 * usable to search for.
 *
 * Returning null rather than an empty pattern matters: `new RegExp('')` matches
 * every document, so a blank search would silently become "return everything".
 * Callers should skip adding the filter when this is null.
 */
function searchRegex(input) {
  const trimmed = String(input ?? '').trim().slice(0, MAX_PATTERN_LENGTH);
  if (!trimmed) return null;
  return new RegExp(escapeRegex(trimmed), 'i');
}

module.exports = { escapeRegex, searchRegex, MAX_PATTERN_LENGTH };
