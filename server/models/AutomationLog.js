const mongoose = require('mongoose');

const automationLogSchema = new mongoose.Schema({
  job: { type: String, required: true },
  status: { type: String, enum: ['running', 'success', 'failed', 'partial'], default: 'running' },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },
  durationMs: { type: Number },
  provider: { type: String },
  model: { type: String },
  tokensUsed: { type: Number, default: 0 },
  itemsProcessed: { type: Number, default: 0 },
  itemsFailed: { type: Number, default: 0 },
  retryCount: { type: Number, default: 0 },
  estimatedCostUsd: { type: Number, default: 0 },
  confidence: { type: Number },
  validationStatus: { type: String, enum: ['published', 'pending_review', 'failed'] },
  ragSourceCount: { type: Number, default: 0 },
  error: { type: String },
  meta: { type: Object, default: {} },
}, { timestamps: true });

automationLogSchema.index({ createdAt: -1 });
automationLogSchema.index({ job: 1, createdAt: -1 });

// Auto-delete logs older than 30 days
automationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('AutomationLog', automationLogSchema);
