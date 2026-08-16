/**
 * RuleSet — the deterministic scoring rules.
 *
 * Each rule is a pure function `(ctx, opportunity) => RuleResult`:
 *   {
 *     key, label, weight,
 *     raw,           // 0..1 normalised signal strength
 *     contribution,  // round(weight * raw) — points added to the score
 *     applies,       // false when the signal is absent/not relevant
 *     flag,          // 'strength' | 'warning' | null
 *     detail,        // structured, machine-readable extras (no prose)
 *   }
 *
 * No rule touches the clock, a random source or the database. Same ctx ⇒ same
 * result, always. Weights/thresholds/keywords come only from weightConfig.
 */

const { WEIGHTS, BASELINES, THRESHOLDS, AVAILABILITY, CATEGORY_KEYWORDS } = require('./weightConfig');

const clamp01 = (n) => Math.max(0, Math.min(1, n));

function flagFor(raw, applies) {
  if (!applies) return null;
  if (raw >= THRESHOLDS.strengthRaw) return 'strength';
  if (raw <= THRESHOLDS.warningRaw) return 'warning';
  return null;
}

function result(key, label, weight, raw, applies, detail = {}) {
  const r = clamp01(raw);
  return {
    key,
    label,
    weight,
    raw: r,
    contribution: Math.round(weight * r),
    applies,
    flag: flagFor(r, applies),
    detail,
  };
}

/** Skill overlap: fraction of the opportunity's required skills the student has. */
function skillMatch(ctx, opportunity) {
  const required = opportunity.skills || [];
  if (!required.length) {
    // No skills specified ⇒ neutral, not a free 100%.
    return result('skillMatch', 'Skill match', WEIGHTS.skillMatch, BASELINES.trackRecord, false, {
      requiredCount: 0, matchedCount: 0, matched: [], missing: [],
    });
  }
  const have = new Set(ctx.skills);
  const matched = required.filter((s) => have.has(s));
  const missing = required.filter((s) => !have.has(s));
  const raw = matched.length / required.length;
  return result('skillMatch', 'Skill match', WEIGHTS.skillMatch, raw, true, {
    requiredCount: required.length,
    matchedCount: matched.length,
    matched,
    missing,
  });
}

/** Track record: quality of completed work (completion %, on-time %, rating). */
function trackRecord(ctx) {
  const tr = ctx.trackRecord;
  const hasHistory = tr && tr.completedCount > 0;
  if (!hasHistory) {
    return result('trackRecord', 'Track record', WEIGHTS.trackRecord, BASELINES.trackRecord, false, {
      completedCount: 0,
    });
  }
  // Average the three normalised sub-signals that are present.
  const parts = [];
  if (tr.completionRatePct != null) parts.push(tr.completionRatePct / 100);
  if (tr.onTimePct != null) parts.push(tr.onTimePct / 100);
  if (tr.avgRating != null) parts.push(tr.avgRating / 5);
  const raw = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : BASELINES.trackRecord;
  return result('trackRecord', 'Track record', WEIGHTS.trackRecord, raw, true, {
    completedCount: tr.completedCount,
    completionRatePct: tr.completionRatePct ?? null,
    onTimePct: tr.onTimePct ?? null,
    avgRating: tr.avgRating ?? null,
  });
}

/** Career affinity: category keywords vs profile, blended with career readiness. */
function careerAffinity(ctx, opportunity) {
  const keywords = CATEGORY_KEYWORDS[opportunity.category] || [];
  const haystack = [
    ...(ctx.skills || []),
    ctx.specialization || '',
    ...(ctx.targetRoles || []),
  ].join(' ').toLowerCase();

  const keywordHit = keywords.some((k) => haystack.includes(k));
  const keywordComponent = keywordHit ? 1 : BASELINES.careerReadinessKeywordMiss;
  const readinessComponent = (ctx.careerReadiness ?? 0) / 100;
  const raw = keywordComponent * 0.5 + readinessComponent * 0.5;

  return result('careerAffinity', 'Career fit', WEIGHTS.careerAffinity, raw, true, {
    keywordHit,
    careerReadiness: ctx.careerReadiness ?? null,
  });
}

/** Responsiveness: response rate to past opportunities. */
function responsiveness(ctx) {
  const rate = ctx.trackRecord?.responseRatePct;
  if (rate == null) {
    return result('responsiveness', 'Responsiveness', WEIGHTS.responsiveness, BASELINES.responsiveness, false, {
      responseRatePct: null,
    });
  }
  return result('responsiveness', 'Responsiveness', WEIGHTS.responsiveness, rate / 100, true, {
    responseRatePct: rate,
  });
}

/** Availability: current concurrent active-engagement load vs capacity ceiling. */
function availability(ctx) {
  const load = ctx.activeLoad ?? 0;
  let raw;
  if (load < AVAILABILITY.freeBelow) raw = 1;
  else if (load >= AVAILABILITY.overloadAt) raw = 0;
  else {
    // Linear decay between freeBelow and overloadAt.
    const span = AVAILABILITY.overloadAt - AVAILABILITY.freeBelow;
    raw = 1 - (load - AVAILABILITY.freeBelow + 1) / (span + 1);
  }
  return result('availability', 'Availability', WEIGHTS.availability, raw, true, {
    activeLoad: load,
    overloaded: load >= AVAILABILITY.overloadAt,
  });
}

// Ordered so the breakdown is stable and reproducible.
const RULES = [skillMatch, trackRecord, careerAffinity, responsiveness, availability];

module.exports = { RULES, clamp01 };
