/**
 * A day's frozen copy of what the intelligence layer computed about a student.
 *
 * `ai/intelligence-layer/buildStudentProfile()` runs nine collectors and twelve
 * scores on every request and then discards the result. That makes Dax
 * amnesiac: it can describe a student's present but never their trajectory.
 * This collection is the missing storage — one row per user per day, written by
 * `automation/intelligence/snapshotProfiles.js`.
 *
 * Snapshot history CANNOT be backfilled. A day without a row is a day of that
 * student's history that no longer exists, which is why the job runs early and
 * skips nothing that has data.
 */
const mongoose = require('mongoose');

const score = { type: Number, min: 0, max: 100, default: null };

const studentProfileSnapshotSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // YYYY-MM-DD, UTC. The idempotency key: the job may run twice in a day
    // (retry, redeploy, manual trigger) and must overwrite, never duplicate.
    dateKey: { type: String, required: true },

    // ── The twelve scores, exactly as scoringEngine.computeScores() returns ──
    currentFocus: { type: String, default: 'general' },
    currentChallenges: { type: [String], default: [] },
    recommendedTone: { type: String, default: 'neutral' },
    recommendedResponseLength: { type: String, default: 'moderate' },
    recommendedExamples: { type: [String], default: [] },
    urgencyLevel: score,
    motivationLevel: score,
    confidence: score,
    learningVelocity: score,
    careerReadiness: score,
    contextQualityScore: score,
    intelligenceScore: score,

    // ── Raw counters worth trending ─────────────────────────────────────────
    // Deliberately a flat sub-object of numbers the collectors already return.
    // Scores are derived and can be re-weighted later; these are the facts the
    // derivation was based on, so a scoring change never invalidates history.
    signals: {
      streak: { type: Number, default: null },
      consistency: { type: Number, default: null },
      pendingTasks: { type: Number, default: null },
      overdueTasks: { type: Number, default: null },
      applicationsCount: { type: Number, default: null },
      resumeCompletion: { type: Number, default: null },
      stressLevel: { type: Number, default: null },
      studyMinutes: { type: Number, default: null },
    },

    collectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Idempotency: one snapshot per user per day, enforced by the database rather
// than by the job remembering to check.
studentProfileSnapshotSchema.index({ user: 1, dateKey: 1 }, { unique: true });
// Trend reads (ai/intelligence-layer/trends.js) always walk one user backwards.
studentProfileSnapshotSchema.index({ user: 1, dateKey: -1 });

module.exports =
  mongoose.models.StudentProfileSnapshot
  || mongoose.model('StudentProfileSnapshot', studentProfileSnapshotSchema);
