/**
 * WeightConfig — the single source of truth for every number the deterministic
 * matching engine uses. Nothing in the ruleset, calculator or reason builder
 * hard-codes a weight, threshold or penalty; they all read from here, so tuning
 * the engine is a one-file change and every score stays explainable.
 *
 * Positive rule weights sum to 100 (a perfect match with no penalties scores
 * 100). Penalties are subtracted on top and the result is clamped to 0..100.
 *
 * DETERMINISM: there is no time, randomness or I/O in the scoring maths. The
 * only place a clock appears is the cache TTL, which never influences a score.
 */

// Bump when any weight/rule/threshold below changes — invalidates cached scores
// through inputsHash and records which version produced a stored MatchScore.
const MODEL_VERSION = 'match-v1';

// Positive rule weights (sum = 100).
const WEIGHTS = {
  skillMatch: 35,       // overlap between required skills and the student's skills
  trackRecord: 25,      // completed work quality: completion %, on-time %, rating
  careerAffinity: 20,   // category ↔ specialization / target roles / readiness
  responsiveness: 10,   // response rate to past opportunities
  availability: 10,     // current engagement load (capacity to take this on)
};

// Penalties (subtracted after positive contributions).
const PENALTIES = {
  perMissingSkill: 4,       // each required skill the student lacks
  maxMissingSkill: 20,      // cap so a long skill list can't zero the score
  overload: 12,             // student is at/over the concurrent-work ceiling
};

// Neutral baselines used when a signal is absent, so a data-poor student is
// scored fairly (neither rewarded nor punished for missing history) rather than
// zeroed. Confidence — not the score — reflects the missing data.
const BASELINES = {
  trackRecord: 0.5,      // no completed engagements yet
  responsiveness: 0.5,   // no response history yet
  careerReadinessKeywordMiss: 0.3, // category keywords not found in profile
};

// Classification thresholds for turning a rule's raw 0..1 into a strength/warning.
const THRESHOLDS = {
  strengthRaw: 0.7,      // raw ≥ this ⇒ a strength
  warningRaw: 0.3,       // raw ≤ this ⇒ a warning (only when the signal applies)
  skillGapWarningRatio: 0.5, // matched-skill ratio ≤ this ⇒ skill-gap warning
};

// Availability model: how concurrent active engagements map to capacity (raw).
const AVAILABILITY = {
  freeBelow: 1,     // < this many active engagements ⇒ fully available (raw 1)
  overloadAt: 4,    // ≥ this many ⇒ overloaded (raw 0 + overload penalty)
};

// Confidence model — how sure the engine is of the score, from data presence.
// Independent of the score itself. Sums are clamped to 0..100.
const CONFIDENCE = {
  base: 40,
  hasSigScores: 25,   // SIG returned real context (contextQualityScore > 0)
  hasHistory: 20,     // student has ≥1 completed engagement (track record real)
  hasSkills: 15,      // student lists at least one skill
};

// Deterministic category → keyword hints for career affinity. Keywords are
// matched (lowercased, substring) against the student's skills, specialization
// and target roles. No LLM, no fuzzy matching.
const CATEGORY_KEYWORDS = {
  tutoring: ['teach', 'tutor', 'mentor'],
  resume_review: ['resume', 'cv', 'career', 'writing'],
  mock_interview: ['interview', 'communication', 'hr'],
  coding_help: ['program', 'coding', 'software', 'developer', 'engineer'],
  assignment_help: ['assignment', 'homework', 'academic'],
  research: ['research', 'analysis', 'paper', 'thesis'],
  design: ['design', 'ui', 'ux', 'figma', 'graphic'],
  presentation: ['presentation', 'slides', 'ppt', 'public speaking'],
  club_work: ['event', 'club', 'organiz', 'management'],
  team_formation: ['team', 'collaborat', 'project'],
  mentoring: ['mentor', 'guidance', 'coaching'],
};

// Cache TTL backstop (does not affect scores). 24h, per architecture doc.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

module.exports = {
  MODEL_VERSION,
  WEIGHTS,
  PENALTIES,
  BASELINES,
  THRESHOLDS,
  AVAILABILITY,
  CONFIDENCE,
  CATEGORY_KEYWORDS,
  CACHE_TTL_MS,
};
