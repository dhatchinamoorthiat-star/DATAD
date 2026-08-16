import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Page } from '../../components/common/motion';
import { Skeleton } from '../../components/common/Skeleton';
import { listStockQuotes } from '../../api/finance';

const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

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

function StockCard({ stock }) {
  const { label, tone, Icon, note } = useMemo(() => signalFor(stock), [stock]);
  const change = stock.previousClose ? stock.price - stock.previousClose : null;
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stock.symbol}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{stock.name} · {stock.sector}</p>
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
    </div>
  );
}

const RISK_ACK_KEY = 'finance:stocks:riskAck';

export default function FinanceStocksPage() {
  const [riskAccepted, setRiskAccepted] = useState(
    () => localStorage.getItem(RISK_ACK_KEY) === 'true'
  );
  const [riskChecked, setRiskChecked] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!riskAccepted) return;
    listStockQuotes()
      .then((res) => setStocks(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [riskAccepted]);

  const updatedAt = stocks[0]?.updatedAt;

  const acceptRisk = () => {
    if (!riskChecked) return;
    localStorage.setItem(RISK_ACK_KEY, 'true');
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
              This is educational, not financial advice. Prices refresh once a day from a public
              market data feed, so they can lag real-time by up to 24 hours. Markets carry risk and
              past range doesn't predict what happens next — investing is entirely at your own risk.
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
    <Page>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Stocks</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          A friendly nudge on where a few well-known stocks sit in their yearly range — not a
          trading terminal, no charts to decode.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : error || stocks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          Couldn't load stock quotes right now. Try again shortly.
        </p>
      ) : (
        <>
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
    </Page>
  );
}
