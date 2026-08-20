// Deterministic daily rotation for fixed content pools.
//
// The problem this solves: pages like Money Basics or Study Techniques hold a
// hand-written list that never changes, so a student who opens them twice sees
// the identical page and stops opening them a third time. Rotating a featured
// item each day makes the same pool feel alive without any new infrastructure.
//
// Everything here is a pure function of the calendar date. No storage, no user
// state, no API — which means it is reproducible (pass `date` to test any day),
// it survives logout, and two students comparing screens see the same item.
// That shared-view property is deliberate: this content is meant to be talked
// about between classmates, so per-user shuffling would work against it.
//
// Generalised from the sector rotation in stocks.js, which does the same trick
// for the featured stock row.

// Days since the Unix epoch, in the *viewer's local timezone*.
//
// stocks.js computes this as `Date.now() / 86_400_000`, which rolls over at UTC
// midnight — 05:30 in India, i.e. mid-morning for most of the people using this.
// Normalising to local midnight first means "today's lesson" changes overnight
// like a reader expects, rather than partway through breakfast.
export function dayIndex(date = new Date()) {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(localMidnight.getTime() / 86_400_000);
}

// FNV-1a, 32-bit. Any cheap string hash works; this one is short and has no
// dependencies. It exists so each pool can be given its own offset.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Without a per-pool seed every rotation on the site would advance in lockstep
// — always index 4 everywhere on the same day — so a student who reads two
// pages sees the same *position* in both, and pools of equal length stay
// permanently correlated. The seed decorrelates them.
function offset(length, seedKey, date) {
  if (length <= 0) return 0;
  return (dayIndex(date) + hashSeed(seedKey)) % length;
}

// Today's featured item from `pool`. Returns undefined for an empty pool so
// callers can guard with a simple falsy check.
export function pickDaily(pool, seedKey, date) {
  if (!pool?.length) return undefined;
  return pool[offset(pool.length, seedKey, date)];
}

// The whole pool, rotated so today's featured item is first and the original
// authored order is otherwise preserved. Preserving that order matters: these
// lists are written to be read top-to-bottom, and a true shuffle would break
// sequences like "emergency fund first, then investing".
export function rotateOrder(pool, seedKey, date) {
  if (!pool?.length) return [];
  const at = offset(pool.length, seedKey, date);
  return [...pool.slice(at), ...pool.slice(0, at)];
}

// The first `count` items of the rotated order — for hub cards and empty states
// that have room for two or three, not the whole list.
export function pickDailyMany(pool, count, seedKey, date) {
  return rotateOrder(pool, seedKey, date).slice(0, Math.max(0, count));
}

// Split the rotated order into fixed-size pages, so a card can show `perPage`
// items and let the reader step through the rest on demand.
//
// Deliberately *not* a random draw. Random re-rolls repeat items the reader has
// already dismissed and can leave part of the pool unseen, which is the same
// "why bother" feeling the rotation exists to avoid. Paging guarantees every
// item is one or two taps away and that a lap through the deck shows each once.
//
// The last page is short rather than padded with wrapped-around duplicates: a
// visibly shorter final page is a truthful "that's the end of the list".
export function rotatedPages(pool, perPage, seedKey, date) {
  const order = rotateOrder(pool, seedKey, date);
  const size = Math.max(1, perPage);
  const pages = [];
  for (let i = 0; i < order.length; i += size) pages.push(order.slice(i, i + size));
  return pages;
}
