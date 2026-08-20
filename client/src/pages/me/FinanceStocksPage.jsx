import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Page } from '../../components/common/motion';
import { Skeleton } from '../../components/common/Skeleton';
import Modal from '../../components/common/Modal';
import { listStockQuotes, getStockInsight } from '../../api/finance';
import { SECTORS, sectorMeta, dailyRotation } from '../../utils/stocks';
import { DAX, DAX_CAPABILITY, DAX_THINKING } from '../../utils/dax';

const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Same filter chip as the Intelligence feed, so the two pages read alike.
const chip = (active) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
  }`;

// Where price sits in the low52-high52 range → a plain-language signal.
// <=35% of range = "closer to its low", >=75% = "closer to its high".
function signalFor(stock) {
  const { price, low52, high52 } = stock;
  const pct = (price - low52) / (high52 - low52);
  if (pct <= 0.35) {
    return { label: 'Closer to its 52-week low', tone: 'buy', Icon: TrendingUp,
      note: 'Historically this is nearer the cheaper end of its yearly range.' };
  }
  if (pct >= 0.75) {
    return { label: 'Closer to its 52-week high', tone: 'wait', Icon: TrendingDown,
      note: 'It\'s trading near the top of its yearly range — you\'d be paying more.' };
  }
  return { label: 'Middle of its yearly range', tone: 'hold', Icon: Minus,
    note: 'Neither cheap nor expensive right now — no rush either way.' };
}

const TONE_STYLES = {
  buy:  'bg-success-50 text-success-700 dark:bg-success-950/30 dark:text-success-400',
  wait: 'bg-danger-50 text-danger-700 dark:bg-danger-950/30 dark:text-danger-400',
  hold: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

// Dax explains the range signal the card already shows — what it means, why
// the stock might be sitting there, what to go and read. It never says whether
// to buy or sell, and the server rejects any generation that tries to.
//
// This lives in a modal rather than inside the card. Dax writes several
// paragraphs, and expanding one card in a responsive grid pushes its whole row
// out of alignment — the grid stops reading as a set of comparable tiles, which
// is the entire point of the layout.
function DaxInsightBody({ state, insight, onRetry }) {
  if (state === 'loading') {
    return <p className="py-6 text-center text-sm text-gray-400">{DAX_THINKING}</p>;
  }

  if (state === 'error') {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        {DAX} couldn't explain this one right now.{' '}
        <button type="button" onClick={onRetry} className="underline">Try again</button>
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-700 dark:text-gray-300">{insight.whatTheNumberSays}</p>
      {insight.whyItMightBeHere && (
        <p className="text-gray-600 dark:text-gray-400">{insight.whyItMightBeHere}</p>
      )}
      {insight.sectorContext && (
        <p className="text-gray-600 dark:text-gray-400">{insight.sectorContext}</p>
      )}
      {insight.whatToReadNext?.length > 0 && (
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Before you form a view, check:
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-400">
            {insight.whatToReadNext.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}
      {insight.conceptToLearn?.term && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {insight.conceptToLearn.term}
          </span>
          {' — '}{insight.conceptToLearn.explanation}
        </p>
      )}
      <p className="border-t border-gray-100 pt-2.5 text-[11px] text-gray-400 dark:border-gray-800">
        {DAX} explains what the numbers show. It doesn't tell you what to buy or sell — that isn't
        something this page does.
      </p>
    </div>
  );
}

function StockCard({ stock }) {
  const { label, tone, Icon, note } = useMemo(() => signalFor(stock), [stock]);
  const change = stock.previousClose ? stock.price - stock.previousClose : null;

  const [open, setOpen] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [insight, setInsight] = useState(null);

  const load = () => {
    setState('loading');
    getStockInsight(stock.symbol)
      .then((res) => { setInsight(res.data); setState('ready'); })
      .catch(() => setState('error'));
  };

  const openInsight = () => {
    setOpen(true);
    // Cached server-side for a day, so reopening a card is cheap — but don't
    // refetch what is already on screen.
    if (state !== 'ready') load();
  };
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stock.symbol}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stock.name} · {sectorMeta(stock.sector).label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tabular-nums">{inr(stock.price)}</p>
          {change !== null && (
            <p className={`text-[11px] font-medium tabular-nums ${change >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {change >= 0 ? '+' : ''}{inr(change)} today
            </p>
          )}
        </div>
      </div>

      <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${TONE_STYLES[tone]}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>

      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
        <span>52-wk low {inr(stock.low52)}</span>
        <span>52-wk high {inr(stock.high52)}</span>
      </div>

      <button
        type="button"
        onClick={openInsight}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Ask {DAX} to explain this
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${DAX_CAPABILITY.insights} · ${stock.symbol}`}
        blur={false}
      >
        <DaxInsightBody state={state} insight={insight} onRetry={load} />
      </Modal>
    </div>
  );
}

// The acknowledgement is per session, not permanent.
//
// It was previously written to localStorage, which meant a student ticked the
// box once — possibly months ago, on a machine they share — and the risk notice
// never appeared again. An acknowledgement nobody re-reads is not an
// acknowledgement. It is deliberately not persisted anywhere: the gate is state
// only, so it comes back on every mount — every reload, and every time the page
// is navigated to afresh. Accepting is a decision about this sitting of the
// page, not a preference to be remembered.
const RISK_ACK_KEY = 'finance:stocks:riskAck';

export default function FinanceStocksPage() {
  const [riskAccepted, setRiskAccepted] = useState(() => {
    // Earlier versions stored the grant in localStorage, then sessionStorage.
    // Clear both, or anyone carrying an old grant keeps skipping a gate that is
    // no longer written — which is exactly the state this page was found in.
    localStorage.removeItem(RISK_ACK_KEY);
    sessionStorage.removeItem(RISK_ACK_KEY);
    return false;
  });
  const [riskChecked, setRiskChecked] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [sector, setSector] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // The server refreshes its quotes when it serves this endpoint and finds them
  // stale, so a repeat fetch is what actually pulls new prices through. Poll
  // while the tab is open, and again whenever the user comes back to it —
  // leaving the page sitting on hour-old numbers is the thing to avoid.
  useEffect(() => {
    if (!riskAccepted) return undefined;

    let cancelled = false;
    const load = () => listStockQuotes(sector || undefined)
      .then((res) => { if (!cancelled) { setStocks(res.data || []); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [riskAccepted, sector]);

  // Quotes come back sorted by symbol, and a symbol that failed its last fetch
  // keeps an older timestamp — so the freshest one is what "last updated" means.
  const updatedAt = useMemo(
    () => stocks.reduce((max, s) => (!max || s.updatedAt > max ? s.updatedAt : max), null),
    [stocks]
  );

  // Built from the unfiltered fetch, so the strip is one-per-sector regardless
  // of which chip is active — it is simply not rendered while a chip is on.
  const rotation = useMemo(() => dailyRotation(stocks), [stocks]);

  const acceptRisk = () => {
    if (!riskChecked) return;
    setRiskAccepted(true);
  };

  if (!riskAccepted) {
    return (
      <Page>
        <div className="mb-5">
          <h1 className="text-xl font-bold">Stocks</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            A friendly nudge on where a few well-known stocks sit in their yearly range — not a
            trading terminal, no charts to decode.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This is educational, not financial advice. Prices come from a public market data
              feed and refresh every 15 minutes or so, so they lag real time. Markets carry risk and
              past range doesn&rsquo;t predict what happens next — investing is entirely at your own risk.
              When in doubt, talk to a licensed advisor before you invest real money.
            </p>
          </div>

          <label className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
            <input
              type="checkbox"
              checked={riskChecked}
              onChange={(e) => setRiskChecked(e.target.checked)}
              className="rounded"
            />
            I understand this is at my own risk and not professional financial advice.
          </label>

          <button
            type="button"
            disabled={!riskChecked}
            onClick={acceptRisk}
            className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-700"
          >
            Continue to Stocks
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page overview={{
      pageKey: 'finance-stocks',
      title: 'Where NSE names are sitting',
      blurb: 'Well-known Indian stocks placed against their 52-week range, as a starting point for reading a chart.',
      takeaway: 'Treat this as practice at reading ranges, not as a buy list.',
    }}>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Stocks</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          A friendly nudge on where well-known NSE stocks sit in their yearly range — filter by
          sector, no charts to decode.
        </p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button className={chip(!sector)} onClick={() => setSector('')}>All sectors</button>
        {SECTORS.map((s) => (
          <button key={s.value} className={chip(sector === s.value)} onClick={() => setSector(s.value)}>
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-gray-400">
          Couldn&rsquo;t load stock quotes right now. Try again shortly.
        </p>
      ) : stocks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {sector ? 'No stocks tracked in this sector yet.' : 'No stock quotes cached yet — check back in a minute.'}
        </p>
      ) : (
        <>
          {/* Only when unfiltered: picking a sector is an explicit request to
              see that sector whole, and a rotation strip on top of it would be
              showing one of the same cards twice. */}
          {!sector && rotation.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Today&rsquo;s rotation
                </h2>
                <p className="text-[11px] text-gray-400">
                  One per sector, changes daily
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rotation.map((s) => <StockCard key={`rot-${s.symbol}`} stock={s} />)}
              </div>
            </section>
          )}

          {!sector && rotation.length > 0 && (
            <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
              All tracked stocks
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stocks.map((s) => <StockCard key={s.symbol} stock={s} />)}
          </div>
          {updatedAt && (
            <p className="mt-4 text-[11px] text-gray-400">
              Last updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </p>
          )}
        </>
      )}

      {/* The risk acknowledgement above is a one-time session gate, so it is
          gone for the rest of the session the moment it is accepted — and this
          view is the one actually being read. The disclaimer has to stand here
          too, outside the loading/error branches, so it is present on every
          state of the page rather than only when quotes happen to load. */}
      <div className="mt-6 flex items-start gap-2 border-t border-gray-100 pt-4 text-[11px] leading-relaxed text-gray-400 dark:border-gray-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Educational only — not financial advice. Prices come from a public market data feed and
          lag real time by roughly 15 minutes. Markets carry risk and past range doesn&rsquo;t
          predict what happens next. Talk to a licensed advisor before investing real money.
        </p>
      </div>
    </Page>
  );
}
