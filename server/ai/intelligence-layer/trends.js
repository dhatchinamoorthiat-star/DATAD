/**
 * Trend reads over StudentProfileSnapshot.
 *
 * The intelligence layer answers "where is this student now". This answers
 * "which way are they moving" — the thing a general-purpose chatbot cannot say
 * because it has no history of the person it is talking to.
 *
 * Every function here is read-only and deterministic. No LLM calls: a delta is
 * arithmetic, and paying a model to subtract two numbers would be both slower
 * and less trustworthy.
 */
const StudentProfileSnapshot = require('../../models/StudentProfileSnapshot');

// Score fields live at the document root; raw counters live under `signals`.
// Callers name a metric once ('consistency', 'careerReadiness') and this maps it.
const SCORE_METRICS = [
  'urgencyLevel', 'motivationLevel', 'confidence', 'learningVelocity',
  'careerReadiness', 'contextQualityScore', 'intelligenceScore',
];
const SIGNAL_METRICS = [
  'streak', 'consistency', 'pendingTasks', 'overdueTasks',
  'applicationsCount', 'resumeCompletion', 'stressLevel', 'studyMinutes',
];

function fieldPath(metric) {
  if (SCORE_METRICS.includes(metric)) return metric;
  if (SIGNAL_METRICS.includes(metric)) return `signals.${metric}`;
  return null;
}

function dateKeyDaysAgo(days, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The raw series for one metric, oldest first.
 * @returns {Promise<Array<{ dateKey: string, value: number }>>}
 */
async function getTrend(userId, metric, { days = 30 } = {}) {
  const path = fieldPath(metric);
  if (!userId || !path) return [];

  const rows = await StudentProfileSnapshot.find({
    user: userId,
    dateKey: { $gte: dateKeyDaysAgo(days) },
  })
    .select(`dateKey ${path}`)
    .sort({ dateKey: 1 })
    .lean();

  return rows
    .map((r) => ({
      dateKey: r.dateKey,
      value: path.startsWith('signals.') ? r.signals?.[metric] : r[metric],
    }))
    .filter((p) => typeof p.value === 'number');
}

/**
 * Movement between the oldest and newest reading in the window.
 * Returns null when there is nothing to compare — one data point is a value,
 * not a trend, and reporting a delta of 0 for it would be a lie.
 */
async function getDelta(userId, metric, { days = 14 } = {}) {
  const series = await getTrend(userId, metric, { days });
  if (series.length < 2) return null;

  const start = series[0].value;
  const end = series[series.length - 1].value;
  const delta = end - start;
  // A rise from zero has no meaningful percentage. Say so rather than emitting
  // Infinity and letting it reach a prompt.
  const pctChange = start === 0 ? null : Math.round((delta / Math.abs(start)) * 1000) / 10;

  return {
    start,
    end,
    delta,
    pctChange,
    startDate: series[0].dateKey,
    endDate: series[series.length - 1].dateKey,
    points: series.length,
  };
}

// Only movements past these thresholds are worth a student's attention or a
// prompt's token budget. `direction` records which way is good news, so the
// summary can say "down" without implying "bad" for things like stress.
const NOTABLE = [
  { metric: 'consistency',      label: 'consistency',        minAbsDelta: 15, goodWhen: 'up' },
  { metric: 'careerReadiness',  label: 'placement readiness', minAbsDelta: 10, goodWhen: 'up' },
  { metric: 'intelligenceScore', label: 'overall momentum',   minAbsDelta: 10, goodWhen: 'up' },
  { metric: 'motivationLevel',  label: 'motivation',          minAbsDelta: 15, goodWhen: 'up' },
  { metric: 'streak',           label: 'study streak',        minAbsDelta: 5,  goodWhen: 'up' },
  { metric: 'overdueTasks',     label: 'overdue tasks',       minAbsDelta: 3,  goodWhen: 'down' },
  { metric: 'stressLevel',      label: 'stress',              minAbsDelta: 20, goodWhen: 'down' },
  { metric: 'resumeCompletion', label: 'resume completeness', minAbsDelta: 15, goodWhen: 'up' },
];

const MAX_LINES = 4;

/**
 * A terse, prompt-injectable line about only the notable movements.
 * Returns '' when there is no history or nothing moved — the caller must be
 * able to omit the segment entirely, because an empty "Trends:" label invites
 * the model to invent one.
 */
async function summarizeTrends(userId, { days = 14 } = {}) {
  if (!userId) return '';

  const deltas = await Promise.all(
    NOTABLE.map(async (spec) => ({ spec, delta: await getDelta(userId, spec.metric, { days }) }))
  );

  const notable = deltas
    .filter(({ spec, delta }) => delta && Math.abs(delta.delta) >= spec.minAbsDelta)
    .sort((a, b) => Math.abs(b.delta.delta) - Math.abs(a.delta.delta))
    .slice(0, MAX_LINES);

  if (!notable.length) return '';

  const parts = notable.map(({ spec, delta }) => {
    const dir = delta.delta > 0 ? 'up' : 'down';
    const magnitude = delta.pctChange != null
      ? `${dir} ${Math.abs(delta.pctChange)}%`
      : `${dir} ${Math.abs(delta.delta)}`;
    return `${spec.label} ${magnitude} since ${delta.startDate} (${delta.start}→${delta.end})`;
  });

  return `Trend over last ${days}d: ${parts.join('; ')}`;
}

module.exports = { getTrend, getDelta, summarizeTrends, fieldPath, SCORE_METRICS, SIGNAL_METRICS };
