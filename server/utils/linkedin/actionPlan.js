/**
 * Recommendation prioritisation and the upgrade plan.
 *
 * Thirty findings is the same as no findings — the student reads the list,
 * feels worse, and changes nothing. Everything here exists to cut a full
 * analysis down to the three to five things that would move the profile most,
 * and to sequence the rest.
 *
 * Priority = impact × confidence ÷ effort, computed from what the check is
 * worth in the score, how directly it was observed, and how much work the fix
 * actually is. Nothing here is an LLM judgement: the ordering must be stable
 * across runs, or the "Fix now" list changes every time the student reloads.
 */

const { DIMENSIONS } = require('./knowledge');

// How hard each fix is, in the only unit that matters to a student: whether
// they can do it now, need to sit down with it, or need to go and produce
// something first.
const EFFORT = {
  headline_present: 'low',
  headline_target_role: 'low',
  headline_not_stuffed: 'low',
  has_location: 'low',
  has_photo: 'low',
  has_skills: 'low',
  skills_populated: 'low',
  no_stuffing: 'low',
  keyword_coverage: 'medium',
  about_direction: 'medium',
  has_about: 'medium',
  about_substance: 'medium',
  specific_opening: 'medium',
  low_buzzword_density: 'medium',
  strong_verbs: 'medium',
  experience_described: 'medium',
  quantified_impact: 'medium',
  contactable: 'low',
  has_education: 'low',
  has_experience: 'medium',
  value_proposition: 'medium',
  has_evidence_section: 'high',
  featured_proof: 'high',
  proof_of_work: 'high',
  social_proof: 'high',
};

const EFFORT_COST = { low: 1, medium: 2, high: 3.5 };

/**
 * Checks whose fix depends on a fact only the student has — a number, a
 * result, a link. The recommendation says so explicitly and the UI asks for
 * the missing input rather than letting a model invent it.
 */
const NEEDS_USER_INPUT = new Set(['quantified_impact', 'proof_of_work', 'featured_proof', 'social_proof', 'has_evidence_section']);

/**
 * Confidence in a recommendation.
 *
 *  high   — directly observed in the profile and grounded in a stated rule
 *           (an empty About is an empty About).
 *  medium — observed, but the right response depends on context we inferred
 *           (keyword coverage, once the target role was matched by fuzzy name).
 *  low    — the target role was never matched, so role-specific advice is
 *           general career guidance rather than something we can stand behind.
 */
function confidenceFor(check, ctx) {
  if (check.key === 'keyword_coverage') {
    if (!ctx.roleMatched) return 'low';
    return ctx.jobDescriptionProvided ? 'high' : 'medium';
  }
  if (check.key === 'headline_target_role' && !ctx.roleMatched) return 'medium';
  if (check.status === 'partial') return 'medium';
  return 'high';
}

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.75, low: 0.45 };

/**
 * Turn failed and partial checks into ranked recommendations.
 *
 * @param {object} scored  output of scoreProfile()
 * @param {object} ctx     { roleMatched, jobDescriptionProvided, targetRole }
 */
function buildRecommendations(scored, ctx = {}) {
  const recs = scored.checks
    .filter((c) => c.status === 'fail' || c.status === 'partial')
    .map((check) => {
      const effort = EFFORT[check.key] || 'medium';
      const confidence = confidenceFor(check, ctx);
      // Impact is the points still on the table, weighted by how much of the
      // total the dimension is worth — a 7-point Credibility gap outranks a
      // 5-point Completeness one even before effort is considered.
      const impact = (check.weight - check.earned) * (DIMENSIONS[check.dimension].max / 100 + 1);
      const priority = (impact * CONFIDENCE_WEIGHT[confidence]) / EFFORT_COST[effort];

      return {
        key: check.key,
        dimension: check.dimension,
        dimensionLabel: DIMENSIONS[check.dimension].label,
        issue: check.why || check.label,
        whyItMatters: WHY_IT_MATTERS[check.dimension],
        action: check.fix,
        expectedImpact: `Up to +${Math.round(check.weight - check.earned)} points on ${DIMENSIONS[check.dimension].label}`,
        pointsAvailable: Math.round((check.weight - check.earned) * 10) / 10,
        effort,
        confidence,
        needsUserInput: NEEDS_USER_INPUT.has(check.key),
        evidence: check.why,
        _priority: priority,
      };
    })
    // Ties broken by key so the order is identical between two runs on
    // identical input — the reproducibility guarantee covers the plan, not
    // just the number.
    .sort((a, b) => b._priority - a._priority || a.key.localeCompare(b.key));

  return recs.map(({ _priority, ...rec }) => rec);
}

const WHY_IT_MATTERS = {
  positioning: 'A recruiter decides in seconds whether you are a candidate for the role they are filling. Positioning is that decision.',
  searchability: 'Most recruiter contact starts with a search you were either in or not in. Terminology decides which.',
  credibility: 'Claims without evidence are discounted. Evidence is what turns a plausible profile into a shortlisted one.',
  completeness: 'Empty sections read as an abandoned profile and remove you from filters you would otherwise pass.',
  narrative: 'The writing is the only part of your profile that sounds like a person. Generic writing makes you interchangeable.',
  conversion: 'A strong profile that gives a reader nothing to do next produces no conversations.',
};

/**
 * Split the ranked list into the three horizons the UI renders.
 * Long-term is anything that requires producing new work rather than editing
 * existing text — those are career actions, not profile edits, and mixing them
 * into "fix now" is what makes a plan feel impossible.
 */
function buildActionPlan(recommendations) {
  const longTerm = recommendations.filter((r) => r.effort === 'high');
  const editable = recommendations.filter((r) => r.effort !== 'high');

  return {
    fixNow: editable.slice(0, 5),
    improveNext: editable.slice(5, 10),
    longTerm: longTerm.slice(0, 5),
  };
}

/**
 * A day-by-day plan, built from the ranked recommendations rather than from a
 * fixed template — a student with a strong headline and an empty About should
 * not spend day one on their headline.
 *
 * Days are grouped by the section the work touches so each day is one sitting
 * against one part of the profile.
 */
const DAY_THEMES = [
  { key: 'headline', label: 'Headline', matches: ['headline_present', 'headline_target_role', 'headline_not_stuffed'] },
  { key: 'about', label: 'About', matches: ['has_about', 'about_direction', 'about_substance', 'specific_opening', 'low_buzzword_density'] },
  { key: 'experience', label: 'Experience', matches: ['experience_described', 'quantified_impact', 'strong_verbs', 'has_experience'] },
  { key: 'skills', label: 'Skills & keywords', matches: ['has_skills', 'skills_populated', 'keyword_coverage', 'no_stuffing'] },
  { key: 'featured', label: 'Featured & proof', matches: ['featured_proof', 'proof_of_work', 'has_evidence_section'] },
  { key: 'recommendations', label: 'Recommendations', matches: ['social_proof'] },
  { key: 'conversion', label: 'Contact & completeness', matches: ['contactable', 'value_proposition', 'has_location', 'has_photo', 'has_education'] },
];

function buildUpgradePlan(recommendations) {
  const byKey = new Map(recommendations.map((r) => [r.key, r]));

  const days = DAY_THEMES
    .map((theme) => {
      const items = theme.matches.map((k) => byKey.get(k)).filter(Boolean);
      return items.length
        ? {
            theme: theme.label,
            // Ordering days by the value of the work in them means day one is
            // always the day that matters most.
            weight: items.reduce((s, i) => s + i.pointsAvailable, 0),
            tasks: items.map((i) => ({ key: i.key, action: i.action, issue: i.issue, needsUserInput: i.needsUserInput })),
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7)
    .map((d, i) => ({ day: i + 1, theme: d.theme, tasks: d.tasks }));

  return days;
}

module.exports = { buildRecommendations, buildActionPlan, buildUpgradePlan, EFFORT, NEEDS_USER_INPUT };
