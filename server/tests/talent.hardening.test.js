/**
 * Phase 2.1 hardening regressions (audit C1/H1/H2/H3).
 *
 * DB-gated like the rest of the suite: uses MONGODB_URI, throwaway ids, cleans
 * up, skips with no DB. Concurrency is exercised with Promise.allSettled over
 * genuinely concurrent service calls; exactly-once is verified by counting the
 * BusEvent rows the emits produce (no worker runs in tests, so they persist).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const HAS_DB = Boolean(process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

const opportunityService = require('../services/talent/opportunityService');
const applicationService = require('../services/talent/applicationService');
const engagementService = require('../services/talent/engagementService');

let Opportunity, Application, Engagement, BusEvent;
const allUsers = [];

function user() { const id = new mongoose.Types.ObjectId(); allUsers.push(id); return { userId: id, program: { id: 'general' } }; }
async function txnSupported() {
  const s = await mongoose.startSession();
  try { await s.withTransaction(async () => { await Engagement.findOne({}).session(s); }); return true; }
  catch { return false; } finally { s.endSession(); }
}
async function freshOpen(owner, over = {}) {
  const opp = await opportunityService.create(owner.userId, owner, {
    kind: 'need_help', category: 'coding_help', title: 'T', description: 'D', priceCredits: 10, ...over,
  });
  await opportunityService.publish(owner.userId, opp._id);
  return opp;
}

beforeAll(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(process.env.MONGODB_URI);
  Opportunity = require('../models/Opportunity');
  Application = require('../models/Application');
  Engagement = require('../models/Engagement');
  BusEvent = require('../models/BusEvent');
  await Engagement.syncIndexes(); // ensure the new unique application index exists
});

afterAll(async () => {
  if (!HAS_DB) return;
  await Promise.all([
    Opportunity.deleteMany({ user: { $in: allUsers } }),
    Application.deleteMany({ applicant: { $in: allUsers } }),
    Engagement.deleteMany({ $or: [{ requester: { $in: allUsers } }, { helper: { $in: allUsers } }] }),
    BusEvent.deleteMany({ userId: { $in: allUsers } }),
  ]);
  await mongoose.disconnect();
});

d('C1 — concurrent accept cannot double-book', () => {
  test('same application accepted twice concurrently → one engagement, one event', async () => {
    const owner = user(); const helper = user();
    const opp = await freshOpen(owner);
    const app = await applicationService.apply(helper, opp._id, {});

    const results = await Promise.allSettled([
      applicationService.accept(owner.userId, app._id, {}),
      applicationService.accept(owner.userId, app._id, {}),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);

    const engCount = await Engagement.countDocuments({ application: app._id });
    expect(engCount).toBe(1);
    const events = await BusEvent.countDocuments({ type: 'application.accepted', 'data.applicationId': app._id });
    expect(events).toBe(1); // exactly-once
  });

  test('two applicants, one slot, accepted concurrently → no oversubscription', async () => {
    const owner = user(); const h1 = user(); const h2 = user();
    const opp = await freshOpen(owner, { slotsTotal: 1 });
    const a1 = await applicationService.apply(h1, opp._id, {});
    const a2 = await applicationService.apply(h2, opp._id, {});

    const results = await Promise.allSettled([
      applicationService.accept(owner.userId, a1._id, {}),
      applicationService.accept(owner.userId, a2._id, {}),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const fresh = await Opportunity.findById(opp._id);
    expect(fresh.slotsFilled).toBe(1);
    expect(fresh.status).toBe('matched');
    expect(await Engagement.countDocuments({ opportunity: opp._id })).toBe(1);
  });
});

d('H1 — concurrent complete emits exactly one event', () => {
  test('double complete → one success, one completed doc, one event', async () => {
    const owner = user(); const helper = user();
    const opp = await freshOpen(owner);
    const app = await applicationService.apply(helper, opp._id, {});
    const { engagement } = await applicationService.accept(owner.userId, app._id, {});
    await engagementService.start(helper.userId, engagement._id);
    await engagementService.submit(helper.userId, engagement._id, {});

    const results = await Promise.allSettled([
      engagementService.complete(owner.userId, engagement._id),
      engagementService.complete(owner.userId, engagement._id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const fresh = await Engagement.findById(engagement._id);
    expect(fresh.status).toBe('completed');
    const events = await BusEvent.countDocuments({ type: 'engagement.completed', 'data.engagementId': engagement._id });
    expect(events).toBe(1);
  });
});

d('H3 — cannot apply to an opportunity you cannot view', () => {
  test('private opportunity → 403 for a non-owner', async () => {
    const owner = user(); const outsider = user();
    const opp = await freshOpen(owner, { visibility: 'private' });
    await expect(applicationService.apply(outsider, opp._id, {})).rejects.toMatchObject({ statusCode: 403 });
    expect(await Application.countDocuments({ opportunity: opp._id })).toBe(0);
  });

  test('program-scoped opportunity → 403 for a different program', async () => {
    const owner = { userId: new mongoose.Types.ObjectId(), program: { id: 'mba' } };
    allUsers.push(owner.userId);
    const opp = await freshOpen(owner, { visibility: 'program' });
    const otherProgram = user(); // program 'general'
    await expect(applicationService.apply(otherProgram, opp._id, {})).rejects.toMatchObject({ statusCode: 403 });
  });
});

d('H2 — accept is transactional (replica-set environments)', () => {
  test('rollback when engagement creation fails leaves no partial writes', async () => {
    if (!(await txnSupported())) return; // documented degradation: standalone mongod cannot roll back
    const owner = user(); const helper = user();
    const opp = await freshOpen(owner);
    const app = await applicationService.apply(helper, opp._id, {});

    const spy = jest.spyOn(engagementService, 'create').mockRejectedValueOnce(new Error('boom'));
    await expect(applicationService.accept(owner.userId, app._id, {})).rejects.toThrow('boom');
    spy.mockRestore();

    const freshApp = await Application.findById(app._id);
    const freshOpp = await Opportunity.findById(opp._id);
    expect(freshApp.status).toBe('pending');   // application claim rolled back
    expect(freshOpp.slotsFilled).toBe(0);       // slot claim rolled back
    expect(await Engagement.countDocuments({ application: app._id })).toBe(0);
    // and a real accept still works afterwards
    const { engagement } = await applicationService.accept(owner.userId, app._id, {});
    expect(engagement.status).toBe('accepted');
  });
});
