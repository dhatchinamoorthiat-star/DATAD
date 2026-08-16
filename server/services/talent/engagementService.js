/**
 * EngagementService — the stateful unit of work created when an application is
 * accepted. Reputation and credits are LATER phases; this service only drives
 * the lifecycle and records deliverables. It captures the immutable `snapshot`
 * of agreed terms at creation so later disputes are judged against the deal,
 * not the mutable Opportunity.
 *
 * Every transition is an atomic compare-and-swap (audit H1): a findOneAndUpdate
 * guarded by the expected `from` status, and the domain event is emitted ONLY
 * when the swap returns a document. A concurrent caller that loses the race gets
 * `null` and emits nothing — so an event fires exactly once per real transition.
 *
 * Escrow (CreditLedger hold/release/refund) is intentionally NOT wired here yet
 * — that is the Phase 3 Credits Engine. The seams are marked with CREDITS
 * comments so the money moves get added without reshaping this lifecycle.
 */

const Engagement = require('../../models/Engagement');
const { forbidden, notFound, conflict } = require('./errors');
const transitions = require('./transitions');
const { EVENTS, emit } = require('./events');

function isRequester(eng, userId) { return eng.requester.equals(userId); }
function isHelper(eng, userId) { return eng.helper.equals(userId); }
function isParticipant(eng, userId) { return isRequester(eng, userId) || isHelper(eng, userId); }

async function loadParticipant(userId, id) {
  const eng = await Engagement.findOne({ _id: id, deletedAt: null });
  if (!eng) throw notFound('Engagement not found');
  if (!isParticipant(eng, userId)) throw forbidden('You are not part of this engagement');
  return eng;
}

/**
 * Internal — called by applicationService.accept() inside the accept flow, with
 * the transaction session so the engagement rolls back with the rest of the
 * aggregate on failure. `opportunity` is a loaded Opportunity doc; `application`
 * a loaded Application. Builds the immutable terms snapshot from the opportunity
 * as it stands now. The unique index on Engagement.application is the backstop
 * against a duplicate engagement (audit C1).
 */
async function create({ opportunity, application, dueAt = null, session = null }) {
  const [eng] = await Engagement.create([{
    opportunity: opportunity._id,
    application: application._id,
    requester: opportunity.user,
    helper: application.applicant,
    category: opportunity.category,
    priceCredits: opportunity.priceCredits || 0,
    snapshot: {
      title: opportunity.title,
      scope: opportunity.description,
      priceCredits: opportunity.priceCredits || 0,
      skills: opportunity.skills || [],
      category: opportunity.category,
      capturedAt: new Date(),
    },
    dueAt,
    status: 'accepted',
    // CREDITS(Phase 3): hold opportunity.priceCredits from the requester here and
    // set escrowLedgerId to the resulting 'hold' ledger row.
  }], { session: session || undefined });
  // No dedicated event — the accept flow emits APPLICATION_ACCEPTED, which
  // carries engagementId, so a notification subscriber has everything it needs.
  return eng;
}

/**
 * Atomic transition primitive. `authorize(eng)` runs against the freshly-loaded
 * doc for friendly 403/404s; `filter` is the compare-and-swap guard applied at
 * write time for integrity. Emits `event` only when the swap wins.
 */
async function transition(userId, id, { authorize, from, set, push, event, eventData }) {
  const eng = await loadParticipant(userId, id);
  if (authorize) authorize(eng);
  // Friendly early rejection when the current state obviously disallows it.
  transitions.assertEngagement(eng.status, set.status);

  const update = { $set: set };
  if (push) update.$push = push;
  const updated = await Engagement.findOneAndUpdate(
    { _id: id, deletedAt: null, status: { $in: Array.isArray(from) ? from : [from] } },
    update,
    { new: true }
  );
  // Lost the compare-and-swap: another request already advanced it. No event.
  if (!updated) throw conflict('This engagement was already updated — reload and try again');

  emit(event, userId, { engagementId: updated._id, ...eventData(updated) });
  return updated;
}

/** Helper begins the work. */
async function start(userId, id) {
  return transition(userId, id, {
    authorize: (eng) => { if (!isHelper(eng, userId)) throw forbidden('Only the helper can start the work'); },
    from: 'accepted',
    set: { status: 'in_progress', startedAt: new Date() },
    event: EVENTS.ENGAGEMENT_STARTED,
    eventData: (e) => ({ requester: e.requester, helper: e.helper }),
  });
}

/** Helper submits deliverables for the requester to confirm. */
async function submit(userId, id, { deliverables } = {}) {
  const cleaned = Array.isArray(deliverables)
    ? deliverables
        .filter((d) => d && typeof d === 'object')
        .map((d) => ({ label: String(d.label || '').slice(0, 200), url: String(d.url || '').slice(0, 500), at: new Date() }))
    : [];
  return transition(userId, id, {
    authorize: (eng) => { if (!isHelper(eng, userId)) throw forbidden('Only the helper can submit work'); },
    from: 'in_progress',
    set: { status: 'delivered', deliveredAt: new Date() },
    push: cleaned.length ? { deliverables: { $each: cleaned } } : undefined,
    event: EVENTS.ENGAGEMENT_SUBMITTED,
    eventData: (e) => ({ requester: e.requester, helper: e.helper }),
  });
}

/** Requester confirms completion. */
async function complete(userId, id) {
  return transition(userId, id, {
    authorize: (eng) => { if (!isRequester(eng, userId)) throw forbidden('Only the requester can confirm completion'); },
    from: 'delivered',
    set: { status: 'completed', completedAt: new Date() },
    // CREDITS(Phase 3): release escrow to the helper.
    // REPUTATION(Phase 3): a subscriber to this event recomputes both profiles.
    event: EVENTS.ENGAGEMENT_COMPLETED,
    eventData: (e) => ({ requester: e.requester, helper: e.helper, category: e.category }),
  });
}

/** Either participant cancels an engagement that has not been completed. */
async function cancel(userId, id, { reason } = {}) {
  const safeReason = reason ? String(reason).slice(0, 300) : null;
  return transition(userId, id, {
    from: ['accepted', 'in_progress'],
    set: { status: 'cancelled' },
    // CREDITS(Phase 3): refund any held escrow to the requester.
    event: EVENTS.ENGAGEMENT_CANCELLED,
    eventData: (e) => ({ requester: e.requester, helper: e.helper, reason: safeReason }),
  });
}

async function getById(userId, id) {
  const eng = await Engagement.findOne({ _id: id, deletedAt: null })
    .populate('requester', 'name avatarUrl')
    .populate('helper', 'name avatarUrl');
  if (!eng) throw notFound('Engagement not found');
  if (!isParticipant(eng, userId)) throw forbidden('You are not part of this engagement');
  return eng;
}

/** A user's engagements, optionally filtered to one side or status. */
async function listMine(userId, { role, status } = {}) {
  const query = { deletedAt: null };
  if (role === 'helper') query.helper = userId;
  else if (role === 'requester') query.requester = userId;
  else query.$or = [{ helper: userId }, { requester: userId }];
  if (status) query.status = status;

  return Engagement.find(query)
    .populate('requester', 'name avatarUrl')
    .populate('helper', 'name avatarUrl')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
}

module.exports = {
  create, start, submit, complete, cancel, getById, listMine,
  isParticipant, isRequester, isHelper,
};
