const mongoose = require('mongoose');

const betaEventSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event:    { type: String, required: true, index: true },
  properties: { type: mongoose.Schema.Types.Mixed, default: {} },
  sessionId:  { type: String, default: null },
  url:        { type: String, default: null },
  timestamp:  { type: Date, default: Date.now },
}, { timestamps: false });

betaEventSchema.index({ event: 1, createdAt: -1 });
betaEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('BetaEvent', betaEventSchema);
