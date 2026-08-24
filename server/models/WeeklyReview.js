const mongoose = require('mongoose');

const weeklyReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekStart: { type: String, required: true },
  weekEnd: { type: String, required: true },
  reflection: { type: String },
  wins: [{ text: String }],
  challenges: [{ text: String }],
  readinessChange: {
    start: { type: Number },
    end: { type: Number },
    delta: { type: Number },
  },
  insights: [{ text: String }],
  nextWeekPriorities: [{ text: String }],
}, { timestamps: true });

weeklyReviewSchema.index({ user: 1, weekStart: -1 }, { unique: true });

module.exports = mongoose.model('WeeklyReview', weeklyReviewSchema);
