/**
 * Phase 6 — trajectory reaches the model, and only when it is real.
 *
 * Phases 1–5 are inert unless the trend history changes what Dax says. This
 * asserts the wiring: summarizeTrends' output travels through
 * buildStudentProfile → buildEnrichedContext → the gateway → the provider, and
 * arrives in front of the model.
 *
 * The other half is restraint. A student with no snapshot history must produce
 * no trend segment at all, because a "Trends:" label with nothing behind it is
 * an invitation for the model to fill it in.
 *
 * No database, no network.
 */

let mockSnapshotRows = [];
jest.mock('../models/StudentProfileSnapshot', () => ({
  find: () => ({ select: () => ({ sort: () => ({ lean: async () => mockSnapshotRows }) }) }),
}));

// Collectors are not what is under test — return nothing so the assertions are
// about the trend segment rather than about profile plumbing.
for (const name of ['identity', 'memory', 'task', 'note', 'planner', 'career', 'learning', 'activity', 'stress']) {
  jest.mock(`../ai/intelligence-layer/collectors/${name}Collector`, () => ({ collect: async () => null }));
}

const { buildStudentProfile } = require('../ai/intelligence-layer');
const { buildEnrichedContext } = require('../ai/intelligence-layer/profileFactory');
const { DAX_CORE } = require('../ai/dax');

const keyDaysAgo = (n) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeEach(() => {
  mockSnapshotRows = [];
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('trend injection', () => {
  it('puts a notable movement into the enriched context the model sees', async () => {
    mockSnapshotRows = [
      { dateKey: keyDaysAgo(13), signals: { consistency: 80 } },
      { dateKey: keyDaysAgo(1), signals: { consistency: 50 } },
    ];

    const profile = await buildStudentProfile('u1');

    expect(profile.trendSummary).toContain('consistency');
    expect(profile.enrichedContext).toContain('consistency');
    expect(profile.enrichedContext).toContain('down');
    // The dates and the raw numbers travel with it — Dax is told to cite its
    // evidence, so the evidence has to be in the context to cite.
    expect(profile.enrichedContext).toContain('80→50');
    expect(profile.enrichedContext).toContain(keyDaysAgo(13));
  });

  it('says nothing at all when the student has no snapshot history', async () => {
    mockSnapshotRows = [];
    const profile = await buildStudentProfile('u1');

    expect(profile.trendSummary).toBe('');
    expect(profile.enrichedContext).not.toMatch(/trend/i);
  });

  it('says nothing when a single snapshot exists — one reading is not a direction', async () => {
    mockSnapshotRows = [{ dateKey: keyDaysAgo(1), signals: { consistency: 50 } }];
    const profile = await buildStudentProfile('u1');
    expect(profile.trendSummary).toBe('');
  });

  it('says nothing when the movement is below the notable threshold', async () => {
    mockSnapshotRows = [
      { dateKey: keyDaysAgo(13), signals: { consistency: 70 } },
      { dateKey: keyDaysAgo(1), signals: { consistency: 73 } },
    ];
    const profile = await buildStudentProfile('u1');
    expect(profile.enrichedContext).not.toMatch(/trend/i);
  });

  it('stays token-cheap — the trend segment is one short clause, not a report', async () => {
    // Every tracked metric moving at once is the worst case for length.
    mockSnapshotRows = [
      {
        dateKey: keyDaysAgo(13),
        careerReadiness: 20, intelligenceScore: 20, motivationLevel: 20,
        signals: { consistency: 20, streak: 1, overdueTasks: 0, stressLevel: 10, resumeCompletion: 10 },
      },
      {
        dateKey: keyDaysAgo(1),
        careerReadiness: 90, intelligenceScore: 90, motivationLevel: 90,
        signals: { consistency: 90, streak: 30, overdueTasks: 20, stressLevel: 90, resumeCompletion: 90 },
      },
    ];

    const profile = await buildStudentProfile('u1');
    expect(profile.trendSummary.length).toBeLessThan(300);
    // Capped at the few largest movements rather than listing all eight.
    expect(profile.trendSummary.split(';').length).toBeLessThanOrEqual(4);
  });

  it('a failing snapshot read costs the trend line, not the profile', async () => {
    const model = require('../models/StudentProfileSnapshot');
    const orig = model.find;
    model.find = () => ({ select: () => ({ sort: () => ({ lean: async () => { throw new Error('atlas down'); } }) }) });

    const profile = await buildStudentProfile('u1');

    expect(profile.trendSummary).toBe('');
    expect(profile.scores).toBeDefined();
    model.find = orig;
  });
});

describe('buildEnrichedContext', () => {
  it('appends the trend segment after the delivery directives', () => {
    const context = buildEnrichedContext(
      { trendSummary: 'Trend over last 14d: consistency down 30% since 2026-08-09 (80→56)' },
      { recommendedTone: 'encouraging', recommendedResponseLength: 'short' }
    );
    expect(context.indexOf('How to respond')).toBeLessThan(context.indexOf('Trend over'));
  });

  it('omits the segment rather than emitting an empty label', () => {
    const context = buildEnrichedContext({ trendSummary: '' }, null);
    expect(context).not.toMatch(/trend/i);
  });
});

describe('Dax is told how to use it', () => {
  it('requires the evidence to be cited alongside a trajectory claim', () => {
    expect(DAX_CORE).toMatch(/cite the evidence/i);
    expect(DAX_CORE).toMatch(/consistency is down 30%/);
  });

  it('forbids inventing a trend when there is no history', () => {
    expect(DAX_CORE).toMatch(/Never invent a trend/i);
    expect(DAX_CORE).toMatch(/no history for this student yet/i);
  });
});
