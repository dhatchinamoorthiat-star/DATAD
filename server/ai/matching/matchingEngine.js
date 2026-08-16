/**
 * MatchingEngine — deterministic "how suitable is this student for this
 * opportunity?" No LLM anywhere.
 *
 * Pipeline:
 *   Student Intelligence Graph (buildStudentProfile)
 *      + TalentProfile (read-only track record — reputation is NOT computed here)
 *      + active engagement load
 *   → normalised context (buildContext)
 *   → scoreCalculator (pure) → reasonBuilder (pure)
 *   → { score, confidence, reasons, strengths, warnings, missingSkills }
 *
 * The context is user-level, so scoreMany() builds it ONCE and scores a whole
 * feed of opportunities against it — the intended feed path.
 *
 * Caching reuses the MatchScore model: a stored row is served only when it is
 * both unexpired (TTL) and fresh (inputsHash matches the current inputs), per
 * the invalidation contract documented on the model. Nothing here computes
 * reputation, credits, Dax or notifications.
 */

const crypto = require('crypto');
const MatchScore = require('../../models/MatchScore');
const TalentProfile = require('../../models/TalentProfile');
const Engagement = require('../../models/Engagement');
const { buildStudentProfile } = require('../intelligence-layer');
const scoreCalculator = require('./scoreCalculator');
const reasonBuilder = require('./reasonBuilder');
const { MODEL_VERSION, CACHE_TTL_MS } = require('./weightConfig');

const ACTIVE_ENGAGEMENT_STATES = ['accepted', 'in_progress', 'delivered'];

function lowerUnique(list) {
  const seen = new Set();
  for (const s of list) {
    if (typeof s === 'string' && s.trim()) seen.add(s.trim().toLowerCase());
  }
  return [...seen];
}

/**
 * Build the deterministic, user-level matching context from existing SIG data
 * and the (read-only) TalentProfile. Absent signals fall back to neutral
 * baselines in the rules; missing data lowers confidence, never the score.
 */
async function buildContext(userId) {
  const [profile, talent, activeLoad] = await Promise.all([
    buildStudentProfile(userId),
    TalentProfile.findOne({ user: userId }).lean(),
    Engagement.countDocuments({
      helper: userId,
      status: { $in: ACTIVE_ENGAGEMENT_STATES },
      deletedAt: null,
    }),
  ]);

  const careerSkills = profile?.career?.skills || [];
  const talentSkillNames = (talent?.skills || []).map((s) => s.name).filter(Boolean);
  const skills = lowerUnique([...careerSkills, ...talentSkillNames]);

  const trackRecord = talent
    ? {
        completedCount: talent.completedCount || 0,
        completionRatePct: talent.completionRatePct ?? null,
        onTimePct: talent.onTimePct ?? null,
        avgRating: talent.avgRating ?? null,
        responseRatePct: talent.responseRatePct ?? null,
      }
    : { completedCount: 0 };

  return {
    userId: String(userId),
    skills,
    verifiedSkills: (talent?.skills || []).filter((s) => s.verified).map((s) => String(s.name).toLowerCase()),
    specialization: profile?.identity?.specialization || profile?.career?.specialization || null,
    targetRoles: profile?.career?.targetRoles || [],
    careerReadiness: profile?.scores?.careerReadiness ?? 0,
    trackRecord,
    activeLoad,
    dataPresence: {
      hasSigScores: (profile?.scores?.contextQualityScore || 0) > 0,
      hasHistory: (trackRecord.completedCount || 0) > 0,
      hasSkills: skills.length > 0,
    },
  };
}

/** Normalise an opportunity's skills to lowercase so overlap is case-stable. */
function normalizeOpportunity(opportunity) {
  return {
    _id: opportunity._id,
    category: opportunity.category,
    skills: lowerUnique(opportunity.skills || []),
    updatedAt: opportunity.updatedAt || null,
  };
}

/** PURE: score a prebuilt context against one opportunity. No I/O, no clock. */
function scoreContext(ctx, opportunity) {
  const opp = normalizeOpportunity(opportunity);
  const calc = scoreCalculator.compute(ctx, opp);
  return reasonBuilder.build(calc);
}

/** Freshness fingerprint of everything that can change a score (see MatchScore). */
function inputsHash(ctx, opportunity) {
  const opp = normalizeOpportunity(opportunity);
  const payload = JSON.stringify({
    v: MODEL_VERSION,
    skills: [...ctx.skills].sort(),
    tr: ctx.trackRecord,
    load: ctx.activeLoad,
    readiness: ctx.careerReadiness,
    spec: ctx.specialization,
    roles: [...(ctx.targetRoles || [])].sort(),
    oppSkills: [...opp.skills].sort(),
    cat: opp.category,
    oppUpdated: opp.updatedAt,
  });
  return crypto.createHash('sha1').update(payload).digest('hex');
}

async function upsertCache(ctx, opportunity, result) {
  const hash = inputsHash(ctx, opportunity);
  await MatchScore.findOneAndUpdate(
    { user: ctx.userId, opportunity: opportunity._id },
    {
      $set: {
        score: result.score,
        reasons: result.reasonStrings,
        modelVersion: MODEL_VERSION,
        inputsHash: hash,
        opportunityUpdatedAt: opportunity.updatedAt || null,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
    },
    { upsert: true, new: true }
  );
}

/** Score one opportunity for a user (builds context, no cache). */
async function scoreForUser(userId, opportunity) {
  const ctx = await buildContext(userId);
  return scoreContext(ctx, opportunity);
}

/** Score many opportunities for one user — builds the SIG context once. */
async function scoreMany(userId, opportunities) {
  const ctx = await buildContext(userId);
  return opportunities.map((opp) => ({ opportunity: opp._id, ...scoreContext(ctx, opp) }));
}

/** Compute and write the MatchScore cache row; returns the full result. */
async function scoreAndCache(userId, opportunity) {
  const ctx = await buildContext(userId);
  const result = scoreContext(ctx, opportunity);
  await upsertCache(ctx, opportunity, result);
  return result;
}

/**
 * Serve from cache when unexpired AND fresh (inputsHash matches); otherwise
 * recompute and refresh the row. On a hit, returns the stored feed subset
 * ({ score, reasons }) with cached:true; on a miss, the full result.
 */
async function getCachedOrCompute(userId, opportunity) {
  const ctx = await buildContext(userId);
  const hash = inputsHash(ctx, opportunity);
  const cached = await MatchScore.findOne({ user: ctx.userId, opportunity: opportunity._id }).lean();
  if (cached && cached.expiresAt > new Date() && cached.inputsHash === hash) {
    return { score: cached.score, reasons: cached.reasons, cached: true };
  }
  const result = scoreContext(ctx, opportunity);
  await upsertCache(ctx, opportunity, result);
  return { ...result, cached: false };
}

module.exports = {
  buildContext,
  scoreContext,
  scoreForUser,
  scoreMany,
  scoreAndCache,
  getCachedOrCompute,
  inputsHash,
  MODEL_VERSION,
};
