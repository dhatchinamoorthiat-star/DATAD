const StockQuote = require('../models/StockQuote');

// Same keyless Yahoo Finance chart endpoint already used by marketFetcher.js
// for indices — no API key, no paid contract, so nothing to license or leak.
// A full year of daily candles gives us a real 52-week low/high per stock
// instead of a guess.
const WATCHLIST = [
  { symbol: 'TCS.NS',       label: 'TCS',       name: 'Tata Consultancy Services', sector: 'IT services' },
  { symbol: 'HDFCBANK.NS',  label: 'HDFCBANK',  name: 'HDFC Bank',                 sector: 'Banking' },
  { symbol: 'INFY.NS',      label: 'INFY',      name: 'Infosys',                   sector: 'IT services' },
  { symbol: 'ITC.NS',       label: 'ITC',       name: 'ITC',                       sector: 'FMCG' },
  { symbol: 'RELIANCE.NS',  label: 'RELIANCE',  name: 'Reliance Industries',       sector: 'Energy/Retail' },
  { symbol: 'MARUTI.NS',    label: 'MARUTI',    name: 'Maruti Suzuki',             sector: 'Auto' },
];

async function fetchOne({ symbol, label, name, sector }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DATAD/1.0)' } });
  if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close?.filter((n) => typeof n === 'number') || [];
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error(`No price for ${symbol}`);

  // Yahoo's meta.fiftyTwoWeekLow/High is usually present; fall back to the
  // candle series itself (plus current price, in case today's move is a
  // new extreme the meta block hasn't caught up to yet).
  const low52 = Math.min(meta.fiftyTwoWeekLow ?? Infinity, ...closes, meta.regularMarketPrice);
  const high52 = Math.max(meta.fiftyTwoWeekHigh ?? -Infinity, ...closes, meta.regularMarketPrice);

  // meta.chartPreviousClose is NOT yesterday's close — with range=1y it's the
  // close from just before the whole 1-year window, ~370 days back. The last
  // entry in the daily candle series is today; the one before it is the real
  // previous session's close.
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : undefined;

  return {
    symbol: label,
    name,
    sector,
    price: meta.regularMarketPrice,
    previousClose,
    low52,
    high52,
  };
}

// Refresh every tracked stock and upsert each quote in place. Partial
// failures are fine — whatever succeeds gets written, stale symbols just
// keep yesterday's numbers until the next run.
async function refreshStocks() {
  const results = await Promise.allSettled(WATCHLIST.map(fetchOne));
  const quotes = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) failed.forEach((f) => console.error('Stock fetch failed:', f.reason?.message));

  await Promise.all(
    quotes.map((q) => StockQuote.findOneAndUpdate({ symbol: q.symbol }, q, { upsert: true }))
  );

  console.log(`Stock refresh: ${quotes.length}/${WATCHLIST.length} quotes live`);
  return { live: quotes.length };
}

module.exports = { refreshStocks, WATCHLIST };
