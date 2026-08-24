const mongoose = require('mongoose');

const lifecycleSchema = new mongoose.Schema({
  state: {
    type: String,
    enum: ['generated', 'seen', 'accepted', 'started', 'completed', 'dismissed', 'ignored', 'expired', 'regenerated'],
    default: 'generated',
  },
  transitions: [{
    from: { type: String },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
  }],
  firstSeenAt: { type: Date },
  acceptedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  dismissedAt: { type: Date },
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['helpful', 'not-helpful', 'already-done', 'remind-tomorrow', 'never-suggest', 'lower-priority'],
  },
  at: { type: Date, default: Date.now },
}, { _id: false });

const v2ScoreSchema = new mongoose.Schema({
  expectedValue: { type: Number, min: 0, max: 100 },
  estimatedTime: { type: Number, min: 0, max: 100 },
  difficulty: { type: Number, min: 0, max: 100 },
  personalRelevance: { type: Number, min: 0, max: 100 },
  goalAlignment: { type: Number, min: 0, max: 100 },
  freshness: { type: Number, min: 0, max: 100 },
  confidence: { type: Number, min: 0, max: 100 },
  urgency: { type: Number, min: 0, max: 100 },
  impact: { type: Number, min: 0, max: 100 },
  composite: { type: Number, min: 0, max: 100 },
}, { _id: false });

const recommendationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'focus', 'priority', 'study-session', 'ai-action', 'weak-topic-alert',
      'placement-readiness', 'resume-suggestion', 'interview-suggestion',
      'deadline-alert', 'planner-suggestion', 'wellness-suggestion',
    ],
    required: true,
  },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 2000 },
  reason: { type: String, required: true, maxlength: 1000 },
  confidence: { type: Number, min: 0, max: 100, required: true },
  urgency: { type: Number, min: 0, max: 100, required: true },
  expectedImpact: { type: String, maxlength: 500 },
  estimatedCompletionTime: { type: String, maxlength: 100 },
  sourceSignals: [{ type: String, maxlength: 200 }],
  actions: [{
    label: { type: String, required: true },
    route: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
  }],
  dismissed: { type: Boolean, default: false },
  expiresAt: { type: Date },

  // V2: Lifecycle
  lifecycle: { type: lifecycleSchema, default: () => ({
    state: 'generated',
    transitions: [{ to: 'generated', at: new Date() }],
  })},

  // V2: Dependencies (recommendation ObjectIds this depends on)
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation' }],

  // V2: Goal alignment
  goalAlignment: {
    goal: { type: String, maxlength: 100 },
    relevance: { type: Number, min: 0, max: 100 },
  },

  // V2: Scoring
  v2Scores: { type: v2ScoreSchema },

  // V2: Feedback history
  feedback: [feedbackSchema],

  // V2: Planner metadata
  planner: {
    isDuplicate: { type: Boolean, default: false },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation' },
    conflictGroup: { type: String },
    planOrder: { type: Number },
  },
}, { timestamps: true });

recommendationSchema.index({ user: 1, type: 1 });
recommendationSchema.index({ user: 1, createdAt: -1 });
recommendationSchema.index({ user: 1, dismissed: 1, createdAt: -1 });
recommendationSchema.index({ 'lifecycle.state': 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);
