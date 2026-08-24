const mongoose = require('mongoose');

const runtimeComparisonSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  task: { type: String, index: true },
  intent: { type: String },

  runtimeSelected: { type: String, enum: ['v1', 'v2', 'shadow'], required: true },
  fallbackRuntime: { type: String, enum: ['v1', 'v2', null], default: null },

  v1: {
    provider: { type: String },
    model: { type: String },
    latencyMs: { type: Number },
    tokensUsed: { type: Number },
    estimatedCostUsd: { type: Number },
    confidence: { type: Number },
    verificationScore: { type: Number },
    verificationStatus: { type: String },
    cacheHit: { type: Boolean, default: false },
    promptVersion: { type: String },
  },

  v2: {
    provider: { type: String },
    model: { type: String },
    latencyMs: { type: Number },
    tokensUsed: { type: Number },
    estimatedCostUsd: { type: Number },
    confidence: { type: Number },
    verificationScore: { type: Number },
    verificationStatus: { type: String },
    cacheHit: { type: Boolean, default: false },
    promptVersion: { type: String },
    capabilityProfile: { type: mongoose.Schema.Types.Mixed },
  },

  mode: { type: String, enum: ['v1_only', 'v2_only', 'shadow', 'hybrid'], required: true },
  status: { type: String, enum: ['matched', 'divergent', 'v1_only', 'v2_only'] },
}, { timestamps: true });

runtimeComparisonSchema.index({ createdAt: -1 });
runtimeComparisonSchema.index({ mode: 1, createdAt: -1 });
runtimeComparisonSchema.index({ intent: 1, createdAt: -1 });

module.exports = mongoose.model('RuntimeComparison', runtimeComparisonSchema);
