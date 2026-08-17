const StockQuote = require('../models/StockQuote');
const UNIVERSE = require('../config/stockUniverse');

// Same keyless Yahoo Finance chart endpoint already used by marketFetcher.js
// for indices — no API key, no paid contract, so nothing to license or leak.
//
// This mirrors services/newsFetcher.js: the source list lives in config/, every
// symbol is fetched independently so one failure never blocks the rest, results
// are upserted in place, and anything no longer in the config is pruned.
//
// The one structural difference from news is call volume. Yahoo's batch quote
// endpoint (v7/finance/quote) now answers 401 without a session crumb, so the
// per-symbol chart endpoint is the only keyless option and the universe costs
// one HTTP call each. Hence the concurrency limit and the two-tier range below.

// Yahoo tolerates a handful of parallel requests but starts refusing a burst of
// fifty. Six at a time keeps the whole universe under ~10s without tripping it,
// and bounds peak memory on a 512 MB instance — each 1y response is ~100 KB of
// JSON and we only ever hold a few at once.
const CONCURRENCY = 6;

// 15 minutes: matches the indices refresh in marketFetcher, and is well inside
// what the page's disclaimer promises the user.
const STALE_AFTER_MS = 15 * 60 * 1000;

// A 52-week range barely moves intraday, but a price moves constantly. Pulling
// a full year of candles for every symbol every 15 minutes would be ~5 MB of
// JSON per cycle to recompute numbers that changed in the third decimal. So the
// year is refetched at most daily, and routine refreshes pull 5 days — enough
// for a price plus a real previous close.
const FULL_RANGE_AFTER_MS = 24 * 60 * 60 * 1000;

async function fetchOne({ symbol, label, name, sector }, { full }) {
  const range = full ? '1y' : '5d';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DATAD/1.0)' } });
  if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close?.filter((n) => typeof n === 'number') || [];
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error(`No price for ${symbol}`);

  // meta.chartPreviousClose is NOT yesterday's close — over a 1y window it is
  // the close from before the whole window, ~370 days back. The last entry in
  // the daily series is today; the one before it is the real previous session.
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : undefined;

  const quote = {
    symbol: label,
    yahooSymbol: symbol,
    name,
    sector,
    price: meta.regularMarketPrice,
    previousClose,
  };

  // On a 5d fetch the candle series says nothing useful about the 52-week
  // range, so leave the stored low52/high52 alone and only widen them if
  // today's price has broken out beyond what we already had.
  if (full) {
    quote.low52 = Math.min(meta.fiftyTwoWeekLow ?? Infinity, ...closes, meta.regularMarketPrice);
    quote.high52 = Math.max(meta.fiftyTwoWeekHigh ?? -Infinity, ...closes, meta.regularMarketPrice);
    quote.rangeUpdatedAt = new Date();
  }

  return quote;
}

// Run `fn` over `items` at most CONCURRENCY at a time, settling every one.
// Workers pull from a shared cursor so a slow symbol never stalls the others.
async function mapPooled(items, fn) {
  const settled = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        settled[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        settled[i] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return settled;
}

// Refresh the whole universe and upsert each quote in place. Partial failures
// are fine — whatever succeeds gets written, and a symbol that failed keeps the
// numbers from its last good run until the next cycle.
async function refreshStocks() {
  // Which symbols are due a full-year pull: anything we have never seen, or
  // whose stored range is over a day old.
  const cutoff = new Date(Date.now() - FULL_RANGE_AFTER_MS);
  const fresh = await StockQuote.find({ rangeUpdatedAt: { $gte: cutoff } }).select('symbol').lean();
  const rangeIsFresh = new Set(fresh.map((q) => q.symbol));

  const results = await mapPooled(UNIVERSE, (entry) =>
    fetchOne(entry, { full: !rangeIsFresh.has(entry.label) })
  );

  const quotes = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) failed.forEach((f) => console.error('Stock fetch failed:', f.reason?.message));

  await Promise.all(
    quotes.map((q) => {
      // A 5d quote carries no range fields; $max widens a stored range when
      // today's price breaks out, without clobbering it the rest of the time.
      const update = { $set: q };
      if (q.low52 === undefined) {
        update.$min = { low52: q.price };
        update.$max = { high52: q.price };
      }
      return StockQuote.updateOne({ symbol: q.symbol }, update, { upsert: true });
    })
  );

  // Prune quotes for symbols dropped from the config, so removing a line from
  // stockUniverse.js actually removes the card. Mirrors the news prune.
  const keep = UNIVERSE.map((e) => e.label);
  const { deletedCount } = await StockQuote.deleteMany({ symbol: { $nin: keep } });

  const total = await StockQuote.estimatedDocumentCount();
  console.log(
    `Stock refresh: ${quotes.length}/${UNIVERSE.length} quotes live, ${total} cached` +
    (deletedCount ? `, ${deletedCount} pruned` : '')
  );
  return { live: quotes.length, total };
}

// The cron alone is not enough to keep these quotes moving. This service runs
// on a free instance that spins down after ~15 minutes idle, so an in-process
// cron only fires if somebody happened to be using the app at that minute — a
// missed run means the page serves the same numbers indefinitely. So the read
// path refreshes on demand too: if what we hold is older than `maxAgeMs`, go
// and get new numbers.
//
// One in-flight refresh at a time. Fifty users opening the Stocks page together
// should cost one pass over the universe, not fifty.
let inFlight = null;

function refreshStocksIfStale(maxAgeMs = STALE_AFTER_MS) {
  if (inFlight) return inFlight;

  // `inFlight` has to be assigned before this function yields, so the staleness
  // lookup goes inside the promise rather than before it. Awaiting the lookup
  // first would let every concurrent caller pass the check before any of them
  // set the guard — which is precisely the spin-down case this exists for, when
  // a batch of requests arrives at once against a cold, stale cache.
  inFlight = (async () => {
    const newest = await StockQuote.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean();
    const ageMs = newest ? Date.now() - new Date(newest.updatedAt).getTime() : Infinity;
    if (ageMs < maxAgeMs) return { skipped: true, ageMs };
    return refreshStocks();
  })()
    .catch((err) => {
      console.error('Stock on-demand refresh failed:', err.message);
      return { live: 0, failed: true };
    })
    .finally(() => { inFlight = null; });

  return inFlight;
}

module.exports = { refreshStocks, refreshStocksIfStale, STALE_AFTER_MS, UNIVERSE };
