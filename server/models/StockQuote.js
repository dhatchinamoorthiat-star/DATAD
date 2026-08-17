const mongoose = require('mongoose');

// One document per stock in config/stockUniverse.js, upserted in place on each
// refresh (see services/stockFetcher.js) and pruned when its symbol leaves that
// config. low52/high52 come from Yahoo's 1-year chart range, so "closer to its
// low/high" is a real historical read, not a guess.
const stockQuoteSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true, maxlength: 20 },
    yahooSymbol: { type: String, maxlength: 24 },
    name: { type: String, required: true, maxlength: 80 },
    sector: { type: String, maxlength: 40, index: true },
    price: { type: Number, required: true },
    previousClose: { type: Number },
    low52: { type: Number, required: true },
    high52: { type: Number, required: true },
    // When the 52-week range was last recomputed from a full year of candles.
    // Routine refreshes pull only 5 days, so this is what the fetcher checks to
    // decide whether a symbol is due another full-year pull.
    rangeUpdatedAt: { type: Date },

    // Dax Insights for this stock — cached here the way NewsItem carries its
    // AI framing fields. Explanatory only, never a recommendation; see
    // services/stockInsightService.js.
    insight: {
      whatTheNumberSays: String,
      whyItMightBeHere: String,
      sectorContext: String,
      whatToReadNext: [String],
      conceptToLearn: { term: String, explanation: String },
      generatedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockQuote', stockQuoteSchema);
