/**
 * ApplicationService — a helper's interest in an opportunity, and the accept /
 * reject flow the opportunity owner drives. Accepting is what mints an
 * Engagement (via engagementService.create), so the two services are ordered
 * one-way (application → engagement) with no cycle.
 *
 * Hardening (Phase 2.1):
 *   - apply() enforces the SAME visibility policy as getById (audit H3).
 *   - accept() is a single transaction with compare-and-swap claims on both the
 *     application status and the opportunity slot, so double-accept and slot
 *     oversubscription are impossible; the unique index on Engagement.application
 *     is the final backstop against a duplicate engagement (audit C1 + H2).
 *   - withdraw()/reject() are atomic status swaps that emit only on success (H1).
 */

const Application = require('../../models/Application');
const Opportunity = require('../../models/Opportunity');
const engagementService = require('./engagementService');
const opportunityService = require('./opportunityService');
const { badRequest, forbidden, notFound, conflict } = require('./errors');
const transitions = require('./transitions');
const { withTransaction } = require('./tx');
const { EVENTS, emit } = require('./events');

/** A helper applies to an opportunity they are allowed to see (H3). */
async function apply(viewer, opportunityId, { pitch, proposedCredits } = {}) {
  const userId = viewer.userId;
  const opp = await Opportunity.findOne({ _id: opportunityId, deletedAt: null });
  if (!opp) throw notFound('Opportunity not found');
  // Same gate as getById: no visibility ⇒ no apply. Closes the IDOR where a
  // private/foreign-program id could be applied to.
  if (!opportunityService.canView(opp, viewer)) throw forbidden('You cannot apply to this opportunity');
  if (opp.status !== 'open') throw badRequest('This opportunity is not open for applications');
  if (opp.user.equals(userId)) throw forbidden('You cannot apply to your own opportunity');

  const existing = await Application.findOne({ opportunity: opp._id, applicant: userId });
  if (existing) throw conflict('You have already applied to this opportunity');

  let app;
  try {
    app = await Application.create({
      opportunity: opp._id,
      applicant: userId,
      pitch: pitch ? String(pitch).slice(0, 2000) : undefined,
      proposedCredits: typeof proposedCredits === 'number' ? proposedCredits : undefined,
      status: 'pending',
    });
  } catch (err) {
    if (err.code === 11000) throw conflict('You have already applied to this opportunity');
    throw err;
  }

  emit(EVENTS.APPLICATION_SUBMITTED, userId, {
    applicationId: app._id,
    opportunityId: opp._id,
    opportunityOwner: opp.user,
  });
  return app;
}

async function loadOwnApplication(userId, id) {
  const app = await Application.findById(id);
  if (!app) throw notFound('Application not found');
  if (!app.applicant.equals(userId)) throw forbidden('This is not your application');
  return app;
}

/** Applicant withdraws — atomic swap, event only on success (H1). */
async function withdraw(userId, id) {
  const app = await loadOwnApplication(userId, id);
  transitions.assertApplication(app.status, 'withdrawn');
  const updated = await Application.findOneAndUpdate(
    { _id: id, applicant: userId, status: { $in: ['pending', 'shortlisted'] } },
    { $set: { status: 'withdrawn' } },
    { new: true }
  );
  if (!updated) throw conflict('This application was already handled');
  emit(EVENTS.APPLICATION_WITHDRAWN, userId, { applicationId: updated._id, opportunityId: updated.opportunity });
  return updated;
}

/** Owner-side ownership check for an application's opportunity. */
async function assertOwnsApplicationOpportunity(userId, app) {
  const opp = await Opportunity.findOne({ _id: app.opportunity, deletedAt: null });
  if (!opp) throw notFound('Opportunity not found');
  if (!opp.user.equals(userId)) throw forbidden('You do not own this opportunity');
  return opp;
}

/**
 * Owner accepts an application → creates an Engagement and advances the
 * opportunity's slot bookkeeping. Fully atomic (audit C1 + H2):
 *   1. Claim a slot: $inc guarded by slotsFilled < slotsTotal and open/matched.
 *   2. Claim the application: pending/shortlisted → accepted.
 *   3. Create the engagement (unique index blocks a duplicate).
 *   4. Flip opportunity to 'matched' once full.
 * All in one transaction; the event is emitted only after commit.
 */
async function accept(userId, id, { dueAt } = {}) {
  const pre = await Application.findById(id);
  if (!pre) throw notFound('Application not found');
  await assertOwnsApplicationOpportunity(userId, pre); // 403/404 before any write
  transitions.assertApplication(pre.status, 'accepted'); // friendly early check

  const out = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // 1. Atomic slot claim — fails if closed or already full.
    const opp = await Opportunity.findOneAndUpdate(
      {
        _id: pre.opportunity,
        deletedAt: null,
        status: { $in: ['open', 'matched'] },
        $expr: { $lt: ['$slotsFilled', '$slotsTotal'] },
      },
      { $inc: { slotsFilled: 1 } },
      { new: true, ...opts }
    );
    if (!opp) throw badRequest('This opportunity is no longer accepting helpers');

    // 2. Atomic application claim — only one accept can win.
    const app = await Application.findOneAndUpdate(
      { _id: id, status: { $in: ['pending', 'shortlisted'] } },
      { $set: { status: 'accepted' } },
      { new: true, ...opts }
    );
    if (!app) throw conflict('This application was already handled');

    // 3. Create the engagement inside the same transaction.
    const engagement = await engagementService.create({ opportunity: opp, application: app, dueAt: dueAt || null, session });

    // 4. Mark matched once every slot is filled.
    if (opp.slotsFilled >= opp.slotsTotal && opp.status !== 'matched') {
      await Opportunity.updateOne({ _id: opp._id }, { $set: { status: 'matched' } }, opts);
    }

    return { application: app, engagement };
  });

  // Emitted exactly once, only after the transaction committed.
  emit(EVENTS.APPLICATION_ACCEPTED, userId, {
    applicationId: out.application._id,
    opportunityId: pre.opportunity,
    engagementId: out.engagement._id,
    helper: out.application.applicant,
  });
  return out;
}

/** Owner rejects an application — atomic swap, event only on success (H1). */
async function reject(userId, id) {
  const app = await Application.findById(id);
  if (!app) throw notFound('Application not found');
  await assertOwnsApplicationOpportunity(userId, app);
  transitions.assertApplication(app.status, 'declined');
  const updated = await Application.findOneAndUpdate(
    { _id: id, status: { $in: ['pending', 'shortlisted'] } },
    { $set: { status: 'declined' } },
    { new: true }
  );
  if (!updated) throw conflict('This application was already handled');
  emit(EVENTS.APPLICATION_REJECTED, userId, {
    applicationId: updated._id,
    opportunityId: updated.opportunity,
    applicant: updated.applicant,
  });
  return updated;
}

/** Owner lists applicants to their opportunity. */
async function listForOpportunity(userId, opportunityId) {
  const opp = await Opportunity.findOne({ _id: opportunityId, deletedAt: null });
  if (!opp) throw notFound('Opportunity not found');
  if (!opp.user.equals(userId)) throw forbidden('You do not own this opportunity');
  return Application.find({ opportunity: opp._id })
    .populate('applicant', 'name avatarUrl')
    .sort({ matchScore: -1, createdAt: -1 })
    .lean();
}

/** Applicant lists their own applications. */
async function listMine(userId) {
  return Application.find({ applicant: userId })
    .populate({ path: 'opportunity', select: 'title category status user' })
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = { apply, withdraw, accept, reject, listForOpportunity, listMine };
