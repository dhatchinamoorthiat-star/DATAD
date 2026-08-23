/**
 * Cohort intelligence — what a group of students looks like, never who is in it.
 *
 * Reads only from the precomputed CohortInsight collection. Aggregating per
 * request would mean scanning every classmate's snapshots on the path of a chat
 * message: slow, and a much larger surface on which to get the privacy rules
 * wrong. The nightly job (automation/intelligence/computeCohortInsights.js) is
 * the only writer.
 *
 * The privacy rules are not conventions here, they are the interface: this
 * module returns aggregates or null, and has no code path that can return a
 * student.
 */
const CohortInsight = require('../../models/CohortInsight');
const StudentIdentity = require('../../models/StudentIdentity');
const User = require('../../models/User');
const {
  COHORT_AGGREGATABLE,
  meetsCohortMinimum,
  isCohortAggregatable,
} = require('../../models/profileVisibility');

/** Normalise a dimension value so "IIM  Bangalore" and "iim bangalore" group. */
function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cohortKey({ batch, college, program }) {
  return [normalize(batch), normalize(college), normalize(program)].join('|');
}

/**
 * Which cohort this student belongs to, or null when they have not told us
 * enough to place them. Both batch and college are required: "everyone in the
 * 2027 batch, anywhere" is not a peer group, and a cohort defined on one
 * dimension collapses into something close to the whole userbase.
 */
async function resolveCohort(userId) {
  if (!userId) return null;
  const [identity, user] = await Promise.all([
    StudentIdentity.findOne({ user: userId }).select('batch college').lean(),
    User.findById(userId).select('activeProgram').lean(),
  ]);
  if (!identity?.batch || !identity?.college) return null;

  return {
    batch: identity.batch,
    college: identity.college,
    program: user?.activeProgram || 'general',
  };
}

/**
 * The cohort aggregates for this student's peer group.
 *
 * Returns null — not a smaller sample, not a wider bucket — when the cohort is
 * unknown, has never been computed, or falls under the k-anonymity minimum.
 * The stored document is already suppressed at write time; the check is
 * repeated here because a stale row written under an older rule must not be
 * served by a newer one.
 */
async function getCohortInsight(userId) {
  const cohort = await resolveCohort(userId);
  if (!cohort) return null;

  const doc = await CohortInsight.findOne({ cohortKey: cohortKey(cohort) }).lean();
  if (!doc || !meetsCohortMinimum(doc.memberCount)) return null;

  return {
    batch: doc.batch,
    college: doc.college,
    program: doc.program,
    memberCount: doc.memberCount,
    conversionPct: doc.conversionPct,
    overall: doc.overall,
    converted: doc.converted,
    notConverted: doc.notConverted,
    computedAt: doc.computedAt,
  };
}

// Only differences this large are worth a sentence. Below it, the student is
// being told that they are roughly average, which is both uninteresting and,
// on a sample of a few dozen, not something the numbers actually support.
const NOTABLE_RATIO = 1.5;

const LABELS = {
  careerReadiness: 'placement readiness',
  applicationsCount: 'applications in',
  resumeCompletion: 'resume completeness',
  consistency: 'study consistency',
  streak: 'study streak',
  studyMinutes: 'daily study minutes',
};

/**
 * One terse line comparing this student to peers who converted, for injection
 * into a prompt. '' when there is nothing defensible to say.
 *
 * Compares against the *converted* group specifically, because "students like
 * you who got the offer were doing X" is the actionable claim; comparing to the
 * cohort mean mostly measures how many people are inactive.
 */
async function summarizeCohort(userId, studentSignals = {}) {
  const insight = await getCohortInsight(userId);
  if (!insight?.converted) return '';

  const parts = [];
  for (const metric of COHORT_AGGREGATABLE) {
    if (!isCohortAggregatable(metric)) continue;
    const peer = insight.converted[metric];
    const mine = studentSignals[metric];
    if (typeof peer !== 'number' || typeof mine !== 'number' || peer <= 0) continue;
    if (peer >= mine * NOTABLE_RATIO) {
      parts.push(`${LABELS[metric] || metric}: they averaged ${peer}, you are at ${mine}`);
    }
  }
  if (!parts.length) return '';

  return `Peers in your batch who converted (n=${insight.converted.members}) — ${parts.slice(0, 3).join('; ')}`;
}

module.exports = { getCohortInsight, resolveCohort, cohortKey, normalize, summarizeCohort };
