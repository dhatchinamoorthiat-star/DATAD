/**
 * Phase 3 — the prediction ledger and its resolver.
 *
 * The feature only has value if it is honest, so the tests are mostly about the
 * ways it could quietly become dishonest: a miss silently not recorded, a
 * missing snapshot resolved by guessing, a re-run flipping an already-settled
 * outcome, or an accuracy figure invented out of an empty ledger.
 *
 * Mongoose is stubbed throughout — no database, no sockets.
 */

// ── Fake DaxPrediction collection ──────────────────────────────────────────
const mockDocs = [];
let mockNextId = 1;

function mockMatches(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    const actual = k === '_id' ? doc._id : doc[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('$lte' in v && !(actual <= v.$lte)) return false;
      if ('$gte' in v && !(actual >= v.$gte)) return false;
      if ('$in' in v && !v.$in.includes(actual)) return false;
      return true;
    }
    return String(actual) === String(v);
  });
}

const mockChain = (rows) => ({
  select: () => mockChain(rows),
  sort: () => mockChain(rows),
  limit: (n) => mockChain(rows.slice(0, n)),
  lean: async () => rows,
});

jest.mock('../models/DaxPrediction', () => ({
  create: async (doc) => {
    const saved = { _id: `p${mockNextId++}`, outcome: 'pending', actualValue: null, resolvedAt: null, ...doc };
    mockDocs.push(saved);
    return saved;
  },
  findOne: (q) => ({ lean: async () => mockDocs.find((d) => mockMatches(d, q)) || null }),
  find: (q) => mockChain(mockDocs.filter((d) => mockMatches(d, q))),
  updateOne: async (q, update) => {
    const doc = mockDocs.find((d) => mockMatches(d, q));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    Object.assign(doc, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  },
}));

// ── Fake StudentProfileSnapshot collection ─────────────────────────────────
let mockSnapshots = [];
jest.mock('../models/StudentProfileSnapshot', () => ({
  find: (q) => ({
    lean: async () => mockSnapshots.filter(
      (s) => String(s.user) === String(q.user)
        && s.dateKey >= q.dateKey.$gte && s.dateKey <= q.dateKey.$lte
    ),
  }),
}));

jest.mock('../automation/jobRunner', () => ({ runJob: (_n, fn) => fn() }));

const ledger = require('../ai/predictions/ledger');
const { resolvePredictions } = require('../automation/intelligence/resolvePredictions');

const USER = 'u1';
const dayMs = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * dayMs);
const keyDaysAgo = (n) => daysAgo(n).toISOString().slice(0, 10);

/** A prediction already past its horizon, ready for the resolver. */
function duePrediction(over = {}) {
  const doc = {
    _id: `p${mockNextId++}`,
    user: USER,
    statement: 'Your placement readiness should reach 60 or better.',
    metric: 'careerReadiness',
    predictedValue: 60,
    comparator: 'gte',
    horizonDays: 14,
    predictedAt: daysAgo(15),
    resolveBy: daysAgo(1),
    resolvedAt: null,
    actualValue: null,
    outcome: 'pending',
    sourceTask: 'test',
    ...over,
  };
  mockDocs.push(doc);
  return doc;
}

beforeEach(() => {
  mockDocs.length = 0;
  mockNextId = 1;
  mockSnapshots = [];
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('recordPrediction', () => {
  const valid = {
    userId: USER, statement: 'Readiness will reach 60.', metric: 'careerReadiness',
    predictedValue: 60, comparator: 'gte', horizonDays: 14, sourceTask: 'weekly-review-readiness',
  };

  it('stores the claim with a resolveBy derived from the horizon', async () => {
    const p = await ledger.recordPrediction(valid);
    expect(p.outcome).toBe('pending');
    const horizonMs = new Date(p.resolveBy) - new Date(p.predictedAt);
    expect(Math.round(horizonMs / dayMs)).toBe(14);
  });

  it('does not re-record while an identical claim is still pending', async () => {
    await ledger.recordPrediction(valid);
    expect(await ledger.recordPrediction(valid)).toBeNull();
    expect(mockDocs).toHaveLength(1);
  });

  it('records again once the earlier claim has been resolved', async () => {
    const first = await ledger.recordPrediction(valid);
    first.outcome = 'miss';
    expect(await ledger.recordPrediction(valid)).not.toBeNull();
  });

  it('rejects a metric no snapshot could ever settle', async () => {
    expect(await ledger.recordPrediction({ ...valid, metric: 'vibes' })).toBeNull();
    expect(mockDocs).toHaveLength(0);
  });

  it('rejects a horizon shorter than the snapshot cadence can judge', async () => {
    expect(await ledger.recordPrediction({ ...valid, horizonDays: 1 })).toBeNull();
  });

  it('rejects an absurdly distant horizon', async () => {
    expect(await ledger.recordPrediction({ ...valid, horizonDays: 4000 })).toBeNull();
  });
});

describe('resolver — hit', () => {
  it('marks a met claim as a hit and records what actually happened', async () => {
    duePrediction();
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), careerReadiness: 72 }];

    const res = await resolvePredictions();

    expect(res.meta).toMatchObject({ hit: 1, miss: 0, unresolvable: 0 });
    expect(mockDocs[0]).toMatchObject({ outcome: 'hit', actualValue: 72 });
    expect(mockDocs[0].resolvedAt).toBeInstanceOf(Date);
  });
});

describe('resolver — miss', () => {
  it('marks a claim reality did not meet as a miss, with the real number', async () => {
    duePrediction();
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), careerReadiness: 41 }];

    const res = await resolvePredictions();

    expect(res.meta).toMatchObject({ hit: 0, miss: 1 });
    expect(mockDocs[0]).toMatchObject({ outcome: 'miss', actualValue: 41 });
  });

  it('a boundary reading counts as a hit for gte, not a miss', async () => {
    duePrediction();
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), careerReadiness: 60 }];
    await resolvePredictions();
    expect(mockDocs[0].outcome).toBe('hit');
  });

  it('honours lte claims — a lower reading is the hit', async () => {
    duePrediction({ metric: 'overdueTasks', comparator: 'lte', predictedValue: 2 });
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), signals: { overdueTasks: 5 } }];
    await resolvePredictions();
    expect(mockDocs[0]).toMatchObject({ outcome: 'miss', actualValue: 5 });
  });
});

describe('resolver — unresolvable', () => {
  it('marks a claim unresolvable when no snapshot sits near the horizon', async () => {
    duePrediction();
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(40), careerReadiness: 90 }];

    const res = await resolvePredictions();

    expect(res.meta).toMatchObject({ unresolvable: 1, hit: 0, miss: 0 });
    // Never guesses: no reading means no actualValue, not a convenient one.
    expect(mockDocs[0]).toMatchObject({ outcome: 'unresolvable', actualValue: null });
  });

  it('treats a snapshot that has no reading for the metric as no evidence', async () => {
    duePrediction();
    // The day was snapshotted, but careerReadiness was never measured.
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), careerReadiness: null }];
    await resolvePredictions();
    expect(mockDocs[0].outcome).toBe('unresolvable');
  });

  it('does not settle a claim against another student’s snapshot', async () => {
    duePrediction();
    mockSnapshots = [{ user: 'someone-else', dateKey: keyDaysAgo(1), careerReadiness: 99 }];
    await resolvePredictions();
    expect(mockDocs[0].outcome).toBe('unresolvable');
  });
});

describe('resolver — idempotency', () => {
  it('re-running does not re-resolve or flip an already-settled outcome', async () => {
    duePrediction();
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), careerReadiness: 41 }];

    await resolvePredictions();
    const firstResolvedAt = mockDocs[0].resolvedAt;

    // Reality has since improved. The settled miss must stay a miss.
    mockSnapshots = [{ user: USER, dateKey: keyDaysAgo(1), careerReadiness: 95 }];
    const second = await resolvePredictions();

    expect(second.itemsProcessed).toBe(0);
    expect(mockDocs[0]).toMatchObject({ outcome: 'miss', actualValue: 41 });
    expect(mockDocs[0].resolvedAt).toBe(firstResolvedAt);
  });

  it('leaves a prediction whose horizon has not arrived alone', async () => {
    duePrediction({ resolveBy: new Date(Date.now() + 5 * dayMs) });
    const res = await resolvePredictions();
    expect(res.itemsProcessed).toBe(0);
    expect(mockDocs[0].outcome).toBe('pending');
  });
});

describe('getAccuracy', () => {
  it('reports misses as plainly as hits', async () => {
    duePrediction({ outcome: 'hit', resolvedAt: daysAgo(1) });
    duePrediction({ outcome: 'miss', resolvedAt: daysAgo(2) });
    duePrediction({ outcome: 'miss', resolvedAt: daysAgo(3) });

    const record = await ledger.getAccuracy(USER);

    expect(record).toMatchObject({ total: 3, hits: 1, misses: 2, resolved: 3, accuracy: 33 });
    // Every resolved prediction is in the visible list — nothing filters the
    // misses out of what the student sees.
    expect(record.recent).toHaveLength(3);
    expect(record.recent.filter((p) => p.outcome === 'miss')).toHaveLength(2);
  });

  it('excludes pending and unresolvable claims from the accuracy figure', async () => {
    duePrediction({ outcome: 'hit', resolvedAt: daysAgo(1) });
    duePrediction({ outcome: 'pending' });
    duePrediction({ outcome: 'unresolvable', resolvedAt: daysAgo(1) });

    const record = await ledger.getAccuracy(USER);
    expect(record).toMatchObject({ resolved: 1, accuracy: 100, pending: 1, unresolvable: 1 });
  });

  it('reports no accuracy at all rather than a flattering zero or hundred', async () => {
    const record = await ledger.getAccuracy(USER);
    expect(record.accuracy).toBeNull();
    expect(record.total).toBe(0);
  });
});
