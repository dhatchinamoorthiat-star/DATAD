/**
 * Phase 4 — cohort insights must describe groups and never individuals.
 *
 * The acceptance test is the pair at the top: four members produce nothing at
 * all, five produce aggregates only. Everything after it guards the ways a
 * k-anonymity rule quietly stops holding — a cohort that is large enough on
 * paper but has data for only two people, a split of 7/1 that publishes the 1,
 * or a stored aggregate that outlives the cohort that justified it.
 *
 * All models stubbed — no database, no sockets.
 */

const mockWritten = new Map();      // cohortKey → document
let mockDeleteQuery = null;

jest.mock('../models/CohortInsight', () => ({
  updateOne: async (filter, update) => {
    mockWritten.set(filter.cohortKey, { ...update.$setOnInsert, ...update.$set });
  },
  findOne: (q) => ({ lean: async () => mockWritten.get(q.cohortKey) || null }),
  deleteMany: async (q) => {
    mockDeleteQuery = q;
    let deleted = 0;
    for (const k of [...mockWritten.keys()]) {
      if (!q.cohortKey.$nin.includes(k)) { mockWritten.delete(k); deleted += 1; }
    }
    return { deletedCount: deleted };
  },
}));

let mockIdentities = [];
let mockUsers = [];
let mockOutcomes = [];
let mockSnapshots = [];

const mockLean = (rows) => ({ select: () => mockLean(rows), sort: () => mockLean(rows), lean: async () => rows });

jest.mock('../models/StudentIdentity', () => ({
  find: () => mockLean(mockIdentities),
  findOne: (q) => mockLean(mockIdentities.find((i) => String(i.user) === String(q.user)) || null),
}));
jest.mock('../models/User', () => ({
  find: () => mockLean(mockUsers),
  findById: (id) => mockLean(mockUsers.find((u) => String(u._id) === String(id)) || null),
}));
jest.mock('../models/PlacementOutcome', () => ({ find: () => mockLean(mockOutcomes) }));
let mockSnapshotQuery = null;
jest.mock('../models/StudentProfileSnapshot', () => ({
  find: (q) => {
    mockSnapshotQuery = q;
    return mockLean(
      mockSnapshots.filter(
        (s) => q.user.$in.map(String).includes(String(s.user)) && s.dateKey >= q.dateKey.$gte
      )
    );
  },
}));
jest.mock('../automation/jobRunner', () => ({ runJob: (_n, fn) => fn() }));

const { computeCohortInsights } = require('../automation/intelligence/computeCohortInsights');
const { getCohortInsight, cohortKey, summarizeCohort } = require('../ai/cohort/cohortInsights');
const { COHORT_MIN_MEMBERS, isCohortDimension, isCohortAggregatable } =
  require('../models/profileVisibility');

const BATCH = '2027';
const COLLEGE = 'Test B-School';
const KEY = cohortKey({ batch: BATCH, college: COLLEGE, program: 'mba' });
const today = new Date().toISOString().slice(0, 10);

/** Build a cohort of `n` students, all with a fresh snapshot. */
function cohortOf(n, { convertedCount = 0, readiness = 50 } = {}) {
  mockIdentities = [];
  mockUsers = [];
  mockSnapshots = [];
  mockOutcomes = [];
  for (let i = 0; i < n; i += 1) {
    const id = `u${i}`;
    mockIdentities.push({ user: id, batch: BATCH, college: COLLEGE });
    mockUsers.push({ _id: id, activeProgram: 'mba' });
    mockSnapshots.push({
      user: id,
      dateKey: today,
      careerReadiness: readiness + i,
      signals: { applicationsCount: 10 + i, resumeCompletion: 80, consistency: 60, streak: 5, studyMinutes: 100 },
    });
    if (i < convertedCount) mockOutcomes.push({ user: id, outcome: 'offer_received' });
  }
}

beforeEach(() => {
  mockWritten.clear();
  mockDeleteQuery = null;
  cohortOf(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('k-anonymity — the acceptance case', () => {
  it('a 4-member cohort returns nothing', async () => {
    cohortOf(COHORT_MIN_MEMBERS - 1);
    const res = await computeCohortInsights();

    expect(res.meta).toMatchObject({ written: 0, suppressed: 1 });
    expect(mockWritten.size).toBe(0);
    // And nothing is served for it either.
    expect(await getCohortInsight('u0')).toBeNull();
  });

  it('a 5-member cohort returns aggregates, and only aggregates', async () => {
    cohortOf(COHORT_MIN_MEMBERS);
    await computeCohortInsights();

    const insight = await getCohortInsight('u0');
    expect(insight).not.toBeNull();
    expect(insight.memberCount).toBe(5);
    expect(insight.overall.careerReadiness).toBe(52); // mean of 50..54

    // Nothing re-identifiable anywhere in what is served.
    const serialized = JSON.stringify(insight);
    expect(serialized).not.toMatch(/\bu[0-9]\b/);
    expect(insight.overall).not.toHaveProperty('user');
    expect(insight).not.toHaveProperty('members');
    for (const key of Object.keys(insight.overall)) {
      expect(key === 'members' || isCohortAggregatable(key)).toBe(true);
    }
  });
});

describe('k-anonymity — the ways it stops holding', () => {
  it('suppresses a cohort that is big enough on paper but has data for only two', async () => {
    cohortOf(8);
    mockSnapshots = mockSnapshots.slice(0, 2);
    const res = await computeCohortInsights();
    expect(res.meta).toMatchObject({ written: 0, suppressed: 1 });
  });

  it('ignores snapshots too old to describe the cohort', async () => {
    cohortOf(6);
    for (const s of mockSnapshots) s.dateKey = '2020-01-01';

    const res = await computeCohortInsights();

    // Stale readings are not members: the cohort falls to zero with data and is
    // suppressed rather than reported from history.
    expect(res.meta).toMatchObject({ written: 0, suppressed: 1 });
    const cutoff = new Date(mockSnapshotQuery.dateKey.$gte);
    expect(Math.round((Date.now() - cutoff) / 86400000)).toBe(30);
  });

  it('withholds the converted/unconverted split when one side is a single student', async () => {
    cohortOf(8, { convertedCount: 1 });
    await computeCohortInsights();

    const insight = await getCohortInsight('u0');
    expect(insight.memberCount).toBe(8);
    expect(insight.converted).toBeNull();
    expect(insight.notConverted).toBeNull();
    // The conversion rate is gated on the same rule: "1 of 8" is that student.
    expect(insight.conversionPct).toBeNull();
  });

  it('publishes the split only when both sides clear the minimum', async () => {
    cohortOf(12, { convertedCount: 5 });
    await computeCohortInsights();

    const insight = await getCohortInsight('u0');
    expect(insight.converted.members).toBe(5);
    expect(insight.notConverted.members).toBe(7);
    expect(insight.conversionPct).toBe(42);
  });

  it('deletes a stored aggregate once its cohort falls below the minimum', async () => {
    cohortOf(6);
    await computeCohortInsights();
    expect(mockWritten.has(KEY)).toBe(true);

    cohortOf(3);
    await computeCohortInsights();
    expect(mockWritten.has(KEY)).toBe(false);
    expect(await getCohortInsight('u0')).toBeNull();
    expect(mockDeleteQuery.cohortKey.$nin).not.toContain(KEY);
  });

  it('refuses to serve a stale row that no longer meets the minimum', async () => {
    // A document written under an older rule, read under the current one.
    mockWritten.set(KEY, { batch: BATCH, college: COLLEGE, program: 'mba', memberCount: 2, overall: { members: 2 } });
    cohortOf(2);
    expect(await getCohortInsight('u0')).toBeNull();
  });
});

describe('cohort membership', () => {
  it('places nobody who has not given both batch and college', async () => {
    cohortOf(6);
    mockIdentities[0].college = '';
    expect(await getCohortInsight('u0')).toBeNull();
  });

  it('separates cohorts that share a batch but not a college', async () => {
    cohortOf(6);
    for (let i = 3; i < 6; i += 1) mockIdentities[i].college = 'Another College';
    const res = await computeCohortInsights();
    // Two groups of 3 — neither survives, and they are not merged to reach 5.
    expect(res.meta).toMatchObject({ written: 0, suppressed: 2 });
  });
});

describe('visibility rules', () => {
  it('allows only public dimensions to define a cohort', () => {
    expect(isCohortDimension('batch')).toBe(true);
    expect(isCohortDimension('college')).toBe(true);
    // PRIVATE fields — grouping by these would publish them.
    expect(isCohortDimension('learningStyle')).toBe(false);
    expect(isCohortDimension('difficultSubjects')).toBe(false);
    expect(isCohortDimension('dreamRole')).toBe(false);
  });

  it('refuses to aggregate signals nobody agreed to publish', () => {
    expect(isCohortAggregatable('careerReadiness')).toBe(true);
    expect(isCohortAggregatable('stressLevel')).toBe(false);
    expect(isCohortAggregatable('intelligenceScore')).toBe(false);
  });
});

describe('summarizeCohort', () => {
  it('says nothing when there is no publishable split', async () => {
    cohortOf(8, { convertedCount: 1 });
    await computeCohortInsights();
    expect(await summarizeCohort('u0', { applicationsCount: 1 })).toBe('');
  });

  it('compares the student to converted peers without naming any of them', async () => {
    cohortOf(12, { convertedCount: 5 });
    await computeCohortInsights();

    const line = await summarizeCohort('u0', { applicationsCount: 2 });
    expect(line).toContain('converted');
    expect(line).toContain('applications in');
    expect(line).toMatch(/n=5/);
    expect(line).not.toMatch(/\bu[0-9]\b/);
  });

  it('stays quiet when the student is already in line with their peers', async () => {
    cohortOf(12, { convertedCount: 5 });
    await computeCohortInsights();
    expect(await summarizeCohort('u0', { applicationsCount: 100, careerReadiness: 100 })).toBe('');
  });
});
