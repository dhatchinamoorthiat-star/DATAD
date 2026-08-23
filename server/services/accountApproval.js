const User = require('../models/User');
const logger = require('../utils/logger');
const sessionVersion = require('./sessionVersion');
const logActivity = require('../utils/logActivity');
const events = require('../events/domainEvents');
const { sendAccountApprovedEmail, sendWelcomeEmail } = require('../config/mailer');

/**
 * Admit a pending account.
 *
 * There are now two ways an admin approves someone — the dashboard button and
 * the one-click link in the registration alert email — and they must do exactly
 * the same work. When this lived inline in adminController, adding the email
 * route would have meant a second copy of "flip status, invalidate the session
 * cache, provision the program, mail the student, log it", and the two would
 * have drifted the first time one of those steps changed.
 *
 * @param {object} user            a pending User document
 * @param {object} [opts]
 * @param {*} [opts.approvedBy]    id recorded on the ProgramApproval; defaults
 *                                 to the user, matching how a preset program is
 *                                 self-approved at registration.
 * @param {string} [opts.via]      'dashboard' | 'email', for the activity log
 * @returns {Promise<{approved: boolean, reason?: string}>}
 */
async function approveAccount(user, { approvedBy = null, via = 'dashboard' } = {}) {
  if (!user) return { approved: false, reason: 'not_found' };
  if (user.status !== 'pending') return { approved: false, reason: 'not_pending' };

  user.status = 'approved';
  await user.save();
  // verifyToken reads status from the cached session record; drop it so the
  // approval takes effect on the student's very next request.
  sessionVersion.invalidate(user._id);

  await provisionProgram(user, approvedBy || user._id);

  sendAccountApprovedEmail(user).catch((err) =>
    logger.error('Approval email failed:', { error: err.message })
  );
  sendWelcomeEmail(user).catch((err) =>
    logger.error('Welcome email failed:', { error: err.message })
  );

  // Required lazily: notificationController pulls in the whole notification
  // stack, and this service is required from controllers it in turn touches.
  require('../controllers/notificationController')
    .notify({
      user: user._id,
      type: 'general',
      title: `Welcome to DATAD, ${user.name.split(' ')[0]}! Your account has been approved.`,
      link: '/',
    })
    .catch(() => {});

  logActivity(
    'approved',
    `Admin approved ${user.name}'s account${via === 'email' ? ' from the registration alert email' : ''}`,
    user
  );
  events.admin.accountApproved(user._id, { name: user.name, email: user.email }).catch(() => {});

  return { approved: true };
}

/**
 * Approving the person also provisions their program. These were two separate
 * admin actions; forgetting the second one let a student in with an empty feed,
 * so there is now only one.
 */
async function provisionProgram(user, approvedBy) {
  const ProgramApproval = require('../models/ProgramApproval');
  const ProgramRegistry = require('../models/ProgramRegistry');
  const programId = user.program?.id;
  if (!programId || (await ProgramRegistry.exists({ _id: programId }))) return;

  const approval = await ProgramApproval.findById(user.program?.approvalId);
  if (!approval) return;

  approval.status = 'approved';
  approval.approvedBy = approvedBy;
  approval.approvedAt = new Date();
  await approval.save();

  // Fire-and-forget: the sync reports its own progress on the approval doc, and
  // a slow sync must not hold up the admin's response.
  require('./programSyncService')
    .runProgramSync(approval._id)
    .catch((err) =>
      logger.error('Program sync on approval failed', { error: err.message, programId })
    );
}

/** The admin account that owns ADMIN_EMAIL, when there is one. */
async function adminUser() {
  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email) return null;
  return User.findOne({ email }).select('_id name email').lean();
}

module.exports = { approveAccount, adminUser };
