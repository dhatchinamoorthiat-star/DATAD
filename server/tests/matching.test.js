/**
 * Deterministic matching-engine tests.
 *
 * The scoring maths are pure (no DB, no clock, no randomness), so these assert
 * EXACT hand-computed values and byte-for-byte repeatability. The cache /
 * invalidation section is DB-gated like the rest of the suite.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const { scoreContext, inputsHash } = require('../ai/matching/matchingEngine');
const engine = require('../ai/matching');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');

// A well-qualified helper for a coding_help opportunity.
const strongCtx = {
  userId: 'u1',
  skills: ['react', 'javascript', 'teaching'],
  verifiedSkills: [],
  specialization: 'Computer Science',
  targetRoles: ['Frontend Engineer'],
  careerReadiness: 80,
  trackRecord: { completedCount: 5, completionRatePct: 100, onTimePct: 80, avgRating: 4.5, responseRatePct: 90 },
  activeLoad: 0,
  dataPresence: { hasSigScores: true, hasHistory: true, hasSkills: true },
};
const codingOpp = { _id: 'o1', category: 'coding_help', skills: ['react', 'javascript', 'css'], updatedAt: null };

// A data-poor, overloaded, mismatched helper.
const weakCtx = {
  userId: 'u2',
  skills: [],
  verifiedSkills: [],
  specialization: null,
  targetRoles: [],
  careerReadiness: 0,
  trackRecord: { completedCount: 0 },
  activeLoad: 5,
  dataPresence: { hasSigScores: false, hasHistory: false, hasSkills: false },
};
const designOpp = { _id: 'o2', category: 'design', skills: ['figma', 'photoshop'], updatedAt: null };

describe('matching — deterministic scoring (pure)', () => {
  test('strong match: exact score, confidence, breakdown', () => {
    const r = scoreContext(strongCtx, codingOpp);
    // skillMatch 23 + trackRecord 23 + careerAffinity 18 + responsiveness 9 + availability 10 = 83; −4 missing css
    expect(r.score).toBe(79);
    expect(r.confidence).toBe(100);
    expect(r.missingSkills).toEqual(['css']);
    expect(r.strengths).toHaveLength(4); // trackRecord, careerAffinity, responsiveness, availability
    expect(r.warnings).toHaveLength(0);

    const skillRule = r.reasons.find((x) => x.key === 'skillMatch');
    expect(skillRule.weight).toBe(35);
    expect(skillRule.contribution).toBe(23);
    const penalty = r.reasons.find((x) => x.key === 'missingSkills');
    expect(penalty.contribution).toBe(-4);
  });

  test('weak match: penalties applied, low confidence, warnings surfaced', () => {
    const r = scoreContext(weakCtx, designOpp);
    // positive 0+13+3+5+0 = 21; −8 missing(2) −12 overload = 1
    expect(r.score).toBe(1);
    expect(r.confidence).toBe(40); // base only — no SIG, history or skills
    expect(r.missingSkills).toEqual(['figma', 'photoshop']);
    expect(r.strengths).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
    expect(r.warnings.some((w) => /Overloaded/.test(w))).toBe(true);
  });

  test('score is bounded 0..100', () => {
    expect(scoreContext(weakCtx, designOpp).score).toBeGreaterThanOrEqual(0);
    expect(scoreContext(strongCtx, codingOpp).score).toBeLessThanOrEqual(100);
  });

  test('100% repeatable: same inputs → identical output', () => {
    const a = JSON.stringify(scoreContext(strongCtx, codingOpp));
    const b = JSON.stringify(scoreContext(strongCtx, codingOpp));
    expect(a).toBe(b);
  });

  test('empty required skills ⇒ skillMatch does not apply and adds no free points', () => {
    const r = scoreContext(strongCtx, { _id: 'o3', category: 'coding_help', skills: [], updatedAt: null });
    const skillRule = r.reasons.find((x) => x.key === 'skillMatch');
    expect(skillRule.applies).toBe(false);
    expect(r.missingSkills).toEqual([]);
  });

  test('opportunity skills are case-insensitive', () => {
    const upper = scoreContext(strongCtx, { _id: 'o4', category: 'coding_help', skills: ['REACT', 'JavaScript', 'CSS'], updatedAt: null });
    expect(upper.score).toBe(79);
  });

  test('weights are centralised and sum to 100', () => {
    const total = Object.values(engine.weightConfig.WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe('matching — inputsHash (pure)', () => {
  test('stable for identical inputs, changes when skills change', () => {
    const h1 = inputsHash(strongCtx, codingOpp);
    const h2 = inputsHash(strongCtx, codingOpp);
    expect(h1).toBe(h2);
    const changed = inputsHash({ ...strongCtx, skills: ['react'] }, codingOpp);
    expect(changed).not.toBe(h1);
  });

  test('changes when the opportunity changes', () => {
    const h1 = inputsHash(strongCtx, codingOpp);
    const h2 = inputsHash(strongCtx, { ...codingOpp, updatedAt: new Date('2026-01-01') });
    expect(h1).not.toBe(h2);
  });
});

const HAS_DB = Boolean(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

d('matching — cache + invalidation (DB)', () => {
  let MatchScore, Opportunity;
  const userId = new mongoose.Types.ObjectId();
  let opp;

  beforeAll(async () => {
    await connectTestDb();
    MatchScore = require('../models/MatchScore');
    Opportunity = require('../models/Opportunity');
    await MatchScore.syncIndexes();
    opp = await Opportunity.create({
      user: new mongoose.Types.ObjectId(), kind: 'need_help', category: 'coding_help',
      title: 'T', description: 'D', skills: ['react'], status: 'open',
    });
  });

  afterAll(async () => {
    await MatchScore.deleteMany({ user: userId });
    await Opportunity.deleteMany({ _id: opp._id });
    await disconnectTestDb();
  });

  test('scoreAndCache writes a MatchScore row; second read hits the cache', async () => {
    const first = await engine.scoreAndCache(userId, opp);
    expect(typeof first.score).toBe('number');
    const row = await MatchScore.findOne({ user: userId, opportunity: opp._id });
    expect(row).toBeTruthy();
    expect(row.modelVersion).toBe(engine.MODEL_VERSION);

    const second = await engine.getCachedOrCompute(userId, opp);
    expect(second.cached).toBe(true);
    expect(second.score).toBe(first.score);
  });

  test('invalidateForUser drops the row → next read recomputes (cached:false)', async () => {
    await engine.invalidator.invalidateForUser(userId);
    expect(await MatchScore.countDocuments({ user: userId })).toBe(0);
    const again = await engine.getCachedOrCompute(userId, opp);
    expect(again.cached).toBe(false);
  });

  test('handleEvent(opportunity.updated) invalidates that opportunity', async () => {
    await engine.scoreAndCache(userId, opp);
    await engine.invalidator.handleEvent('opportunity.updated', { opportunityId: opp._id });
    expect(await MatchScore.countDocuments({ opportunity: opp._id })).toBe(0);
  });
});
