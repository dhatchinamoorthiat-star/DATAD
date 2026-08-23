const Recommendation = require('../../models/Recommendation');
const UserMemory = require('../../models/UserMemory');
const { recordPrediction } = require('../predictions/ledger');

const GOAL_REC_TYPE_MAP = {
  'placement': ['placement-readiness', 'resume-suggestion', 'interview-suggestion', 'deadline-alert'],
  'skill-building': ['study-session', 'weak-topic-alert', 'focus'],
  'task-management': ['priority', 'deadline-alert', 'planner-suggestion'],
  'career-planning': ['planner-suggestion', 'placement-readiness', 'resume-suggestion'],
  'wellness': ['wellness-suggestion'],
  'learning': ['ai-action', 'study-session', 'weak-topic-alert'],
  'general': [],
};

async function compute(userId) {
  const [memory, completedRecs, activeRecs] = await Promise.all([
    UserMemory.findOne({ user: userId }).lean(),
    Recommendation.find({
      user: userId,
      'lifecycle.state': 'completed',
    }).sort({ updatedAt: -1 }).lean(),
    Recommendation.find({
      user: userId,
      'lifecycle.state': { $in: ['generated', 'seen', 'accepted', 'started'] },
    }).lean(),
  ]);

  const goals = memory?.careerInterests?.length
    ? memory.careerInterests.map((g) => ({ name: g, type: 'career' }))
    : [{ name: 'general', type: 'default' }];

  const totalRecs = completedRecs.length + activeRecs.length;
  const completedCount = completedRecs.length;

  const goalProgressItems = goals.map((goal) => {
    const goalKey = goal.name.toLowerCase().replace(/\s+/g, '-');
    const relevantTypes = GOAL_REC_TYPE_MAP[goalKey] || [];
    if (!relevantTypes.length) {
      return {
        goal: goal.name,
        type: goal.type,
        completionPct: totalRecs > 0 ? Math.round((completedCount / totalRecs) * 100) : 0,
        completed: completedCount,
        total: totalRecs,
        milestones: [],
        estimatedDaysRemaining: null,
      };
    }

    const goalCompleted = completedRecs.filter((r) => relevantTypes.includes(r.type)).length;
    const goalActive = activeRecs.filter((r) => relevantTypes.includes(r.type)).length;
    const goalTotal = goalCompleted + goalActive;

    const milestones = _computeMilestones(goal, goalCompleted);

    const ratePerDay = _computeRate(completedRecs);
    const estimatedDaysRemaining = ratePerDay > 0 && goalActive > 0
      ? Math.ceil(goalActive / ratePerDay)
      : null;

    return {
      goal: goal.name,
      type: goal.type,
      completionPct: goalTotal > 0 ? Math.round((goalCompleted / goalTotal) * 100) : 0,
      completed: goalCompleted,
      total: goalTotal,
      milestones,
      estimatedDaysRemaining,
    };
  });

  const allMilestones = goalProgressItems.flatMap((g) => g.milestones);

  // `estimatedDaysRemaining` is a forecast: at the rate this student has been
  // completing recommendations, their placement work clears in D days. Record
  // it so it can be checked later rather than quietly forgotten. Fire-and-
  // forget — a ledger write must never make a progress screen fail to load.
  _recordPaceForecast(userId, goalProgressItems, memory).catch(() => {});

  return {
    goals: goalProgressItems,
    overall: {
      completionPct: totalRecs > 0 ? Math.round((completedCount / totalRecs) * 100) : 0,
      totalCompleted: completedCount,
      totalActive: activeRecs.length,
    },
    milestones: allMilestones,
  };
}

/**
 * Turn the pace estimate into a falsifiable claim about placement readiness.
 *
 * Only fires when there is something to forecast from: a known readiness
 * score, an estimate, and outstanding work. The predicted gain is tied to the
 * amount of outstanding work and capped, because a forecast of "+40 readiness"
 * from a pace estimate would not be a prediction, it would be a wish.
 */
async function _recordPaceForecast(userId, items, memory) {
  const readiness = memory?.readinessScore;
  if (!userId || typeof readiness !== 'number') return;

  const paced = items.find((g) => g.estimatedDaysRemaining != null && g.total > g.completed);
  if (!paced) return;

  const outstanding = paced.total - paced.completed;
  const predictedValue = Math.min(100, readiness + Math.min(10, outstanding));
  if (predictedValue <= readiness) return;

  const horizonDays = paced.estimatedDaysRemaining;
  await recordPrediction({
    userId,
    statement:
      `At your current pace you should clear the remaining ${outstanding} item(s) on `
      + `"${paced.goal}" in about ${horizonDays} days, putting your placement readiness `
      + `at ${predictedValue} or better.`,
    metric: 'careerReadiness',
    predictedValue,
    comparator: 'gte',
    horizonDays,
    sourceTask: 'goal-progress-pace',
  });
}

function _computeMilestones(goal, completed) {
  const milestones = [
    { label: 'Getting started', threshold: 0, reached: completed >= 0 },
    { label: 'Building momentum', threshold: 3, reached: completed >= 3 },
    { label: 'Making progress', threshold: 6, reached: completed >= 6 },
    { label: 'Halfway there', threshold: 10, reached: completed >= 10 },
    { label: 'Strong foundation', threshold: 15, reached: completed >= 15 },
    { label: 'Goal achieved', threshold: 20, reached: completed >= 20 },
  ];

  const nextMilestone = milestones.find((m) => !m.reached);

  return {
    reached: milestones.filter((m) => m.reached).map((m) => m.label),
    next: nextMilestone?.label || 'All milestones reached',
    progressToNext: nextMilestone
      ? Math.round(((completed - nextMilestone.threshold) / (nextMilestone.threshold + 3)) * 100)
      : 100,
  };
}

function _computeRate(completedRecs) {
  if (completedRecs.length < 2) return 0;
  const oldest = new Date(completedRecs[completedRecs.length - 1].updatedAt).getTime();
  const newest = new Date(completedRecs[0].updatedAt).getTime();
  const daysSpan = (newest - oldest) / (1000 * 60 * 60 * 24);
  if (daysSpan < 1) return completedRecs.length;
  return Math.round((completedRecs.length / daysSpan) * 10) / 10;
}

module.exports = { compute };
