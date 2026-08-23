const { buildProfile, createEmptyProfile, buildSignals } = require('./profileFactory');
const { computeScores } = require('./scoringEngine');
const { summarizeTrends } = require('./trends');
const { summarizeCohort } = require('../cohort/cohortInsights');

const identityCollector = require('./collectors/identityCollector');
const memoryCollector = require('./collectors/memoryCollector');
const taskCollector = require('./collectors/taskCollector');
const noteCollector = require('./collectors/noteCollector');
const plannerCollector = require('./collectors/plannerCollector');
const careerCollector = require('./collectors/careerCollector');
const learningCollector = require('./collectors/learningCollector');
const activityCollector = require('./collectors/activityCollector');
const stressCollector = require('./collectors/stressCollector');

async function buildStudentProfile(userId) {
  if (!userId) return createEmptyProfile(null);

  try {
    const [
      identity,
      memory,
      tasks,
      notes,
      planner,
      career,
      learning,
      activity,
      stress,
    ] = await Promise.all([
      identityCollector.collect(userId),
      memoryCollector.collect(userId),
      taskCollector.collect(userId),
      noteCollector.collect(userId),
      plannerCollector.collect(userId),
      careerCollector.collect(userId),
      learningCollector.collect(userId),
      activityCollector.collect(userId),
      stressCollector.collect(userId),
    ]);

    const collected = { identity, memory, tasks, notes, planner, career, learning, activity, stress };
    const scores = computeScores(collected);

    // Trajectory and peers. Both are deliberately fetched after the collectors
    // rather than alongside them: each reads what the nightly jobs wrote, and
    // both derive from data the collectors produce. Run as a pair so the second
    // one costs no extra wall time.
    //
    // Either failing must cost only its own segment. A student with no snapshot
    // history, or in a cohort too small to report on, still gets the profile
    // they do have — an empty string here simply omits the segment downstream.
    const [trendSummary, cohortSummary] = await Promise.all([
      summarizeTrends(userId).catch(() => ''),
      // The comparison is against the same signals the nightly job froze for
      // everyone else, plus careerReadiness, which lives on the snapshot's top
      // level rather than in its signals bag.
      summarizeCohort(userId, {
        ...buildSignals(collected),
        careerReadiness: scores.careerReadiness,
      }).catch(() => ''),
    ]);
    collected.trendSummary = trendSummary;
    collected.cohortSummary = cohortSummary;

    return buildProfile(userId, collected, scores);
  } catch (err) {
    console.warn('[intelligence-layer] Failed to build profile:', err.message);
    return createEmptyProfile(userId);
  }
}

async function getIntelligence(userId) {
  const profile = await buildStudentProfile(userId);
  return {
    scores: profile.scores,
    enrichedContext: profile.enrichedContext,
  };
}

module.exports = {
  buildStudentProfile,
  getIntelligence,
};
