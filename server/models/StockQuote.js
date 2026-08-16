const mongoose = require('mongoose');

// One document per tracked stock, overwritten in place on each daily refresh
// (see services/stockFetcher.js). low52/high52 come straight from Yahoo's
// 1-year chart range, so "closer to its low/high" is a real historical read,
// not a guess.
const stockQuoteSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true, maxlength: 20 },
    name: { type: String, required: true, maxlength: 80 },
    sector: { type: String, maxlength: 40 },
    price: { type: Number, required: true },
    previousClose: { type: Number },
    low52: { type: Number, required: true },
    high52: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockQuote', stockQuoteSchema);
