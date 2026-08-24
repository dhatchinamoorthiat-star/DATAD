const mongoose = require('mongoose');

// Records that a user worked through a daily case — one per (user, case).
// Powers the study streak on the dashboard.
const dailyCaseSolveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dailyCase: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyCase', required: true },
    // Denormalized from the case so streaks are computable without a join.
    dateKey: { type: String, required: true },
  },
  { timestamps: true }
);

dailyCaseSolveSchema.index({ user: 1, dailyCase: 1 }, { unique: true });

module.exports = mongoose.model('DailyCaseSolve', dailyCaseSolveSchema);
