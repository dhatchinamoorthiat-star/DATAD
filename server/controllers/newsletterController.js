/**
 * The approval boundary for the weekly newsletter.
 *
 * The H4 finding was not really "the prompt was injectable" — every prompt built
 * from user content is injectable to some degree. It was that an injectable
 * prompt sat upstream of an unattended mass mailer, so a single post title had a
 * clear path to every student's inbox from a verified sender. This module is
 * the human in that path.
 *
 * Two properties matter more than the endpoint shape:
 *
 *   - Only `status: 'draft'` can be sent. `blocked` is not overridable by an
 *     admin, because an approval button that can wave past the content filter
 *     replaces the content filter with whether the admin was paying attention.
 *   - The draft is re-validated at send time, not merely at generation time.
 *     Generation and sending are separated by however long an admin takes, and
 *     the check that matters is the one immediately before the mail leaves.
 */

const NewsletterDraft = require('../models/NewsletterDraft');
const User = require('../models/User');
const { sendAnnouncementEmail } = require('../config/mailer');
const { notifyBulk } = require('./notificationController');
const { validateNewsletter, summarize } = require('../automation/newsletter/newsletterGuard');
const logger = require('../utils/logger');

/** Compose the mail body from a draft. Plain text — the mailer escapes it. */
function draftToAnnouncement(draft) {
  const sections = Object.values(draft.sections || {}).filter(Boolean).join('\n\n');
  return {
    title: draft.subject,
    body: [draft.intro, sections, draft.closingNote].filter(Boolean).join('\n\n'),
  };
}

/** GET /api/admin/newsletter — every draft, newest first. */
exports.listDrafts = async (req, res, next) => {
  try {
    const drafts = await NewsletterDraft.find()
      .sort({ weekStart: -1 })
      .limit(26)
      .populate('approvedBy', 'name email')
      .lean();
    res.json(drafts);
  } catch (err) {
    next(err);
  }
};

/** GET /api/admin/newsletter/:id — one draft, with a live validation verdict. */
exports.getDraft = async (req, res, next) => {
  try {
    const draft = await NewsletterDraft.findById(req.params.id).populate('approvedBy', 'name email').lean();
    if (!draft) return res.status(404).json({ message: 'Draft not found' });

    // Shown to the admin alongside the body: a reviewer should be able to see
    // what the automated check thinks before deciding, not just its verdict.
    const verdict = validateNewsletter(draft);

    // How many this would reach if sent now. Deliberately NOT called
    // recipientCount: the draft already carries that field, meaning how many it
    // actually went to when it was sent. Spreading a live count over it made an
    // already-sent newsletter report today's audience as its historical one, so
    // the list and the detail view disagreed about the same send.
    const audienceSize = await User.countDocuments({ status: 'approved', role: { $ne: 'admin' } });

    res.json({ ...draft, verdict, audienceSize });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/newsletter/:id/send — approve and fan out.
 *
 * The only path by which a newsletter reaches a student.
 */
exports.sendDraft = async (req, res, next) => {
  try {
    const draft = await NewsletterDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ message: 'Draft not found' });

    if (draft.status === 'sent') {
      return res.status(409).json({ message: 'This newsletter has already been sent' });
    }
    if (draft.status !== 'draft') {
      // Deliberately not overridable. See the module comment.
      return res.status(409).json({
        message:
          draft.status === 'blocked'
            ? 'This draft failed content validation and cannot be sent. Regenerate it.'
            : `A draft with status "${draft.status}" cannot be sent.`,
        guardNotes: draft.guardNotes,
      });
    }

    // Re-validate at the moment of sending.
    const verdict = validateNewsletter(draft.toObject());
    if (!verdict.ok) {
      draft.status = 'blocked';
      draft.guardNotes = summarize(verdict.violations);
      await draft.save();
      logger.error('[newsletter] draft failed validation at send time and was blocked', {
        draftId: String(draft._id),
        violations: verdict.violations,
        adminId: String(req.user.userId),
      });
      return res.status(422).json({
        message: 'This draft failed content validation and was not sent.',
        violations: verdict.violations,
      });
    }

    const recipients = await User.find({ status: 'approved', role: { $ne: 'admin' } })
      .select('name email')
      .lean();

    if (!recipients.length) {
      return res.status(400).json({ message: 'No approved recipients to send to' });
    }

    let outcome;
    try {
      outcome = await sendAnnouncementEmail(recipients, draftToAnnouncement(draft));
    } catch (err) {
      draft.status = 'failed';
      await draft.save();
      logger.error('[newsletter] send failed', { draftId: String(draft._id), error: err.message });
      return res.status(502).json({ message: 'Mail delivery failed', requestId: req.id });
    }

    draft.status = 'sent';
    draft.sentAt = new Date();
    draft.recipientCount = recipients.length;
    draft.approvedBy = req.user.userId;
    draft.approvedAt = new Date();
    await draft.save();

    notifyBulk(
      recipients.map((r) => r._id),
      {
        type: 'announcement',
        title: `Weekly newsletter: ${draft.subject}`,
        body: draft.preheader,
        link: '/briefing',
      }
    ).catch(() => {});

    logger.info('[newsletter] approved and sent', {
      draftId: String(draft._id),
      adminId: String(req.user.userId),
      recipients: recipients.length,
      sent: outcome?.sent,
      failed: outcome?.failed,
    });

    res.json({ status: 'sent', recipients: recipients.length, delivery: outcome });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/admin/newsletter/:id — discard a draft an admin does not want. */
exports.discardDraft = async (req, res, next) => {
  try {
    const draft = await NewsletterDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ message: 'Draft not found' });
    if (draft.status === 'sent') {
      return res.status(409).json({ message: 'A sent newsletter cannot be discarded' });
    }
    await draft.deleteOne();
    logger.info('[newsletter] draft discarded', {
      draftId: String(req.params.id),
      adminId: String(req.user.userId),
    });
    res.json({ status: 'discarded' });
  } catch (err) {
    next(err);
  }
};

exports.draftToAnnouncement = draftToAnnouncement;
