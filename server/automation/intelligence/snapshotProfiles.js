/**
 * Daily job — freeze each active student's intelligence profile.
 *
 * Runs before the 06:00 briefing so every downstream job that wants to know
 * where a student is *heading* has today's row already written.
 *
 * Cost shape: buildStudentProfile() is nine parallel collector queries per
 * user. That is fine for one user on one request and ruinous for every user at
 * once, so this walks a cursor (never loads the user set into memory) and caps
 * itself at CONCURRENCY profiles in flight.
 */
const { runJob } = require('../jobRunner');
const User = require('../../models/User');
const StudentProfileSnapshot = require('../../models/StudentProfileSnapshot');
const { buildStudentProfile } = require('../../ai/intelligence-layer');
// Shared with the live profile build, which uses it to compare this student
// against the cohort aggregates built from these same frozen rows. One
// definition, or the comparison is between two different notions of
// "consistency".
const { buildSignals } = require('../../ai/intelligence-layer/profileFactory');

// Nine collector queries × this many users is the peak load on Atlas.
const CONCURRENCY = 5;
// How far back "active" reaches. Wide enough that a student who took a week
// off still has continuous history when they return.
const ACTIVE_WINDOW_DAYS = parseInt(process.env.PROFILE_SNAPSHOT_ACTIVE_DAYS || '14', 10);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Active = the account has been used from some device inside the window.
 *
 * Chosen over the alternatives deliberately:
 *   - `ActivityLog` records membership events only (register/approve/reject),
 *     not usage — an active student produces no rows at all.
 *   - `User.lastLoginAt` does not exist on this schema.
 *   - Recent `ChatMessage`/`Task` writes would only catch students who use
 *     those two features, missing anyone whose week was all planner and notes.
 *
 * `sessions[].lastSeenAt` is touched by services/deviceSessions.js on
 * authenticated requests (throttled, so it is not a write per request), which
 * makes it the one signal that means "used the product" regardless of which
 * part of it they used.
 */
function activeUserFilter(now = new Date()) {
  const cutoff = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { status: 'approved', 'sessions.lastSeenAt': { $gte: cutoff } };
}

/** Write one user's row. Returns 'saved' | 'skipped'. */
async function snapshotOne(userId, dateKey) {
  const profile = await buildStudentProfile(userId);
  const scores = profile?.scores || {};

  // A snapshot of nothing is noise, and worse, it would flatten every trend
  // computed over it. buildStudentProfile() also returns an empty profile when
  // its collectors throw, so this doubles as the guard against recording a
  // failed collection as a real zero.
  if (!scores.contextQualityScore) return 'skipped';

  await StudentProfileSnapshot.updateOne(
    { user: userId, dateKey },
    {
      $set: {
        currentFocus: scores.currentFocus,
        currentChallenges: scores.currentChallenges || [],
        recommendedTone: scores.recommendedTone,
        recommendedResponseLength: scores.recommendedResponseLength,
        recommendedExamples: scores.recommendedExamples || [],
        urgencyLevel: scores.urgencyLevel,
        motivationLevel: scores.motivationLevel,
        confidence: scores.confidence,
        learningVelocity: scores.learningVelocity,
        careerReadiness: scores.careerReadiness,
        contextQualityScore: scores.contextQualityScore,
        intelligenceScore: scores.intelligenceScore,
        signals: buildSignals(profile),
        collectedAt: new Date(),
      },
      $setOnInsert: { user: userId, dateKey },
    },
    { upsert: true }
  );
  return 'saved';
}

async function snapshotProfiles() {
  return runJob('profile-snapshot', async () => {
    const dateKey = todayKey();
    const counts = { saved: 0, skipped: 0, failed: 0 };

    const cursor = User.find(activeUserFilter()).select('_id').lean().cursor();
    const inFlight = new Set();

    const start = (userId) => {
      const p = snapshotOne(userId, dateKey)
        .then((outcome) => { counts[outcome] += 1; })
        .catch((err) => {
          // One student's bad data must never cost every later student their
          // day of history.
          counts.failed += 1;
          console.warn(`[profile-snapshot] user ${userId} failed: ${err.message}`);
        })
        .finally(() => inFlight.delete(p));
      inFlight.add(p);
    };

    for await (const user of cursor) {
      start(user._id);
      if (inFlight.size >= CONCURRENCY) await Promise.race(inFlight);
    }
    await Promise.all(inFlight);

    console.log(
      `[profile-snapshot] ${dateKey}: ${counts.saved} saved, ${counts.skipped} skipped (no data), ${counts.failed} failed`
    );
    return { itemsProcessed: counts.saved, meta: counts };
  });
}

module.exports = { snapshotProfiles, activeUserFilter, buildSignals, ACTIVE_WINDOW_DAYS };
