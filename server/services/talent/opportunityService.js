/**
 * OpportunityService — lifecycle and querying for Talent Exchange opportunities.
 *
 * All business rules (ownership, status transitions, visibility) live here;
 * controllers only pass the authenticated userId and the request body. Every
 * mutation re-scopes by userId, so a client-supplied id can never reach another
 * user's opportunity.
 *
 * Status transitions are atomic compare-and-swaps (audit H1): findOneAndUpdate
 * guarded by owner + expected status, with a distinguishing re-read only to turn
 * a missed swap into a precise 403/404/409 rather than a bare failure.
 */

const Opportunity = require('../../models/Opportunity');
const { badRequest, forbidden, notFound, conflict } = require('./errors');
const { EVENTS, emit } = require('./events');

const {
  OPPORTUNITY_KINDS,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_VISIBILITY,
  OPPORTUNITY_URGENCY,
} = Opportunity;

const CREATABLE_FIELDS = [
  'title', 'description', 'skills', 'estDurationMin', 'priceCredits',
  'urgency', 'visibility', 'slotsTotal', 'expiresAt',
];
const UPDATABLE_FIELDS = CREATABLE_FIELDS;

function normSkills(skills) {
  if (!Array.isArray(skills)) return [];
  const seen = new Set();
  for (const s of skills) {
    if (typeof s === 'string' && s.trim()) seen.add(s.trim().toLowerCase());
  }
  return [...seen].slice(0, 20);
}

/** Visibility rule: public → everyone; program → same program; private → owner only. */
function canView(opp, viewer) {
  if (opp.user.equals(viewer.userId)) return true;
  if (opp.visibility === 'public') return true;
  if (opp.visibility === 'program') return Boolean(opp.program) && opp.program === viewer.program?.id;
  return false; // private
}

/**
 * Turn a missed compare-and-swap into a precise error: 404 if gone, 403 if not
 * the owner, else 409 because the status guard failed (someone else moved it).
 */
async function explainMiss(userId, id, notOwnerMsg, statusMsg) {
  const exists = await Opportunity.findOne({ _id: id, deletedAt: null });
  if (!exists) throw notFound('Opportunity not found');
  if (!exists.user.equals(userId)) throw forbidden(notOwnerMsg);
  throw conflict(statusMsg);
}

async function create(userId, viewer, body = {}) {
  if (!OPPORTUNITY_KINDS.includes(body.kind)) {
    throw badRequest(`kind must be one of: ${OPPORTUNITY_KINDS.join(', ')}`);
  }
  if (!OPPORTUNITY_CATEGORIES.includes(body.category)) {
    throw badRequest(`category must be one of: ${OPPORTUNITY_CATEGORIES.join(', ')}`);
  }
  if (!body.title || !body.title.trim()) throw badRequest('A title is required');
  if (!body.description || !body.description.trim()) throw badRequest('A description is required');
  if (body.visibility && !OPPORTUNITY_VISIBILITY.includes(body.visibility)) throw badRequest('Invalid visibility');
  if (body.urgency && !OPPORTUNITY_URGENCY.includes(body.urgency)) throw badRequest('Invalid urgency');

  const doc = new Opportunity({
    user: userId,
    ownerType: 'student',
    kind: body.kind,
    category: body.category,
    title: body.title,
    description: body.description,
    skills: normSkills(body.skills),
    estDurationMin: body.estDurationMin,
    priceCredits: body.priceCredits ?? 0,
    urgency: body.urgency || 'normal',
    visibility: OPPORTUNITY_VISIBILITY.includes(body.visibility) ? body.visibility : 'public',
    program: viewer?.program?.id || null,
    slotsTotal: body.slotsTotal || 1,
    expiresAt: body.expiresAt || null,
    status: 'draft',
  });
  await doc.save();

  emit(EVENTS.OPPORTUNITY_CREATED, userId, { opportunityId: doc._id, kind: doc.kind, category: doc.category });
  return doc;
}

async function update(userId, id, body = {}) {
  const $set = {};
  UPDATABLE_FIELDS.forEach((f) => {
    if (body[f] === undefined) return;
    $set[f] = f === 'skills' ? normSkills(body[f]) : body[f];
  });
  // Terms editable only while draft/open (before anyone is matched).
  const updated = await Opportunity.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null, status: { $in: ['draft', 'open'] } },
    { $set },
    { new: true, runValidators: true }
  );
  if (!updated) await explainMiss(userId, id, 'You do not own this opportunity', 'Only draft or open opportunities can be edited');
  emit(EVENTS.OPPORTUNITY_UPDATED, userId, { opportunityId: updated._id, change: 'edit' });
  return updated;
}

async function publish(userId, id) {
  const updated = await Opportunity.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null, status: 'draft' },
    { $set: { status: 'open' } },
    { new: true }
  );
  if (!updated) await explainMiss(userId, id, 'You do not own this opportunity', 'Only a draft opportunity can be published');
  emit(EVENTS.OPPORTUNITY_UPDATED, userId, { opportunityId: updated._id, change: 'published' });
  return updated;
}

async function close(userId, id) {
  const updated = await Opportunity.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null, status: { $in: ['draft', 'open', 'matched'] } },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!updated) await explainMiss(userId, id, 'You do not own this opportunity', 'This opportunity can no longer be closed');
  emit(EVENTS.OPPORTUNITY_CLOSED, userId, { opportunityId: updated._id });
  return updated;
}

/** Soft delete — keeps the row for audit; disappears from every query. Idempotent-safe. */
async function archive(userId, id) {
  const updated = await Opportunity.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );
  if (!updated) await explainMiss(userId, id, 'You do not own this opportunity', 'Already archived');
  emit(EVENTS.OPPORTUNITY_UPDATED, userId, { opportunityId: updated._id, change: 'archived' });
  return updated;
}

async function list(viewer, { category, kind, status, mine, limit = 30, skip = 0 } = {}) {
  const query = { deletedAt: null };
  if (category) query.category = category;
  if (kind) query.kind = kind;

  if (mine) {
    query.user = viewer.userId;
  } else {
    query.status = status || 'open';
    query.$or = [
      { visibility: 'public' },
      { visibility: 'program', program: viewer.program?.id || '__none__' },
      { user: viewer.userId },
    ];
  }

  return Opportunity.find(query)
    .populate('user', 'name avatarUrl')
    .sort({ createdAt: -1 })
    .skip(Math.max(0, Number(skip) || 0))
    .limit(Math.min(100, Math.max(1, Number(limit) || 30)))
    .lean();
}

async function search(viewer, { q, limit = 30 } = {}) {
  if (!q || !q.trim()) return [];
  return Opportunity.find({
    deletedAt: null,
    status: 'open',
    $text: { $search: q.trim() },
    $or: [
      { visibility: 'public' },
      { visibility: 'program', program: viewer.program?.id || '__none__' },
      { user: viewer.userId },
    ],
  })
    .populate('user', 'name avatarUrl')
    .sort({ score: { $meta: 'textScore' } })
    .limit(Math.min(100, Math.max(1, Number(limit) || 30)))
    .lean();
}

async function getById(viewer, id) {
  const opp = await Opportunity.findOne({ _id: id, deletedAt: null })
    .populate('user', 'name avatarUrl');
  if (!opp) throw notFound('Opportunity not found');
  if (!canView(opp, viewer)) throw forbidden('You cannot view this opportunity');
  return opp;
}

module.exports = {
  create, update, publish, close, archive, list, search, getById,
  canView, // reused by applicationService.apply for the H3 visibility gate
};
