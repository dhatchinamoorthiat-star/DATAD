const WeeklyReview = require('../../models/WeeklyReview');
const Recommendation = require('../../models/Recommendation');
const UserMemory = require('../../models/UserMemory');
const Task = require('../../models/Task');
const { recordPrediction } = require('../predictions/ledger');

function getWeekBoundary() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    startDate: monday,
    endDate: sunday,
  };
}

async function generate(userId) {
  const { start, end, startDate, endDate } = getWeekBoundary();

  const existing = await WeeklyReview.findOne({ user: userId, weekStart: start }).lean();
  if (existing) return existing;

  const [
    completedRecs,
    dismissedRecs,
    feedbackRecs,
    tasksDone,
    memory,
  ] = await Promise.all([
    Recommendation.find({
      user: userId,
      'lifecycle.state': 'completed',
      updatedAt: { $gte: startDate, $lte: endDate },
    }).lean(),
    Recommendation.find({
      user: userId,
      'lifecycle.state': 'dismissed',
      updatedAt: { $gte: startDate, $lte: endDate },
    }).lean(),
    Recommendation.find({
      user: userId,
      feedback: { $exists: true, $not: { $size: 0 } },
      updatedAt: { $gte: startDate, $lte: endDate },
    }).lean(),
    Task.countDocuments({
      $or: [{ createdBy: userId }, { assignee: userId }],
      status: 'done',
      updatedAt: { $gte: startDate, $lte: endDate },
    }),
    UserMemory.findOne({ user: userId }).lean(),
  ]);

  const wins = completedRecs.slice(0, 3).map((r) => ({
    text: r.title,
  }));

  const challenges = [
    ...dismissedRecs.slice(0, 2).map((r) => ({
      text: `${r.type}: ${r.title}`,
    })),
  ];

  const helpfulFeedback = feedbackRecs.filter((r) =>
    r.feedback?.some((f) => f.type === 'helpful')
  ).length;
  const notHelpfulFeedback = feedbackRecs.filter((r) =>
    r.feedback?.some((f) => f.type === 'not-helpful')
  ).length;

  const readinessChange = {
    start: memory?.readinessScore || 0,
    end: memory?.readinessScore || 0,
    delta: 0,
  };

  const insights = [];
  if (completedRecs.length > 3) {
    insights.push({ text: `Completed ${completedRecs.length} recommendations this week — strong momentum.` });
  }
  if (tasksDone > 5) {
    insights.push({ text: `Finished ${tasksDone} tasks. Consistent planner discipline.` });
  }
  if (helpfulFeedback > notHelpfulFeedback) {
    insights.push({ text: `Feedback was ${helpfulFeedback}x helpful vs not-helpful — recommendations are well-tuned.` });
  }
  if (!insights.length) {
    insights.push({ text: 'A steady week. Even small steps compound over time.' });
  }

  const nextWeekPriorities = [];
  const activeGoals = memory?.careerInterests?.slice(0, 2) || [];
  if (activeGoals.length) {
    nextWeekPriorities.push({ text: `Continue progress toward ${activeGoals.join(' & ')} goals` });
  }
  if (memory?.readinessScore != null && memory.readinessScore < 60) {
    nextWeekPriorities.push({ text: 'Focus on readiness — resume, companies, planner' });
  }
  nextWeekPriorities.push({ text: 'Stay consistent with daily recommendations' });

  const reflection = _buildReflection(completedRecs, memory, wins, challenges);

  // "Focus on readiness this week" is an implicit forecast. Make it explicit
  // and checkable. Fire-and-forget: the review is the deliverable here.
  _recordReadinessForecast(userId, memory, nextWeekPriorities).catch(() => {});

  const review = await WeeklyReview.create({
    user: userId,
    weekStart: start,
    weekEnd: end,
    reflection,
    wins,
    challenges: challenges.length ? challenges : [{ text: 'No major challenges recorded this week' }],
    readinessChange,
    insights,
    nextWeekPriorities,
  });

  return review.toObject();
}

// A week of focused work is worth about this much readiness. Modest on
// purpose: an ambitious number would produce a ledger full of misses that say
// more about the threshold than about the student.
const WEEKLY_READINESS_GAIN = 5;

/**
 * Record the claim behind the "focus on readiness" priority: one more week of
 * this and the number should have moved. Only recorded when that priority was
 * actually emitted, so the ledger holds claims Dax made rather than claims it
 * could have made.
 */
async function _recordReadinessForecast(userId, memory, priorities) {
  const readiness = memory?.readinessScore;
  if (!userId || typeof readiness !== 'number') return;
  if (!priorities.some((p) => p.text.startsWith('Focus on readiness'))) return;

  const predictedValue = Math.min(100, readiness + WEEKLY_READINESS_GAIN);
  await recordPrediction({
    userId,
    statement:
      `If you work the readiness priorities this week, your placement readiness should `
      + `reach ${predictedValue} or better within a fortnight (it is ${readiness} now).`,
    metric: 'careerReadiness',
    predictedValue,
    comparator: 'gte',
    horizonDays: 14,
    sourceTask: 'weekly-review-readiness',
  });
}

function _buildReflection(completedRecs, memory, wins, challenges) {
  const parts = [];

  if (wins.length) {
    parts.push(`This week you made progress on ${wins.length} key areas.`);
  }

  if (memory?.careerInterests?.length) {
    parts.push(`Your focus on ${memory.careerInterests.slice(0, 2).join(' and ')} continues to shape your preparation.`);
  }

  if (completedRecs.length > 5) {
    parts.push('The volume of completed recommendations shows strong engagement.');
  } else if (completedRecs.length > 0) {
    parts.push('Every recommendation completed is a step forward.');
  } else {
    parts.push('Some weeks are about rest and reflection — that is valuable too.');
  }

  return parts.join(' ');
}

async function getLatest(userId) {
  return WeeklyReview.findOne({ user: userId })
    .sort({ weekStart: -1 })
    .lean();
}

async function getByWeek(userId, weekStart) {
  return WeeklyReview.findOne({ user: userId, weekStart }).lean();
}

module.exports = {
  generate,
  getLatest,
  getByWeek,
};
