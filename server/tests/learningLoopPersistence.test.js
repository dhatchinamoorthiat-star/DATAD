/**
 * Phase 2 — learned generator weights survive a process restart.
 *
 * The loop used to keep its overrides in a module-level Map, so every deploy
 * silently reset every student's preferences back to neutral and they had to
 * teach Dax the same lesson again. The restart test below is the whole point of
 * this phase: `jest.resetModules()` gives the module a fresh Map while the
 * fake collection persists, which is exactly the shape of a redeploy.
 *
 * The GeneratorWeight collection is a plain in-memory Map — no database, no
 * sockets — keyed the way its unique index is.
 */

// ── Fake GeneratorWeight collection, surviving module resets ────────────────
const mockRows = new Map(); // `${user}:${generator}` → { user, generator, adjustment }
const key = (u, g) => `${u}:${g}`;

jest.mock('../models/GeneratorWeight', () => ({
  find: (q) => ({
    select: () => ({
      lean: async () => [...mockRows.values()].filter((r) => String(r.user) === String(q.user)),
    }),
  }),
  updateOne: async (filter, update) => {
    const k = key(filter.user, filter.generator);
    mockRows.set(k, { ...(mockRows.get(k) || update.$setOnInsert), ...update.$set });
  },
  deleteOne: async (filter) => { mockRows.delete(key(filter.user, filter.generator)); },
  deleteMany: async (filter) => {
    for (const [k, r] of mockRows) if (String(r.user) === String(filter.user)) mockRows.delete(k);
  },
}));

let mockRecs = [];
jest.mock('../models/Recommendation', () => ({
  find: () => ({ lean: async () => mockRecs }),
}));

const USER = 'u1';

/** Feedback shaped to trip a threshold: `n` dismissals of one generator. */
function dismissals(type, n) {
  return Array.from({ length: n }, () => ({
    type,
    feedback: [{ type: 'not-helpful' }],
    lifecycle: { state: 'active' },
  }));
}
function helpful(type, n) {
  return Array.from({ length: n }, () => ({
    type,
    feedback: [{ type: 'helpful' }],
    lifecycle: { state: 'active' },
  }));
}

/** Re-require the module with a cold cache — a redeploy, in one line. */
function restart() {
  jest.resetModules();
  return require('../ai/recommendation-engine/learningLoop');
}

beforeEach(() => {
  mockRows.clear();
  mockRecs = [];
  jest.resetModules();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('learned weights survive a restart', () => {
  it('a penalty learned before the restart still applies after it', async () => {
    const before = restart();
    mockRecs = dismissals('weak-topic-alert', 3);
    await before.processFeedback(USER);
    expect(before.getGeneratorWeight(USER, 'weak-topic-alert')).toBeCloseTo(0.8);

    // Process dies here. New module instance, empty Map, same collection.
    const after = restart();
    expect(after.getGeneratorWeight(USER, 'weak-topic-alert')).toBe(1.0); // cache cold
    await after.loadUserWeights(USER);
    expect(after.getGeneratorWeight(USER, 'weak-topic-alert')).toBeCloseTo(0.8);
  });

  it('a boost survives too', async () => {
    const before = restart();
    mockRecs = helpful('focus', 5);
    await before.processFeedback(USER);

    const after = restart();
    await after.loadUserWeights(USER);
    expect(after.getGeneratorWeight(USER, 'focus')).toBeCloseTo(1.1);
  });

  it('leaves other users alone', async () => {
    const loop = restart();
    mockRecs = dismissals('focus', 3);
    await loop.processFeedback(USER);

    await loop.loadUserWeights('someone-else');
    expect(loop.getGeneratorWeight('someone-else', 'focus')).toBe(1.0);
  });
});

describe('clamps are preserved', () => {
  it('never pushes a generator below MIN_WEIGHT', async () => {
    const loop = restart();
    // 60 dismissals = 20 penalty steps = -4.0 before clamping.
    mockRecs = dismissals('resume-suggestion', 60);
    await loop.processFeedback(USER);

    const stored = mockRows.get(key(USER, 'resume-suggestion')).adjustment;
    expect(stored).toBeCloseTo(loop.MIN_WEIGHT - 1.0);
    expect(loop.getGeneratorWeight(USER, 'resume-suggestion')).toBeCloseTo(loop.MIN_WEIGHT);
  });

  it('never pushes a generator above MAX_WEIGHT', async () => {
    const loop = restart();
    mockRecs = helpful('focus', 500);
    await loop.processFeedback(USER);

    expect(mockRows.get(key(USER, 'focus')).adjustment).toBeCloseTo(loop.MAX_WEIGHT - 1.0);
    expect(loop.getGeneratorWeight(USER, 'focus')).toBeCloseTo(loop.MAX_WEIGHT);
  });
});

describe('writes go through, not around, the cache', () => {
  it('a new adjustment is readable immediately without a reload', async () => {
    const loop = restart();
    mockRecs = dismissals('deadline-alert', 3);
    await loop.processFeedback(USER);
    expect(loop.getGeneratorWeight(USER, 'deadline-alert')).toBeCloseTo(0.8);
  });

  it('resetGenerator clears both the row and the cached value', async () => {
    const loop = restart();
    mockRecs = dismissals('focus', 3);
    await loop.processFeedback(USER);

    await loop.resetGenerator(USER, 'focus');
    expect(loop.getGeneratorWeight(USER, 'focus')).toBe(1.0);
    expect(mockRows.has(key(USER, 'focus'))).toBe(false);
  });

  it('resetUser clears every row for that user', async () => {
    const loop = restart();
    mockRecs = [...dismissals('focus', 3), ...dismissals('wellness-suggestion', 3)];
    await loop.processFeedback(USER);
    expect(mockRows.size).toBe(2);

    await loop.resetUser(USER);
    expect(mockRows.size).toBe(0);
    expect(loop.getGeneratorWeight(USER, 'focus')).toBe(1.0);
  });
});

describe('degradation', () => {
  it('a failed weights read falls back to default weights rather than throwing', async () => {
    const loop = restart();
    const GeneratorWeight = require('../models/GeneratorWeight');
    const orig = GeneratorWeight.find;
    GeneratorWeight.find = () => ({ select: () => ({ lean: async () => { throw new Error('atlas down'); } }) });

    await expect(loop.loadUserWeights(USER)).resolves.toBeUndefined();
    expect(loop.getGeneratorWeight(USER, 'focus')).toBe(1.0);
    GeneratorWeight.find = orig;
  });
});
