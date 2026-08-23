/**
 * Phase 1 — the snapshot job and the trend reads over it.
 *
 * Snapshot history cannot be backfilled, so the failure modes that matter are
 * the ones that silently lose or corrupt a day: a second run duplicating a row,
 * an inactive user being swept in, a zero-data profile flattening a trend, and
 * getDelta doing its arithmetic wrong. Each has a test here.
 *
 * Mongoose and the intelligence layer are stubbed — no database, no sockets.
 */

// ── In-memory stand-in for the StudentProfileSnapshot collection ────────────
// Keyed exactly as the unique index is, so a duplicate write in the code shows
// up here as an overwrite rather than a second row — the same way Mongo would.
const store = new Map();
const key = (user, dateKey) => `${user}:${dateKey}`;

const mockUpdateOne = jest.fn(async (filter, update) => {
  const k = key(filter.user, filter.dateKey);
  const existed = store.has(k);
  store.set(k, {
    ...(store.get(k) || {}),
    ...(existed ? {} : update.$setOnInsert),
    ...update.$set,
  });
  return { upsertedCount: existed ? 0 : 1, matchedCount: existed ? 1 : 0 };
});

let mockFindRows = [];
const mockFind = jest.fn(() => ({
  select: () => ({ sort: () => ({ lean: async () => mockFindRows }) }),
}));

jest.mock('../models/StudentProfileSnapshot', () => ({
  updateOne: (...a) => mockUpdateOne(...a),
  find: (...a) => mockFind(...a),
}));

// ── Users ───────────────────────────────────────────────────────────────────
let mockUserFilter = null;
let mockUsers = [];
jest.mock('../models/User', () => ({
  find: (filter) => {
    mockUserFilter = filter;
    return {
      select: () => ({
        lean: () => ({
          cursor: () => ({
            async *[Symbol.asyncIterator]() {
              for (const u of mockUsers) yield u;
            },
          }),
        }),
      }),
    };
  },
}));

let mockProfiles = {};
jest.mock('../ai/intelligence-layer', () => ({
  buildStudentProfile: async (userId) => mockProfiles[String(userId)],
}));

jest.mock('../automation/jobRunner', () => ({ runJob: (_n, fn) => fn() }));

const { snapshotProfiles, activeUserFilter, buildSignals } =
  require('../automation/intelligence/snapshotProfiles');
const { getDelta, getTrend, summarizeTrends } = require('../ai/intelligence-layer/trends');

function profile(overrides = {}) {
  return {
    scores: {
      currentFocus: 'placement-prep',
      currentChallenges: ['overdue tasks'],
      recommendedTone: 'encouraging',
      recommendedResponseLength: 'short',
      recommendedExamples: ['consulting'],
      urgencyLevel: 70, motivationLevel: 55, confidence: 60,
      learningVelocity: 65, careerReadiness: 40,
      contextQualityScore: 80, intelligenceScore: 62,
      ...(overrides.scores || {}),
    },
    learning: { streak: 9, consistency: 71, studyMinutes: 120 },
    tasks: { pending: 5, overdue: 3 },
    career: { applications: 12, resumeCompletionPct: 88 },
    stress: { stressLevel: 44 },
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  mockUpdateOne.mockClear();
  mockFind.mockClear();
  mockUserFilter = null;
  mockUsers = [];
  mockProfiles = {};
  mockFindRows = [];
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('snapshotProfiles — idempotency', () => {
  it('running twice on the same day leaves exactly one snapshot per user', async () => {
    mockUsers = [{ _id: 'u1' }, { _id: 'u2' }];
    mockProfiles = { u1: profile(), u2: profile() };

    await snapshotProfiles();
    await snapshotProfiles();

    expect(store.size).toBe(2);
    // Both runs wrote; the unique key is what collapsed them, and every write
    // targeted that key rather than creating a new document.
    expect(mockUpdateOne).toHaveBeenCalledTimes(4);
    for (const call of mockUpdateOne.mock.calls) {
      expect(call[2]).toEqual({ upsert: true });
      expect(call[0]).toHaveProperty('dateKey', new Date().toISOString().slice(0, 10));
    }
  });
});

describe('snapshotProfiles — active-user filter', () => {
  it('asks only for approved users seen from a device inside the window', () => {
    const now = new Date('2026-08-23T00:00:00Z');
    const filter = activeUserFilter(now);
    expect(filter.status).toBe('approved');
    const cutoff = filter['sessions.lastSeenAt'].$gte;
    expect(Math.round((now - cutoff) / 86400000)).toBe(14);
  });

  it('the job queries with that filter rather than scanning all users', async () => {
    mockUsers = [];
    await snapshotProfiles();
    expect(mockUserFilter).toHaveProperty('status', 'approved');
    // Bracket access, not toHaveProperty: the key contains a literal dot.
    expect(mockUserFilter['sessions.lastSeenAt']).toBeDefined();
  });
});

describe('snapshotProfiles — skip-empty rule', () => {
  it('writes nothing for a user whose contextQualityScore is 0', async () => {
    mockUsers = [{ _id: 'empty' }, { _id: 'real' }];
    mockProfiles = {
      empty: profile({ scores: { contextQualityScore: 0 } }),
      real: profile(),
    };

    const res = await snapshotProfiles();

    expect(store.has(key('empty', new Date().toISOString().slice(0, 10)))).toBe(false);
    expect(store.size).toBe(1);
    expect(res.meta).toMatchObject({ saved: 1, skipped: 1, failed: 0 });
  });

  it('one user throwing does not abort the run', async () => {
    mockUsers = [{ _id: 'bad' }, { _id: 'good' }];
    mockProfiles = { good: profile() };
    // 'bad' has no entry, so buildStudentProfile resolves undefined and the
    // signal read throws inside snapshotOne.
    mockUpdateOne.mockImplementationOnce(async () => { throw new Error('write failed'); });

    const res = await snapshotProfiles();
    expect(res.meta.failed + res.meta.skipped).toBeGreaterThan(0);
    expect(res.meta.saved + res.meta.skipped + res.meta.failed).toBe(2);
  });
});

describe('buildSignals', () => {
  it('pulls the trendable counters straight off the collectors', () => {
    expect(buildSignals(profile())).toEqual({
      streak: 9, consistency: 71, pendingTasks: 5, overdueTasks: 3,
      applicationsCount: 12, resumeCompletion: 88, stressLevel: 44, studyMinutes: 120,
    });
  });

  it('records a missing counter as null, never as 0', () => {
    // 0 means "measured zero" and would drag a trend down; null means "unknown".
    expect(buildSignals({}).streak).toBeNull();
  });
});

describe('getDelta', () => {
  it('computes start, end, delta and pctChange over the window', async () => {
    mockFindRows = [
      { dateKey: '2026-08-10', careerReadiness: 40 },
      { dateKey: '2026-08-16', careerReadiness: 45 },
      { dateKey: '2026-08-23', careerReadiness: 50 },
    ];
    expect(await getDelta('u1', 'careerReadiness')).toMatchObject({
      start: 40, end: 50, delta: 10, pctChange: 25,
      startDate: '2026-08-10', endDate: '2026-08-23', points: 3,
    });
  });

  it('reports a fall as a negative delta and percentage', async () => {
    mockFindRows = [
      { dateKey: '2026-08-10', signals: { consistency: 80 } },
      { dateKey: '2026-08-23', signals: { consistency: 56 } },
    ];
    expect(await getDelta('u1', 'consistency')).toMatchObject({ delta: -24, pctChange: -30 });
  });

  it('returns null on a single data point — one reading is not a trend', async () => {
    mockFindRows = [{ dateKey: '2026-08-23', careerReadiness: 50 }];
    expect(await getDelta('u1', 'careerReadiness')).toBeNull();
  });

  it('leaves pctChange null when the baseline is 0 rather than emitting Infinity', async () => {
    mockFindRows = [
      { dateKey: '2026-08-10', signals: { streak: 0 } },
      { dateKey: '2026-08-23', signals: { streak: 7 } },
    ];
    const d = await getDelta('u1', 'streak');
    expect(d.delta).toBe(7);
    expect(d.pctChange).toBeNull();
  });

  it('ignores an unknown metric instead of building a bad query', async () => {
    expect(await getTrend('u1', 'notAMetric')).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe('summarizeTrends', () => {
  it('is empty when there is no history, so no prompt invites an invented trend', async () => {
    mockFindRows = [];
    expect(await summarizeTrends('u1')).toBe('');
  });

  it('is empty when nothing moved past its threshold', async () => {
    mockFindRows = [
      { dateKey: '2026-08-10', signals: { consistency: 70 }, careerReadiness: 40 },
      { dateKey: '2026-08-23', signals: { consistency: 72 }, careerReadiness: 41 },
    ];
    expect(await summarizeTrends('u1')).toBe('');
  });

  it('names a notable fall with its magnitude and start date', async () => {
    mockFindRows = [
      { dateKey: '2026-08-09', signals: { consistency: 80 } },
      { dateKey: '2026-08-23', signals: { consistency: 50 } },
    ];
    const s = await summarizeTrends('u1');
    expect(s).toContain('consistency');
    expect(s).toContain('down');
    expect(s).toContain('2026-08-09');
    expect(s).toContain('80→50');
  });
});
