/**
 * Stock refresh behaviour.
 *
 * Yahoo is stubbed via global.fetch so these assertions are about our own
 * logic — the pooled fetch, the 5d/1y range tiering, pruning, and the
 * staleness gate on the read path — not about the upstream feed being up.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');

const UNIVERSE = require('../config/stockUniverse');
const StockQuote = require('../models/StockQuote');
const { refreshStocks, refreshStocksIfStale } = require('../services/stockFetcher');

const realFetch = global.fetch;

// A chart response shaped like Yahoo's, with `n` daily closes.
function chartBody({ price, closes, low52, high52 }) {
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: price,
            fiftyTwoWeekLow: low52,
            fiftyTwoWeekHigh: high52,
          },
          indicators: { quote: [{ close: closes }] },
        },
      ],
    },
  };
}

let requestedUrls = [];

function stubYahoo({ price = 100, failFor = [] } = {}) {
  global.fetch = jest.fn(async (url) => {
    requestedUrls.push(url);
    if (failFor.some((s) => url.includes(s))) {
      return { ok: false, status: 404 };
    }
    const full = url.includes('range=1y');
    return {
      ok: true,
      status: 200,
      json: async () =>
        chartBody({
          price,
          closes: full ? [80, 90, price] : [price - 5, price],
          low52: full ? 50 : undefined,
          high52: full ? 150 : undefined,
        }),
    };
  });
}

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  global.fetch = realFetch;
  await StockQuote.deleteMany({});
  await disconnectTestDb();
});

beforeEach(async () => {
  requestedUrls = [];
  await StockQuote.deleteMany({});
});

describe('refreshStocks', () => {
  it('writes a quote for every symbol in the universe', async () => {
    stubYahoo({ price: 100 });
    const { live } = await refreshStocks();

    expect(live).toBe(UNIVERSE.length);
    expect(await StockQuote.countDocuments()).toBe(UNIVERSE.length);

    const tcs = await StockQuote.findOne({ symbol: 'TCS' }).lean();
    expect(tcs.price).toBe(100);
    expect(tcs.name).toBe('Tata Consultancy Services');
    expect(tcs.sector).toBe('it');
    // Previous close is the second-to-last candle, never meta.chartPreviousClose.
    expect(tcs.previousClose).toBe(90);
  });

  it('keeps going when individual symbols fail', async () => {
    stubYahoo({ price: 100, failFor: ['TCS.NS', 'INFY.NS'] });
    const { live } = await refreshStocks();

    expect(live).toBe(UNIVERSE.length - 2);
    expect(await StockQuote.findOne({ symbol: 'TCS' })).toBeNull();
    expect(await StockQuote.countDocuments()).toBe(UNIVERSE.length - 2);
  });

  it('pulls a full year on first sight, then only 5 days', async () => {
    stubYahoo({ price: 100 });
    await refreshStocks();
    expect(requestedUrls.every((u) => u.includes('range=1y'))).toBe(true);

    requestedUrls = [];
    stubYahoo({ price: 110 });
    await refreshStocks();

    // Ranges are fresh now, so the second pass is cheap.
    expect(requestedUrls.every((u) => u.includes('range=5d'))).toBe(true);
    const tcs = await StockQuote.findOne({ symbol: 'TCS' }).lean();
    expect(tcs.price).toBe(110);
    // 5d carries no range data — the stored year must survive untouched.
    expect(tcs.low52).toBe(50);
    expect(tcs.high52).toBe(150);
  });

  it('widens a stored range when the price breaks out of it', async () => {
    stubYahoo({ price: 100 });
    await refreshStocks();

    stubYahoo({ price: 999 }); // above the stored 52-week high of 150
    await refreshStocks();

    const tcs = await StockQuote.findOne({ symbol: 'TCS' }).lean();
    expect(tcs.price).toBe(999);
    expect(tcs.high52).toBe(999);
    expect(tcs.low52).toBe(50);
  });

  it('prunes quotes whose symbol has left the universe', async () => {
    stubYahoo({ price: 100 });
    await StockQuote.create({
      symbol: 'DELISTED', name: 'Gone Ltd', sector: 'it',
      price: 1, low52: 1, high52: 2,
    });

    await refreshStocks();

    expect(await StockQuote.findOne({ symbol: 'DELISTED' })).toBeNull();
    expect(await StockQuote.countDocuments()).toBe(UNIVERSE.length);
  });
});

describe('refreshStocksIfStale', () => {
  it('fetches when nothing is cached', async () => {
    stubYahoo({ price: 100 });
    const res = await refreshStocksIfStale();
    expect(res.skipped).toBeUndefined();
    expect(await StockQuote.countDocuments()).toBe(UNIVERSE.length);
  });

  it('skips while the cache is inside the staleness window', async () => {
    stubYahoo({ price: 100 });
    await refreshStocksIfStale();

    requestedUrls = [];
    const res = await refreshStocksIfStale();
    expect(res.skipped).toBe(true);
    expect(requestedUrls).toHaveLength(0);
  });

  it('refetches once the cache ages past the window', async () => {
    stubYahoo({ price: 100 });
    await refreshStocksIfStale();

    // Age every quote past the 15-minute window.
    await StockQuote.updateMany({}, { $set: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) } }, { timestamps: false });

    requestedUrls = [];
    stubYahoo({ price: 120 });
    const res = await refreshStocksIfStale();

    expect(res.skipped).toBeUndefined();
    expect(requestedUrls.length).toBeGreaterThan(0);
    expect((await StockQuote.findOne({ symbol: 'TCS' }).lean()).price).toBe(120);
  });

  it('collapses concurrent callers into a single refresh', async () => {
    stubYahoo({ price: 100 });
    const [a, b, c] = await Promise.all([
      refreshStocksIfStale(),
      refreshStocksIfStale(),
      refreshStocksIfStale(),
    ]);

    // One pass over the universe, not three.
    expect(requestedUrls).toHaveLength(UNIVERSE.length);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
