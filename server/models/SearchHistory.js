const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  resultId: { type: String },
  category: { type: String },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const searchHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  query: { type: String, required: true, trim: true, maxlength: 200 },
  resultCount: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  providerTimings: { type: mongoose.Schema.Types.Mixed },
  resultsClicked: [clickSchema],
  frequency: { type: Number, default: 1 },
  lastSearchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

searchHistorySchema.index({ user: 1, query: 1 }, { unique: true });
searchHistorySchema.index({ user: 1, frequency: -1 });
searchHistorySchema.index({ user: 1, lastSearchedAt: -1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
