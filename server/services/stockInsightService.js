/**
 * Dax Insights for a single stock.
 *
 * The page already computes a real signal — where the price sits in its
 * 52-week range. This turns that number into an explanation: what it means,
 * why the stock might be there, what to go and read. It never turns it into a
 * recommendation, and that boundary is enforced here rather than trusted to
 * the prompt (see ai/prompts/index.js#stockInsight for why the boundary
 * exists).
 *
 * Generations are cached on the StockQuote document, the same way NewsItem
 * carries its AI framing fields, and regenerated when they age out.
 */
const { run } = require('../ai/runner');
const PROMPTS = require('../ai/prompts');
const StockQuote = require('../models/StockQuote');
const { getRecentNews } = require('../ai/retriever');

// An explanation of a yearly range does not go stale in minutes the way a
// price does. A day keeps it current with the news cycle without paying for a
// generation every time a student opens a card.
const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;

// News categories worth grounding a stock explanation in.
const NEWS_CATEGORIES = ['stock-market', 'economy', 'banking-finance', 'corporate'];

// Directive language the output must not contain. The prompt forbids all of
// this; this is the check that the model actually complied, because "the model
// was told not to" is not a control. Word-boundary matched so "buyback" and
// "holding company" — both legitimate in an explanation — do not trip it.
const FORBIDDEN = [
  /\bbuy(?!back)\w*\b/i,
  /\bsell\w*\b/i,
  /\bhold(?!ing)\b/i,
  /\baccumulat\w*\b/i,
  /\bbook profits?\b/i,
  /\bunder ?valued?\b/i,
  /\bover ?valued?\b/i,
  /\bprice target\b/i,
  /\bfair value\b/i,
  /\bbargain\b/i,
  /\bgood entry\b/i,
  /\bexit\b/i,
];

function findViolation(insight) {
  const text = [
    insight.whatTheNumberSays,
    insight.whyItMightBeHere,
    insight.sectorContext,
    ...(insight.whatToReadNext || []),
    insight.conceptToLearn?.term,
    insight.conceptToLearn?.explanation,
  ]
    .filter(Boolean)
    .join(' ');

  const hit = FORBIDDEN.find((re) => re.test(text));
  return hit ? text.match(hit)[0] : null;
}

const pct = (n) => Math.round(n * 1000) / 10;

// Where the price sits in its 52-week range, as a percentage. Computed here,
// not by the model — the same reason linkedinService computes its score in
// code: a model asked for a number will produce one, and it will not be right.
function rangePositionOf({ price, low52, high52 }) {
  if (!(high52 > low52)) return 50;
  return pct((price - low52) / (high52 - low52));
}

async function generateInsight(quote) {
  const newsCtx = await getRecentNews(NEWS_CATEGORIES, 12).catch(() => null);

  const prompt = PROMPTS.stockInsight({
    stock: quote,
    rangePosition: rangePositionOf(quote),
    changePct: quote.previousClose ? pct((quote.price - quote.previousClose) / quote.previousClose) : null,
    recentHeadlines: newsCtx?.text || '',
  });

  const { result } = await run({ system: prompt.system, user: prompt.user, json: true });
  if (!result?.whatTheNumberSays) throw new Error('Dax returned no insight');

  // Refuse rather than repair. A generation that reached for a recommendation
  // has misunderstood the job, and patching the offending word out would leave
  // the surrounding sentence still arguing for a trade.
  const violation = findViolation(result);
  if (violation) {
    throw new Error(`Insight rejected — directive language ("${violation}") for ${quote.symbol}`);
  }

  return {
    whatTheNumberSays: result.whatTheNumberSays,
    whyItMightBeHere: result.whyItMightBeHere,
    sectorContext: result.sectorContext,
    whatToReadNext: (result.whatToReadNext || []).slice(0, 3),
    conceptToLearn: result.conceptToLearn || {},
    generatedAt: new Date(),
  };
}

// Return the cached insight for a symbol, generating one if it is missing or
// has aged out. Returns null when the symbol is not tracked.
async function getStockInsight(symbol) {
  const quote = await StockQuote.findOne({ symbol }).lean();
  if (!quote) return null;

  const age = quote.insight?.generatedAt
    ? Date.now() - new Date(quote.insight.generatedAt).getTime()
    : Infinity;
  if (age < INSIGHT_TTL_MS) return quote.insight;

  const insight = await generateInsight(quote);
  await StockQuote.updateOne({ symbol }, { $set: { insight } });
  return insight;
}

module.exports = { getStockInsight, rangePositionOf, findViolation, INSIGHT_TTL_MS };
