/**
 * ScoreCalculator — pure aggregation of the ruleset into the final result.
 *
 * Deterministic: `compute(ctx, opportunity)` has no time, randomness or I/O.
 * Given the same normalised context and opportunity it always returns the same
 * numbers, which is what the repeatability tests pin.
 *
 * Output shape (the Phase 3A contract):
 *   { score, confidence, reasons, strengths, warnings, missingSkills, modelVersion }
 * where `reasons` is the full explainable breakdown (one entry per rule plus any
 * penalty), never prose.
 */

const { RULES } = require('./ruleSet');
const { PENALTIES, CONFIDENCE, MODEL_VERSION } = require('./weightConfig');

function computeConfidence(ctx) {
  let c = CONFIDENCE.base;
  if (ctx.dataPresence?.hasSigScores) c += CONFIDENCE.hasSigScores;
  if (ctx.dataPresence?.hasHistory) c += CONFIDENCE.hasHistory;
  if (ctx.dataPresence?.hasSkills) c += CONFIDENCE.hasSkills;
  return Math.max(0, Math.min(100, c));
}

function compute(ctx, opportunity) {
  const ruleResults = RULES.map((rule) => rule(ctx, opportunity));

  const positive = ruleResults.reduce((sum, r) => sum + r.contribution, 0);

  // ── Penalties ──────────────────────────────────────────────────────────
  const penalties = [];

  const skill = ruleResults.find((r) => r.key === 'skillMatch');
  const missingSkills = skill?.detail?.missing || [];
  if (missingSkills.length) {
    const amount = Math.min(
      missingSkills.length * PENALTIES.perMissingSkill,
      PENALTIES.maxMissingSkill
    );
    penalties.push({
      key: 'missingSkills',
      label: 'Missing required skills',
      contribution: -amount,
      detail: { skills: missingSkills, perSkill: PENALTIES.perMissingSkill, cap: PENALTIES.maxMissingSkill },
    });
  }

  const avail = ruleResults.find((r) => r.key === 'availability');
  if (avail?.detail?.overloaded) {
    penalties.push({
      key: 'overload',
      label: 'Currently overloaded',
      contribution: -PENALTIES.overload,
      detail: { activeLoad: avail.detail.activeLoad },
    });
  }

  const penaltyTotal = penalties.reduce((sum, p) => sum + p.contribution, 0);
  const score = Math.max(0, Math.min(100, Math.round(positive + penaltyTotal)));

  // Full breakdown = every rule + every penalty. This IS the explanation.
  const reasons = [
    ...ruleResults.map((r) => ({
      key: r.key,
      label: r.label,
      weight: r.weight,
      raw: r.raw,
      contribution: r.contribution,
      applies: r.applies,
      detail: r.detail,
    })),
    ...penalties,
  ];

  return {
    score,
    confidence: computeConfidence(ctx),
    reasons,
    // strengths/warnings/missingSkills are surfaced by reasonBuilder from these
    // rule results; kept on the raw output too for direct consumers.
    _ruleResults: ruleResults,
    _penalties: penalties,
    missingSkills,
    modelVersion: MODEL_VERSION,
  };
}

module.exports = { compute, computeConfidence };
