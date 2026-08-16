/**
 * Talent Exchange lifecycle — the core service guarantees that need a database.
 *
 * Follows the repo's conversations.test.js pattern: uses the configured
 * MONGODB_URI with throwaway user ids, cleans up after itself, and skips
 * entirely when no database is configured (so CI without a DB stays green).
 *
 * Pins the properties that authorization and integrity depend on:
 *   - you cannot apply to your own opportunity, nor apply twice
 *   - only the owner accepts; accepting mints an engagement with an immutable
 *     terms snapshot
 *   - only the helper starts/submits, only the requester completes
 *   - a review requires a completed engagement and cannot be duplicated
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const HAS_DB = Boolean(process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

const opportunityService = require('../services/talent/opportunityService');
const applicationService = require('../services/talent/applicationService');
const engagementService = require('../services/talent/engagementService');
const reviewService = require('../services/talent/reviewService');

let Opportunity, Application, Engagement, TalentReview;
const created = { opps: [], apps: [], engs: [], reviews: [] };

const owner = { userId: null, program: { id: 'general' } };
const helper = { userId: null, program: { id: 'general' } };

function viewer(id) { return { userId: id, program: { id: 'general' } }; }

beforeAll(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(process.env.MONGODB_URI);
  Opportunity = require('../models/Opportunity');
  Application = require('../models/Application');
  Engagement = require('../models/Engagement');
  TalentReview = require('../models/TalentReview');
  owner.userId = new mongoose.Types.ObjectId();
  helper.userId = new mongoose.Types.ObjectId();
});

afterAll(async () => {
  if (!HAS_DB) return;
  await Promise.all([
    Opportunity.deleteMany({ user: { $in: [owner.userId, helper.userId] } }),
    Application.deleteMany({ applicant: { $in: [owner.userId, helper.userId] } }),
    Engagement.deleteMany({ $or: [{ requester: owner.userId }, { helper: helper.userId }] }),
    TalentReview.deleteMany({ rater: { $in: [owner.userId, helper.userId] } }),
  ]);
  await mongoose.disconnect();
});

d('opportunity → application → engagement → review', () => {
  let opp; let app; let eng;

  test('owner creates and publishes an opportunity', async () => {
    opp = await opportunityService.create(owner.userId, owner, {
      kind: 'need_help',
      category: 'coding_help',
      title: 'Help me debug a React hook',
      description: 'useEffect firing twice, need a second pair of eyes.',
      skills: ['React', 'JavaScript'],
      priceCredits: 40,
    });
    created.opps.push(opp._id);
    expect(opp.status).toBe('draft');
    await opportunityService.publish(owner.userId, opp._id);
    const fresh = await Opportunity.findById(opp._id);
    expect(fresh.status).toBe('open');
    // skills are normalised to lowercase for match stability
    expect(fresh.skills).toEqual(['react', 'javascript']);
  });

  test('owner cannot apply to their own opportunity', async () => {
    await expect(applicationService.apply(owner, opp._id, {})).rejects.toMatchObject({ statusCode: 403 });
  });

  test('helper applies once; a second apply is a 409', async () => {
    app = await applicationService.apply(helper, opp._id, { pitch: 'I do this daily.' });
    created.apps.push(app._id);
    expect(app.status).toBe('pending');
    await expect(applicationService.apply(helper, opp._id, {})).rejects.toMatchObject({ statusCode: 409 });
  });

  test('a stranger cannot accept the application', async () => {
    const stranger = new mongoose.Types.ObjectId();
    await expect(applicationService.accept(stranger, app._id, {})).rejects.toMatchObject({ statusCode: 403 });
  });

  test('owner accepts → engagement with immutable snapshot', async () => {
    const result = await applicationService.accept(owner.userId, app._id, {});
    eng = result.engagement;
    created.engs.push(eng._id);
    expect(eng.status).toBe('accepted');
    expect(eng.snapshot.title).toBe('Help me debug a React hook');
    expect(eng.snapshot.priceCredits).toBe(40);

    // snapshot is immutable even against a direct write
    eng.snapshot.priceCredits = 999;
    await eng.save();
    const fresh = await Engagement.findById(eng._id);
    expect(fresh.snapshot.priceCredits).toBe(40);

    // opportunity advanced to matched (single slot filled)
    const opFresh = await Opportunity.findById(opp._id);
    expect(opFresh.status).toBe('matched');
    expect(opFresh.slotsFilled).toBe(1);
  });

  test('only the helper starts and submits; only the requester completes', async () => {
    await expect(engagementService.start(owner.userId, eng._id)).rejects.toMatchObject({ statusCode: 403 });
    await engagementService.start(helper.userId, eng._id);
    await engagementService.submit(helper.userId, eng._id, { deliverables: [{ label: 'PR', url: 'http://x' }] });

    await expect(engagementService.complete(helper.userId, eng._id)).rejects.toMatchObject({ statusCode: 403 });
    const done = await engagementService.complete(owner.userId, eng._id);
    expect(done.status).toBe('completed');
  });

  test('review requires a completed engagement and cannot be duplicated', async () => {
    const review = await reviewService.create(owner.userId, eng._id, { rating: 5, comment: 'Great help' });
    created.reviews.push(review._id);
    expect(review.ratee.toString()).toBe(helper.userId.toString()); // ratee derived, not supplied
    expect(review.role).toBe('as_requester');
    await expect(reviewService.create(owner.userId, eng._id, { rating: 4 })).rejects.toMatchObject({ statusCode: 409 });
  });
});
