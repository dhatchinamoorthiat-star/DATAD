/**
 * Phase 4, second half — the cohort line reaches the model.
 *
 * computeCohortInsights writes the aggregates and cohortInsights.js reads them,
 * but until buildStudentProfile asks for a summary the whole path is a nightly
 * job feeding a collection nobody opens. This asserts the connection:
 * summarizeCohort's output travels through buildStudentProfile →
 * buildEnrichedContext and arrives in front of the model.
 *
 * The restraint half matters more here than it did for trends, because this is
 * the one segment sourced from other people. A cohort that is unknown, too
 * small, or simply not different enough must produce nothing at all.
 *
 * Privacy of the aggregates themselves is cohortPrivacy.test.js's job; this
 * file only checks that what crosses into the prompt is the summary string and
 * never a roster.
 *
 * No database, no network.
 */

let mockCohortSummary = '';
let mockCohortCalls = [];
jest.mock('../ai/cohort/cohortInsights', () => ({
  summarizeCohort: async (userId, signals) => {
    mockCohortCalls.push({ userId, signals });
    return mockCohortSummary;
  },
}));

// Trends are wired already and tested next door — hold them at '' so anything
// asserted here is attributable to the cohort segment.
jest.mock('../ai/intelligence-layer/trends', () => ({
  summarizeTrends: async () => '',
}));

// The two collectors the cohort comparison actually reads. Spelled out rather
// than generated in a loop: a jest.mock factory is hoisted above the loop
// variable, so it cannot close over one.
let mockCollected = {};
jest.mock('../ai/intelligence-layer/collectors/learningCollector', () => ({
  collect: async () => mockCollected.learning ?? null,
}));
jest.mock('../ai/intelligence-layer/collectors/careerCollector', () => ({
  collect: async () => mockCollected.career ?? null,
}));

// The rest are not under test — hold them at null so every assertion here is
// attributable to the cohort segment.
for (const name of ['identity', 'memory', 'task', 'note', 'planner', 'activity', 'stress']) {
  jest.mock(`../ai/intelligence-layer/collectors/${name}Collector`, () => ({ collect: async () => null }));
}

const { buildStudentProfile } = require('../ai/intelligence-layer');
const { buildEnrichedContext } = require('../ai/intelligence-layer/profileFactory');

beforeEach(() => {
  mockCohortSummary = '';
  mockCohortCalls = [];
  mockCollected = {};
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('cohort injection', () => {
  it('puts the peer comparison into the enriched context the model sees', async () => {
    mockCohortSummary =
      'Peers in your batch who converted (n=7) — applications in: they averaged 12, you are at 3';

    const profile = await buildStudentProfile('u1');

    expect(profile.cohortSummary).toContain('converted');
    expect(profile.enrichedContext).toContain('Peers in your batch');
    expect(profile.enrichedContext).toContain('they averaged 12, you are at 3');
  });

  it('says nothing when there is no publishable cohort', async () => {
    mockCohortSummary = '';
    const profile = await buildStudentProfile('u1');

    expect(profile.cohortSummary).toBe('');
    expect(profile.enrichedContext).not.toMatch(/peers/i);
  });

  it('a failing cohort read costs the peer line, not the profile', async () => {
    const mod = require('../ai/cohort/cohortInsights');
    const orig = mod.summarizeCohort;
    mod.summarizeCohort = async () => { throw new Error('atlas down'); };

    const profile = await buildStudentProfile('u1');

    expect(profile.cohortSummary).toBe('');
    expect(profile.scores).toBeDefined();
    mod.summarizeCohort = orig;
  });
});

describe('what the comparison is measured on', () => {
  it('passes the same signals the nightly job freezes for everyone else', async () => {
    mockCollected = {
      learning: { streak: 4, consistency: 40, studyMinutes: 25 },
      career: { applications: 3, resumeCompletionPct: 55 },
    };

    await buildStudentProfile('u1');

    expect(mockCohortCalls).toHaveLength(1);
    const { signals } = mockCohortCalls[0];
    expect(signals.applicationsCount).toBe(3);
    expect(signals.resumeCompletion).toBe(55);
    expect(signals.consistency).toBe(40);
    expect(signals.streak).toBe(4);
    expect(signals.studyMinutes).toBe(25);
  });

  it('includes careerReadiness, which lives outside the signals bag', async () => {
    await buildStudentProfile('u1');
    expect(mockCohortCalls[0].signals).toHaveProperty('careerReadiness');
    expect(typeof mockCohortCalls[0].signals.careerReadiness).toBe('number');
  });

  it('sends a missing counter as null, never as 0 — an absent resume is not a zero one', async () => {
    mockCollected = { learning: { streak: 4 } };

    await buildStudentProfile('u1');

    expect(mockCohortCalls[0].signals.resumeCompletion).toBeNull();
    expect(mockCohortCalls[0].signals.applicationsCount).toBeNull();
  });
});

describe('buildEnrichedContext', () => {
  it('places the peer segment last, after this student\'s own trajectory', () => {
    const context = buildEnrichedContext(
      {
        trendSummary: 'Trend over last 14d: consistency down 30% since 2026-08-09 (80→56)',
        cohortSummary: 'Peers in your batch who converted (n=7) — applications in: they averaged 12, you are at 3',
      },
      { recommendedTone: 'direct', recommendedResponseLength: 'short' }
    );

    expect(context.indexOf('Trend over')).toBeLessThan(context.indexOf('Peers in your batch'));
  });

  it('omits the segment rather than emitting an empty label', () => {
    const context = buildEnrichedContext({ cohortSummary: '' }, null);
    expect(context).not.toMatch(/peers/i);
  });
});
