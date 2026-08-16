/**
 * ModerationService (minimal) — reports and dispute freezing.
 *
 * Phase 2 scope is deliberately small: open a case, and freeze an engagement so
 * its (future) escrow can't settle while under dispute. Admin resolution,
 * reputation penalties and escrow release/refund are later phases.
 */

const ModerationCase = require('../../models/ModerationCase');
const Engagement = require('../../models/Engagement');
const { badRequest, forbidden, notFound, conflict } = require('./errors');
const transitions = require('./transitions');
const { withTransaction } = require('./tx');

const { MODERATION_SUBJECTS } = ModerationCase;

function validateReport({ subjectType, subjectId, reason }) {
  if (!MODERATION_SUBJECTS.includes(subjectType)) {
    throw badRequest(`subjectType must be one of: ${MODERATION_SUBJECTS.join(', ')}`);
  }
  if (!subjectId) throw badRequest('subjectId is required');
  if (!reason || !reason.trim()) throw badRequest('A reason is required');
}

/** File a report against an opportunity / engagement / review / profile / user. */
async function report(userId, input = {}) {
  validateReport(input);
  return ModerationCase.create({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    reporter: userId,
    reason: String(input.reason).slice(0, 1000),
    state: 'open',
  });
}

/**
 * Freeze an engagement under dispute. Only a participant can raise it. Atomic
 * (audit H1+H2): the engagement is moved to 'disputed' via a compare-and-swap
 * and the moderation case is opened in the SAME transaction, so a partial
 * failure never leaves a disputed engagement without a case (or vice versa).
 */
async function freeze(userId, engagementId, { reason } = {}) {
  const eng = await Engagement.findOne({ _id: engagementId, deletedAt: null });
  if (!eng) throw notFound('Engagement not found');
  if (!eng.requester.equals(userId) && !eng.helper.equals(userId)) {
    throw forbidden('You are not part of this engagement');
  }
  transitions.assertEngagement(eng.status, 'disputed'); // friendly early check

  return withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const updated = await Engagement.findOneAndUpdate(
      { _id: engagementId, deletedAt: null, status: { $in: ['in_progress', 'delivered'] } },
      { $set: { status: 'disputed' } },
      { new: true, ...opts }
    );
    if (!updated) throw conflict('This engagement can no longer be disputed');

    const [moderationCase] = await ModerationCase.create([{
      subjectType: 'engagement',
      subjectId: updated._id,
      reporter: userId,
      reason: String(reason || 'Engagement disputed').slice(0, 1000),
      state: 'open',
    }], { session: session || undefined });

    return { engagement: updated, moderationCase };
  });
}

module.exports = { report, freeze };
