/**
 * The program-approval decision handlers.
 *
 * These endpoints had no UI until now, which is why the null-requester crash
 * below stayed latent — nothing could reach the route to trigger it. Approving
 * writes to two documents in sequence: the approval, then the requester. The
 * second write assumed the requester still existed, so a student who deleted
 * their account between signing up and being reviewed left the approval already
 * saved as approved, the admin holding a 500, and the data sync never queued.
 *
 * Models are mocked rather than driven against a real database, following
 * cohortPrivacy.test.js and the other model-mocking suites here. What is under
 * test is control flow — which branch runs when the requester is missing — and
 * a fake collection expresses that with no cluster involved. runProgramSync is
 * mocked because the route fires it without awaiting; the sync itself is not
 * what these assertions are about.
 */

const mockApprovals = new Map();
const mockUsers = new Map();

const asDoc = (obj, store) => ({
  ...obj,
  save: async function save() { store.set(String(this._id), this); return this; },
});

jest.mock('../models/ProgramApproval', () => ({
  findById: async (id) => mockApprovals.get(String(id)) || null,
}));

jest.mock('../models/User', () => ({
  findById: (id) => {
    const found = mockUsers.get(String(id)) || null;
    // The route calls User.findById(...) directly and awaits it; other call
    // sites in adminRoutes chain .select().lean(), so both shapes are offered.
    const thenable = Promise.resolve(found);
    thenable.select = () => ({ lean: async () => found });
    return thenable;
  },
}));

const mockRunProgramSync = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/programSyncService', () => ({
  runProgramSync: (...a) => mockRunProgramSync(...a),
}));

const ProgramApproval = require('../models/ProgramApproval');
const adminRoutes = require('../routes/adminRoutes');

const ADMIN_ID = 'admin-1';

/** Pull one handler off the mounted router by method and path. */
function handlerFor(method, path) {
  const layer = adminRoutes.stack.find(
    (l) => l.route?.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`no ${method.toUpperCase()} ${path} on adminRoutes`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.payload = b; return res; };
  return res;
}

async function run(handler, req) {
  const res = mockRes();
  let nextErr;
  await handler(req, res, (e) => { nextErr = e; });
  if (nextErr) throw nextErr;
  return res;
}

function seedApproval(overrides = {}) {
  const id = `appr-${mockApprovals.size + 1}`;
  const doc = asDoc({
    _id: id,
    programId: 'test-program',
    programLabel: 'Test Program',
    programType: 'custom',
    requestedBy: 'user-1',
    status: 'pending',
    syncStatus: 'pending',
    syncLog: [],
    ...overrides,
  }, mockApprovals);
  mockApprovals.set(id, doc);
  return doc;
}

beforeEach(() => {
  mockApprovals.clear();
  mockUsers.clear();
  mockRunProgramSync.mockClear();
});

describe('approve', () => {
  const approve = () => handlerFor('post', '/programs/:approvalId/approve');

  test('approves the program and admits the requester', async () => {
    mockUsers.set('user-1', asDoc({ _id: 'user-1', status: 'pending' }, mockUsers));
    const approval = seedApproval();

    const res = await run(approve(), { params: { approvalId: approval._id }, user: { userId: ADMIN_ID } });

    expect(res.statusCode).toBe(200);
    expect(mockApprovals.get(approval._id).status).toBe('approved');
    expect(mockUsers.get('user-1').status).toBe('approved');
    expect(mockRunProgramSync).toHaveBeenCalledWith(approval._id);
  });

  test('still approves when the requester no longer exists', async () => {
    // No user seeded: the account was deleted after signup.
    const approval = seedApproval({ requestedBy: 'ghost' });

    const res = await run(approve(), { params: { approvalId: approval._id }, user: { userId: ADMIN_ID } });

    // Previously a TypeError on null.status — a 500, with the approval already
    // flipped to approved and the sync never queued.
    expect(res.statusCode).toBe(200);
    const fresh = mockApprovals.get(approval._id);
    expect(fresh.status).toBe('approved');
    expect(fresh.approvedBy).toBe(ADMIN_ID);
    expect(mockRunProgramSync).toHaveBeenCalledWith(approval._id);
  });

  test('a decided approval cannot be approved twice', async () => {
    const approval = seedApproval({ status: 'approved' });

    const res = await run(approve(), { params: { approvalId: approval._id }, user: { userId: ADMIN_ID } });

    expect(res.statusCode).toBe(400);
    expect(mockRunProgramSync).not.toHaveBeenCalled();
  });

  test('a missing approval is a 404, not a crash', async () => {
    const res = await run(approve(), { params: { approvalId: 'nope' }, user: { userId: ADMIN_ID } });
    expect(res.statusCode).toBe(404);
    expect(mockRunProgramSync).not.toHaveBeenCalled();
  });
});

describe('reject', () => {
  const reject = () => handlerFor('post', '/programs/:approvalId/reject');

  test('records the reason and the deciding admin', async () => {
    const approval = seedApproval();

    const res = await run(reject(), {
      params: { approvalId: approval._id },
      body: { reason: 'Folded into the existing Design program' },
      user: { userId: ADMIN_ID },
    });

    expect(res.statusCode).toBe(200);
    const fresh = mockApprovals.get(approval._id);
    expect(fresh.status).toBe('rejected');
    expect(fresh.rejectionReason).toBe('Folded into the existing Design program');
    expect(fresh.approvedBy).toBe(ADMIN_ID);
    expect(mockRunProgramSync).not.toHaveBeenCalled();
  });

  test('a missing reason is recorded rather than left null', async () => {
    const approval = seedApproval();
    await run(reject(), { params: { approvalId: approval._id }, body: {}, user: { userId: ADMIN_ID } });
    expect(mockApprovals.get(approval._id).rejectionReason).toBe('Not specified');
  });
});

void ProgramApproval;
