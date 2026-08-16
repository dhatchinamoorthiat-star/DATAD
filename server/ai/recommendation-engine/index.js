const Recommendation = require('../../models/Recommendation');
const { sortByScore } = require('./recommendationFactory');
const lifecycleManager = require('./lifecycleManager');
const { computeV2Scores } = require('./scoringEngineV2');
const { alignAll } = require('./goalAligner');
const { plan } = require('./recommendationPlanner');
const { generateDailyMission } = require('./dailyMission');
const { resolveDependencies } = require('./dependencyGraph');

const focusGen = require('./generators/focusGenerator');
const priorityGen = require('./generators/priorityGenerator');
const studySessionGen = require('./generators/studySessionGenerator');
const aiActionGen = require('./generators/aiActionGenerator');
const weakTopicGen = require('./generators/weakTopicGenerator');
const placementGen = require('./generators/placementGenerator');
const resumeGen = require('./generators/resumeGenerator');
const interviewGen = require('./generators/interviewGenerator');
const deadlineGen = require('./generators/deadlineGenerator');
const plannerGen = require('./generators/plannerGenerator');
const wellnessGen = require('./generators/wellnessGenerator');
const learningLoop = require('./learningLoop');

const GENERATORS = [
  { name: 'focus', gen: focusGen.generate },
  { name: 'priorities', gen: priorityGen.generate },
  { name: 'study-session', gen: studySessionGen.generate },
  { name: 'ai-action', gen: aiActionGen.generate },
  { name: 'weak-topic-alert', gen: weakTopicGen.generate },
  { name: 'placement-readiness', gen: placementGen.generate },
  { name: 'resume-suggestion', gen: resumeGen.generate },
  { name: 'interview-suggestion', gen: interviewGen.generate },
  { name: 'deadline-alert', gen: deadlineGen.generate },
  { name: 'planner-suggestion', gen: plannerGen.generate },
  { name: 'wellness-suggestion', gen: wellnessGen.generate },
];

// Generator weights, modulated by the learning loop.
// Default weight is 1.0. The learning loop adjusts per-user based on feedback.
function effectiveWeight(userId, name, defaultWeight = 1.0) {
  return learningLoop.getGeneratorWeight(userId, name, defaultWeight);
}

async function generateRecommendations(userId, profile) {
  if (!userId || !profile) return [];

  const allRecs = [];
  for (const { name, gen } of GENERATORS) {
    try {
      const weight = effectiveWeight(userId, name);
      if (weight <= 0) continue; // fully suppressed by learning loop
      const recs = gen(profile);
      // Apply weight to confidence and urgency scores
      for (const rec of recs) {
        if (rec.confidence) rec.confidence = Math.round(rec.confidence * weight);
        if (rec.urgency) rec.urgency = Math.round(rec.urgency * weight);
      }
      allRecs.push(...recs);
    } catch (err) {
      console.warn(`[recommendation-engine] Generator "${name}" failed:`, err.message);
    }
  }

  let scored = sortByScore(allRecs);

  const goalAligned = alignAll(scored, profile);

  const v2Scored = goalAligned.map((rec) => ({
    ...rec,
    v2Scores: computeV2Scores(rec, profile),
    lifecycle: { state: 'generated', transitions: [{ to: 'generated', at: new Date() }] },
  }));

  const withDeps = await resolveDependencies(userId, v2Scored);

  const planned = plan(withDeps, profile);

  const persisted = [];
  for (const rec of planned) {
    try {
      const doc = await Recommendation.create({
        user: userId,
        type: rec.type,
        title: rec.title,
        description: rec.description,
        reason: rec.reason,
        confidence: rec.confidence,
        urgency: rec.urgency,
        expectedImpact: rec.expectedImpact,
        estimatedCompletionTime: rec.estimatedCompletionTime,
        sourceSignals: rec.sourceSignals,
        actions: rec.actions,
        lifecycle: rec.lifecycle,
        v2Scores: rec.v2Scores,
        goalAlignment: rec.goalAlignment,
        planner: rec.planner,
        dependencies: rec.dependencyStatus?.missing || [],
      });
      persisted.push({ ...rec, _id: doc._id });
    } catch (err) {
      console.warn(`[recommendation-engine] Failed to persist recommendation:`, err.message);
    }
  }

  return persisted;
}

async function getActiveRecommendations(userId) {
  try {
    return await Recommendation.find({ user: userId, dismissed: false })
      .sort({ 'v2Scores.composite': -1, urgency: -1, confidence: -1 })
      .limit(30)
      .lean();
  } catch {
    return [];
  }
}

async function dismissRecommendation(userId, recId) {
  return lifecycleManager.transition(userId, recId, 'dismissed');
}

async function dismissAllByType(userId, type) {
  try {
    return await Recommendation.updateMany(
      { user: userId, type, dismissed: false },
      { dismissed: true, 'lifecycle.state': 'dismissed', 'lifecycle.dismissedAt': new Date() }
    );
  } catch {
    return null;
  }
}

function getGenerators() {
  return GENERATORS.map((g) => g.name);
}

module.exports = {
  generateRecommendations,
  getActiveRecommendations,
  dismissRecommendation,
  dismissAllByType,
  getGenerators,
};
