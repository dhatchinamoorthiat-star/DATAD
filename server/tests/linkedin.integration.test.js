/**
 * End-to-end pipeline test against a real database.
 *
 * The unit suites cover the parser, the scorer and the validator in isolation.
 * This one covers the seams between them: import → target → analyse →
 * persist → read back, plus the two things that only fail when a database is
 * involved (documents written under one user being invisible to another, and
 * a Mongoose schema quietly dropping a field the service computed).
 *
 * The LLM pass is skipped throughout. It is exercised by the validator tests,
 * and calling a provider from a test suite would make the result depend on a
 * network and on whichever model answered.
 */

// Jest does not load the server's .env, so MONGODB_URI would be undefined and
// this whole suite would skip silently. Same approach as conversations.test.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');

const LinkedInProfile = require('../models/LinkedInProfile');
const LinkedInAnalysis = require('../models/LinkedInAnalysis');
const StudentIdentity = require('../models/StudentIdentity');
const Resume = require('../models/Resume');
const linkedinService = require('../services/linkedinService');
const { RULES_VERSION } = require('../utils/linkedin/knowledge');

const { pastedProfile, strongProfile } = require('./fixtures/linkedin.sample');

// Skips rather than fails where no database is configured, so the unit suites
// stay runnable on a fresh checkout.
const HAS_DB = Boolean(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

const userA = new mongoose.Types.ObjectId();
const userB = new mongoose.Types.ObjectId();

const cleanup = () => Promise.all([
  LinkedInProfile.deleteMany({ user: { $in: [userA, userB] } }),
  LinkedInAnalysis.deleteMany({ user: { $in: [userA, userB] } }),
  StudentIdentity.deleteMany({ user: { $in: [userA, userB] } }),
  Resume.deleteMany({ user: { $in: [userA, userB] } }),
]);

beforeAll(async () => {
  if (!HAS_DB) return;
  await connectTestDb();
  await cleanup();
});

afterAll(async () => {
  if (!HAS_DB) return;
  await cleanup();
  await disconnectTestDb();
});

d('import', () => {
  afterEach(cleanup);

  it('parses a pasted profile and stores it normalised', async () => {
    const { profile } = await linkedinService.importProfile(userA, { source: 'paste', rawText: pastedProfile });

    expect(profile.profile.experience).toHaveLength(2);
    expect(profile.profile.skills.map((s) => s.name)).toContain('SQL');
    expect(profile.source).toBe('paste');
    expect(profile.contentHash).toHaveLength(32);
  });

  it('rejects a paste with nothing recognisable in it', async () => {
    await expect(linkedinService.importProfile(userA, { source: 'paste', rawText: 'https://linkedin.com/in/me' }))
      .rejects.toThrow(/Nothing recognisable/);
  });

  it('replaces rather than duplicating on re-import', async () => {
    await linkedinService.importProfile(userA, { source: 'paste', rawText: pastedProfile });
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });

    expect(await LinkedInProfile.countDocuments({ user: userA })).toBe(1);
    const stored = await LinkedInProfile.findOne({ user: userA }).lean();
    expect(stored.source).toBe('manual');
  });

  it('seeds a draft from the student\'s DATAD resume', async () => {
    await Resume.create({
      user: userA,
      personal: { fullName: 'Asha Menon', location: 'Chennai' },
      summary: 'Final-year analytics student focused on demand forecasting.',
      experience: [{ role: 'Data Intern', organization: 'Zoho', duration: 'Summer 2024', description: 'Cut ETL runtime by 40%.' }],
      skills: ['SQL', 'Python'],
    });

    const { profile } = await linkedinService.importProfile(userA, { source: 'datad' });

    expect(profile.source).toBe('datad');
    expect(profile.profile.experience[0].organization).toBe('Zoho');
    expect(profile.profile.about).toContain('demand forecasting');
  });

  it('refuses to seed from DATAD when there is nothing to seed from', async () => {
    await expect(linkedinService.importProfile(userB, { source: 'datad' }))
      .rejects.toThrow(/no DATAD resume or profile/i);
  });
});

d('analysis', () => {
  afterEach(cleanup);

  it('refuses to score without a target role rather than picking one', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });

    await expect(linkedinService.analyze(userA, { skipLlm: true })).rejects.toMatchObject({
      status: 400,
      code: 'TARGET_REQUIRED',
    });
  });

  it('persists a complete, versioned analysis', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst', industry: 'SaaS', seniority: 'entry' });

    const analysis = await linkedinService.analyze(userA, { skipLlm: true });

    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.rulesVersion).toBe(RULES_VERSION);
    expect(analysis.profileHash).toHaveLength(32);
    expect(Object.keys(analysis.dimensions.toObject())).toHaveLength(6);
    expect(analysis.checks.length).toBeGreaterThan(10);
    expect(analysis.actionPlan.fixNow.length).toBeGreaterThan(0);
    expect(analysis.upgradePlan.length).toBeGreaterThan(0);
    // The LLM pass was skipped, and the record says so rather than pretending
    // a writing review happened.
    expect(analysis.meta.llmSkipped).toBe(true);
    expect(analysis.narrative.unavailable).toBe('skipped');
  });

  it('survives a Mongoose round trip without losing computed fields', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst' });
    const created = await linkedinService.analyze(userA, { skipLlm: true });

    // Reading back through the schema is where a mistyped subdocument shows
    // up: Mongoose drops unknown paths silently, so a field the service
    // computed can vanish between create() and the next request.
    const reread = await LinkedInAnalysis.findById(created._id).lean();

    expect(reread.score).toBe(created.score);
    expect(reread.keywords.terms.length).toBe(created.keywords.terms.length);
    expect(reread.recommendations[0].action).toBeTruthy();
    expect(reread.recommendations[0].confidence).toMatch(/^(high|medium|low)$/);
    expect(reread.skills.strong).toEqual(expect.any(Array));
    expect(reread.authenticity.observations).toEqual(expect.any(Array));
  });

  it('infers the target from the DATAD profile and marks it inferred', async () => {
    await StudentIdentity.create({ user: userA, dreamRole: 'Data Analyst', preferredIndustries: ['Technology'] });
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });

    const analysis = await linkedinService.analyze(userA, { skipLlm: true });

    expect(analysis.target.role).toBe('Data Analyst');
    expect(analysis.target.inferred).toBe(true);
  });

  it('records which DATAD sources fed the analysis', async () => {
    await Resume.create({ user: userA, personal: { fullName: 'Asha' }, skills: ['SQL'] });
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst' });

    const analysis = await linkedinService.analyze(userA, { skipLlm: true });
    expect(analysis.contextSources.resume).toBe(true);
    expect(analysis.contextSources.jobDescription).toBe(false);
  });

  it('attaches a job match when a description is supplied, without storing the posting', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst' });

    const jd = 'Product Analyst\nWe need strong SQL, Product Analytics and A/B Testing skills. SQL and A/B Testing are essential. Product Analytics tooling experience required.';
    const analysis = await linkedinService.analyze(userA, { jobDescription: jd, jobLabel: 'Zoho — PA', skipLlm: true });

    expect(analysis.jobMatch.overall).toBeGreaterThan(0);
    expect(analysis.jobMatch.label).toBe('Zoho — PA');
    // The posting is someone else's copyrighted text and has no use after the
    // comparison, so only the result is kept.
    expect(JSON.stringify(analysis.toObject())).not.toContain('We need strong SQL');
  });

  it('keeps history rather than overwriting the previous run', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst' });

    await linkedinService.analyze(userA, { skipLlm: true });
    await linkedinService.analyze(userA, { skipLlm: true });

    const history = await linkedinService.listAnalyses(userA);
    expect(history).toHaveLength(2);
    // Same profile, same rules — same score. The reproducibility promise, held
    // across two separate database round trips.
    expect(history[0].score).toBe(history[1].score);
  });
});

d('state and isolation', () => {
  afterEach(cleanup);

  it('reports the wizard step the stored data supports', async () => {
    expect((await linkedinService.getState(userA)).hasProfile).toBe(false);

    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    const afterImport = await linkedinService.getState(userA);
    expect(afterImport.hasProfile).toBe(true);
    expect(afterImport.target?.role).toBeFalsy();

    await linkedinService.setTarget(userA, { role: 'Product Analyst' });
    await linkedinService.analyze(userA, { skipLlm: true });
    const afterAnalysis = await linkedinService.getState(userA);
    expect(afterAnalysis.analysis.score).toBeGreaterThan(0);
    expect(afterAnalysis.stale).toBe(false);
  });

  it('marks an analysis stale once the profile is edited underneath it', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst' });
    await linkedinService.analyze(userA, { skipLlm: true });

    await linkedinService.importProfile(userA, {
      source: 'manual',
      profile: { ...strongProfile(), headline: 'Something entirely different' },
    });

    expect((await linkedinService.getState(userA)).stale).toBe(true);
  });

  it('does not leak one student\'s profile or analyses to another', async () => {
    await linkedinService.importProfile(userA, { source: 'manual', profile: strongProfile() });
    await linkedinService.setTarget(userA, { role: 'Product Analyst' });
    await linkedinService.analyze(userA, { skipLlm: true });

    const other = await linkedinService.getState(userB);
    expect(other.hasProfile).toBe(false);
    expect(other.analysis).toBeNull();
    expect(await linkedinService.listAnalyses(userB)).toEqual([]);
  });

  it('reports the target it would suggest without committing to it', async () => {
    await StudentIdentity.create({ user: userB, dreamRole: 'Consultant' });
    const state = await linkedinService.getState(userB);

    expect(state.suggestedTarget.role).toBe('Consultant');
    expect(state.suggestedTarget.inferred).toBe(true);
    expect(state.target).toBeNull();
  });
});
