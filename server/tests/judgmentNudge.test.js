/**
 * Phase 5 — the judgement nudge fires rarely, and only when it has grounds.
 *
 * Most of these tests assert that nothing was sent. That is the point: a nudge
 * that fires whenever it *could* is spam, the student mutes Dax, and the one
 * genuinely urgent nudge months later never gets seen. So each condition is
 * tested for its ability to hold the nudge back, and the cooldown is tested
 * independently of them.
 *
 * The notifier is stubbed — a regression that starts sending must fail here
 * rather than reach anyone's notification tray.
 */

const mockNotify = jest.fn(async () => {});
jest.mock('../controllers/notificationController', () => ({ notify: (...a) => mockNotify(...a) }));

let mockPlacementDate = null;
jest.mock('../models/SiteMeta', () => ({
  findOne: () => ({ select: () => ({ lean: async () => ({ placementDate: mockPlacementDate }) }) }),
}));

let mockCandidates = [];
let mockTrendRows = [];
let mockSnapshotQuery = null;
jest.mock('../models/StudentProfileSnapshot', () => ({
  find: (q) => {
    // The candidate query and the trend query hit the same collection; the
    // trend read is the one keyed by a single user.
    if (q.user && !q.user.$in) {
      return { select: () => ({ sort: () => ({ lean: async () => mockTrendRows }) }) };
    }
    mockSnapshotQuery = q;
    return {
      select: () => ({
        lean: async () => mockCandidates.filter(
          (c) => c.signals.overdueTasks >= q['signals.overdueTasks'].$gte && c.dateKey >= q.dateKey.$gte
        ),
      }),
    };
  },
}));

let mockRecentNudges = [];
jest.mock('../models/Notification', () => ({
  findOne: (q) => ({
    select: () => ({
      lean: async () => mockRecentNudges.find((n) => String(n.user) === String(q.user)) || null,
    }),
  }),
}));

jest.mock('../automation/jobRunner', () => ({ runJob: (_n, fn) => fn() }));

const {
  sendJudgmentNudges, NUDGE_TITLE_PREFIX, MIN_OVERDUE_TASKS, PLACEMENT_WINDOW_DAYS,
} = require('../automation/intelligence/sendJudgmentNudges');

const dayMs = 24 * 60 * 60 * 1000;
const today = new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * dayMs);
const keyDaysAgo = (n) => new Date(Date.now() - n * dayMs).toISOString().slice(0, 10);

/** The full set of grounds: near the drive, overdue work, falling consistency. */
function groundsForNudge() {
  mockPlacementDate = inDays(6);
  mockCandidates = [{ user: 'u1', dateKey: today, signals: { overdueTasks: 4 } }];
  mockTrendRows = [
    { dateKey: keyDaysAgo(13), signals: { consistency: 75 } },
    { dateKey: keyDaysAgo(1), signals: { consistency: 40 } },
  ];
  mockRecentNudges = [];
}

beforeEach(() => {
  mockNotify.mockClear();
  groundsForNudge();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('when all three conditions hold', () => {
  it('sends exactly one nudge, and it cites its evidence', async () => {
    const res = await sendJudgmentNudges();

    expect(res.meta).toMatchObject({ candidates: 1, sent: 1 });
    expect(mockNotify).toHaveBeenCalledTimes(1);

    const sent = mockNotify.mock.calls[0][0];
    expect(sent).toMatchObject({ user: 'u1', type: 'suggestion', title: NUDGE_TITLE_PREFIX, link: '/planner' });
    // Specific, or it is not judgement: the numbers behind the claim are in it.
    expect(sent.body).toContain('6 days');
    expect(sent.body).toContain('4 overdue');
    expect(sent.body).toContain('35 points');
    // And it offers to do something, rather than only pointing.
    expect(sent.body).toMatch(/replan/i);
  });

  it('carries a 24h dedup window so overlapping runs cannot double-send', async () => {
    await sendJudgmentNudges();
    expect(mockNotify.mock.calls[0][0].dedupWindowMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe('each condition can hold the nudge back on its own', () => {
  it('stays silent when the drive is beyond the window', async () => {
    mockPlacementDate = inDays(PLACEMENT_WINDOW_DAYS + 10);
    const res = await sendJudgmentNudges();
    expect(res.meta.reason).toBe('outside-window');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('stays silent when the drive has already passed', async () => {
    mockPlacementDate = inDays(-3);
    await sendJudgmentNudges();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('stays silent when no placement date is configured at all', async () => {
    mockPlacementDate = null;
    const res = await sendJudgmentNudges();
    expect(res.meta.reason).toBe('no-placement-date');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not treat a couple of overdue tasks as a pattern', async () => {
    mockCandidates = [{ user: 'u1', dateKey: today, signals: { overdueTasks: MIN_OVERDUE_TASKS - 1 } }];
    await sendJudgmentNudges();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('stays silent when consistency is steady', async () => {
    mockTrendRows = [
      { dateKey: keyDaysAgo(13), signals: { consistency: 70 } },
      { dateKey: keyDaysAgo(1), signals: { consistency: 68 } },
    ];
    const res = await sendJudgmentNudges();
    expect(res.meta).toMatchObject({ sent: 0, skippedTrend: 1 });
  });

  it('stays silent when consistency is actually improving', async () => {
    mockTrendRows = [
      { dateKey: keyDaysAgo(13), signals: { consistency: 40 } },
      { dateKey: keyDaysAgo(1), signals: { consistency: 80 } },
    ];
    await sendJudgmentNudges();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('will not claim a falling trend for a student with no history', async () => {
    // One reading is not a trend, and the nudge quotes the number it claims.
    mockTrendRows = [{ dateKey: today, signals: { consistency: 20 } }];
    const res = await sendJudgmentNudges();
    expect(res.meta).toMatchObject({ sent: 0, skippedTrend: 1 });
  });

  it('ignores a stale snapshot that no longer describes the student', async () => {
    mockCandidates = [{ user: 'u1', dateKey: keyDaysAgo(9), signals: { overdueTasks: 9 } }];
    await sendJudgmentNudges();
    expect(mockNotify).not.toHaveBeenCalled();
    const cutoff = new Date(mockSnapshotQuery.dateKey.$gte);
    expect(Math.round((Date.now() - cutoff) / dayMs)).toBe(2);
  });
});

describe('the hard cap', () => {
  it('sends nothing to a student already nudged within the day', async () => {
    mockRecentNudges = [{ user: 'u1' }];
    const res = await sendJudgmentNudges();

    expect(res.meta).toMatchObject({ candidates: 1, sent: 0, skippedCooldown: 1 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('nudges a student at most once even when two days of snapshots qualify', async () => {
    mockCandidates = [
      { user: 'u1', dateKey: today, signals: { overdueTasks: 4 } },
      { user: 'u1', dateKey: keyDaysAgo(1), signals: { overdueTasks: 5 } },
    ];
    const res = await sendJudgmentNudges();
    expect(res.meta.candidates).toBe(1);
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });
});

describe('robustness', () => {
  it('one student failing does not cost the others their nudge', async () => {
    mockCandidates = [
      { user: 'u1', dateKey: today, signals: { overdueTasks: 4 } },
      { user: 'u2', dateKey: today, signals: { overdueTasks: 4 } },
    ];
    mockNotify.mockImplementationOnce(async () => { throw new Error('notify down'); });

    const res = await sendJudgmentNudges();
    expect(res.meta).toMatchObject({ sent: 1, failed: 1 });
  });
});
