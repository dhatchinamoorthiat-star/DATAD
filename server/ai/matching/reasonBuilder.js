/**
 * ReasonBuilder — turns the calculator's structured breakdown into the
 * strengths / warnings arrays and the short factual `reasons` strings that the
 * MatchScore cache stores for feed display.
 *
 * IMPORTANT: this is templated string assembly from already-computed facts, not
 * generation. There is no model here. Every string is built from a rule result,
 * so it is fully determined by the inputs (a strict Phase 3A requirement).
 */

const { THRESHOLDS } = require('./weightConfig');

/** Human strengths: rules that scored at/above the strength threshold. */
function buildStrengths(ruleResults) {
  const out = [];
  for (const r of ruleResults) {
    if (r.flag !== 'strength') continue;
    switch (r.key) {
      case 'skillMatch':
        out.push(`Strong skill match (${r.detail.matchedCount}/${r.detail.requiredCount} required skills)`);
        break;
      case 'trackRecord':
        out.push(`Proven track record over ${r.detail.completedCount} completed engagement(s)`);
        break;
      case 'careerAffinity':
        out.push('Strong career fit for this category');
        break;
      case 'responsiveness':
        out.push(`Responsive (${r.detail.responseRatePct}% response rate)`);
        break;
      case 'availability':
        out.push('Available to take this on now');
        break;
      default:
        out.push(r.label);
    }
  }
  return out;
}

/** Human warnings: rule warnings + a skill-gap note + overload penalty. */
function buildWarnings(ruleResults, penalties) {
  const out = [];
  for (const r of ruleResults) {
    if (r.flag !== 'warning') continue;
    switch (r.key) {
      case 'skillMatch':
        if (r.detail.requiredCount && r.detail.matchedCount / r.detail.requiredCount <= THRESHOLDS.skillGapWarningRatio) {
          out.push(`Skill gap: only ${r.detail.matchedCount}/${r.detail.requiredCount} required skills`);
        }
        break;
      case 'trackRecord':
        out.push('Limited completed-work history');
        break;
      case 'responsiveness':
        out.push(`Low response rate (${r.detail.responseRatePct}%)`);
        break;
      case 'availability':
        out.push('Limited availability (busy with other work)');
        break;
      default:
        out.push(r.label);
    }
  }
  for (const p of penalties) {
    if (p.key === 'overload') out.push(`Overloaded: ${p.detail.activeLoad} active engagements`);
  }
  return out;
}

/** Short factual reason strings for the MatchScore cache / feed. */
function buildReasonStrings(ruleResults) {
  return ruleResults
    .filter((r) => r.applies)
    .sort((a, b) => b.contribution - a.contribution)
    .map((r) => `${r.label}: +${r.contribution}`);
}

/** Assemble the full public result from the calculator output. */
function build(calc) {
  return {
    score: calc.score,
    confidence: calc.confidence,
    reasons: calc.reasons, // full structured breakdown
    reasonStrings: buildReasonStrings(calc._ruleResults),
    strengths: buildStrengths(calc._ruleResults),
    warnings: buildWarnings(calc._ruleResults, calc._penalties),
    missingSkills: calc.missingSkills,
    modelVersion: calc.modelVersion,
  };
}

module.exports = { build, buildStrengths, buildWarnings, buildReasonStrings };
