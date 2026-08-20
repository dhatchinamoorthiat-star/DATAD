const User = require('../models/User');
const Note = require('../models/Note');
const Photo = require('../models/Photo');
const Task = require('../models/Task');
const Announcement = require('../models/Announcement');
const JournalEntry = require('../models/JournalEntry');
const AutomationLog = require('../models/AutomationLog');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const { sendAnnouncementEmail, sendAccountApprovedEmail, sendWelcomeEmail } = require('../config/mailer');
const { notify } = require('./notificationController');
const ActivityLog = require('../models/ActivityLog');
const logActivity = require('../utils/logActivity');
const sessionVersion = require('../services/sessionVersion');
const events = require('../events/domainEvents');
const publishService = require('../services/publishing/publishService');
const logger = require('../utils/logger');
const StudentIdentity = require('../models/StudentIdentity');
const { getIdentity } = require('../services/studentIdentityService');

const PROFILE_FIELDS = [
  'college', 'course', 'department', 'semester', 'batch', 'graduationYear', 'specialization',
  'domainPrimary', 'domainTags', 'dreamRole', 'preferredIndustries', 'careerInterests',
  'favouriteSubjects', 'difficultSubjects', 'skills', 'interests', 'learningStyle',
  'timeAvailable', 'goals', 'challenges', 'studentType', 'workExYears', 'pastDomain',
];

function pickProfileFields(identity) {
  if (!identity) return null;
  const picked = {};
  for (const f of PROFILE_FIELDS) picked[f] = identity[f];
  return picked;
}

// ---- Overview ----

exports.getStats = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      students, notes, photos, tasks, journalEntries,
      activeUsers, pendingApprovals, pendingSubscriptions,
      aiCostResult, recentJobResult,
    ] = await Promise.all([
      User.countDocuments(),
      Note.countDocuments(),
      Photo.countDocuments(),
      Task.countDocuments(),
      JournalEntry.countDocuments(),
      User.countDocuments({ updatedAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ status: 'pending' }),
      SubscriptionRequest.countDocuments({ status: 'pending' }),
      AutomationLog.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, estimatedCostUsd: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
      ]),
      AutomationLog.findOne({}).sort({ createdAt: -1 }).select('jobName status createdAt').lean(),
    ]);

    const aiCost30d = aiCostResult[0]?.total ?? 0;
    const aiJobCount30d = aiCostResult[0]?.count ?? 0;

    res.json({
      students, notes, photos, tasks, journalEntries,
      activeUsers, pendingApprovals, pendingSubscriptions,
      aiCost30d: parseFloat(aiCost30d.toFixed(4)),
      aiJobCount30d,
      lastJob: recentJobResult,
    });
  } catch (err) {
    next(err);
  }
};

exports.listStudents = async (req, res, next) => {
  try {
    const students = await User.find()
      // emailVerifiedAt and program are the two signals the approval screen
      // vets on, so they must survive this projection.
      .select('-password -resetTokenHash -resetTokenExpires -verifyTokenHash -verifyTokenExpires')
      .sort({ status: -1, createdAt: -1 }) // 'pending' > 'approved', so pending first
      .lean();

    const ids = students.map((s) => s._id);
    const identities = await StudentIdentity.find({ user: { $in: ids } }).lean();
    const identityByUser = new Map(identities.map((i) => [String(i.user), i]));

    // Students who registered before StudentIdentity existed have no doc yet —
    // bootstrap them from legacy User/UserProfile fields so admins see full
    // profiles for every account, not just ones created after this change.
    const missingIds = ids.filter((id) => !identityByUser.has(String(id)));
    if (missingIds.length > 0) {
      const bootstrapped = await Promise.all(missingIds.map((id) => getIdentity(id).catch(() => null)));
      bootstrapped.forEach((identity, i) => {
        if (identity) identityByUser.set(String(missingIds[i]), identity);
      });
    }

    const merged = students.map((s) => ({
      ...s,
      profile: pickProfileFields(identityByUser.get(String(s._id))),
    }));

    res.json(merged);
  } catch (err) {
    next(err);
  }
};

exports.getStudentProfile = async (req, res, next) => {
  try {
    const identity = await getIdentity(req.params.id);
    if (!identity) return res.status(404).json({ message: 'User not found' });
    res.json(identity);
  } catch (err) {
    next(err);
  }
};

// ---- Membership approval ----

exports.approveStudent = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status !== 'pending') return res.status(400).json({ message: 'User is already approved' });

    user.status = 'approved';
    await user.save();
    // verifyToken reads status from the cached session record; drop it so the
    // approval takes effect on the student's very next request.
    sessionVersion.invalidate(user._id);

    // Approving the person also provisions their program. These were two
    // separate admin actions; forgetting the second one let a student in with
    // an empty feed, so there is now only one.
    const ProgramApproval = require('../models/ProgramApproval');
    const ProgramRegistry = require('../models/ProgramRegistry');
    const programId = user.program?.id;
    if (programId && !(await ProgramRegistry.exists({ _id: programId }))) {
      const approval = await ProgramApproval.findById(user.program?.approvalId);
      if (approval) {
        approval.status = 'approved';
        approval.approvedBy = req.user.userId;
        approval.approvedAt = new Date();
        await approval.save();

        // Fire-and-forget: the sync reports its own progress on the approval
        // doc, and a slow sync must not hold up the admin's response.
        require('../services/programSyncService')
          .runProgramSync(approval._id)
          .catch((err) => logger.error('Program sync on approval failed', { error: err.message, programId }));
      }
    }

    sendAccountApprovedEmail(user).catch((err) => logger.error('Approval email failed:', err.message));
    sendWelcomeEmail(user).catch((err) => logger.error('Welcome email failed:', err.message));
    notify({ user: user._id, type: 'general', title: `Welcome to DATAD, ${user.name.split(' ')[0]}! Your account has been approved.`, link: '/' }).catch(() => {});
    logActivity('approved', `Admin approved ${user.name}'s account`, user);
    events.admin.accountApproved(user._id, { name: user.name, email: user.email }).catch(() => {});
    res.json({ message: `${user.name} approved`, user });
  } catch (err) {
    next(err);
  }
};

exports.rejectStudent = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending accounts can be rejected' });
    }
    await User.deleteOne({ _id: user._id });
    // Otherwise a cached record could keep a rejected account's token working
    // for the remainder of the TTL.
    sessionVersion.invalidate(user._id);
    logActivity('rejected', `Admin rejected ${user.name}'s pending signup`, user);
    res.json({ message: 'Pending account removed' });
  } catch (err) {
    next(err);
  }
};

// ---- Activity log & referral network ----

exports.getActivityLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
};

// Who referred whom, plus each member's code status — powers the flow view.
exports.getReferralMap = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email status referralCode referralUsedBy referredBy createdAt')
      .populate('referredBy', 'name email')
      .populate('referralUsedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// ---- Announcements ----

exports.createAnnouncement = async (req, res, next) => {
  try {
    const { title, body, priority, pinned, sendEmail } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required' });
    }
    // Record creation goes through the central publishing engine; the
    // verbatim body is passed via extra so it is stored unmodified.
    const { target: announcement } = await publishService.publishDirect({
      destinationKey: 'announcements',
      meta: {
        title,
        description: body.slice(0, 2000),
        extra: { body, priority, pinned: Boolean(pinned) },
      },
      user: req.user,
    });
    // In-app notification to all non-admin users (fire-and-forget)
    User.find({ role: { $ne: 'admin' } }).select('_id').lean().then((users) => {
      const notifPromises = users.map((u) =>
        notify({ user: u._id, type: 'announcement', title: announcement.title, body: body.slice(0, 120), link: '/community/announcements', actor: req.user.userId })
      );
      Promise.allSettled(notifPromises).catch(() => {});
      events.admin.announcementPosted(req.user.userId, { title: announcement.title, body }).catch(() => {});
    }).catch(() => {});

    if (sendEmail) {
      const recipients = await User.find({ role: { $ne: 'admin' } }).select('name email');
      if (recipients.length) {
        try {
          await sendAnnouncementEmail(recipients, announcement);
          announcement.emailed = true;
          await announcement.save();
        } catch (err) {
          logger.error('Announcement email failed:', err.message);
        }
      }
    }
    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
    await announcement.deleteOne();
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
};
