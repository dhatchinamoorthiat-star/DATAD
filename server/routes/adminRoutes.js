const router = require('express').Router();
// Used by the fire-and-forget catch on the program-sync route below. It was
// referenced there without ever being imported, so the one path that reports a
// failed sync threw ReferenceError inside a promise rejection handler — an
// unhandled rejection, and the sync failure itself never reached the logs.
const logger = require('../utils/logger');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const { heavyLimiter } = require('../middleware/rateLimiters');
const {
  getStats,
  listStudents,
  getStudentProfile,
  approveStudent,
  rejectStudent,
  getActivityLogs,
  getReferralMap,
  createAnnouncement,
  deleteAnnouncement,
} = require('../controllers/adminController');

router.use(verifyToken, checkRole('admin'));

router.get('/stats', getStats);
router.get('/students', listStudents);
router.get('/students/:id/profile', getStudentProfile);
router.patch('/students/:id/approve', approveStudent);
router.delete('/students/:id/reject', rejectStudent);
router.get('/logs', getActivityLogs);
router.get('/referrals', getReferralMap);

router.post('/announcements', heavyLimiter, createAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// Site-wide meta (placement date, batch name)
const SiteMeta = require('../models/SiteMeta');
router.get('/meta', async (req, res, next) => {
  try {
    const meta = await SiteMeta.findOne({ key: 'main' }).lean();
    res.json(meta || {});
  } catch (err) { next(err); }
});
router.put('/meta', async (req, res, next) => {
  try {
    const { placementDate, batchName } = req.body;
    const meta = await SiteMeta.findOneAndUpdate(
      { key: 'main' },
      { $set: { placementDate: placementDate || null, batchName: batchName || '' } },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(meta);
  } catch (err) { next(err); }
});

// ── Subscription management ───────────────────────────────────────────────

const SubscriptionRequest = require('../models/SubscriptionRequest');
const User = require('../models/User');
const notificationService = require('../notifications/NotificationService');

const { TIERS } = require('../subscription/tierHierarchy');

const VALID_TIERS = TIERS;

// Paid plans run for exactly one month from activation; trials for 14 days.
const oneMonthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};
const sevenDaysFromNow = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const { expiryFor, monthlyEquivalent } = require('../subscription/pricing');
const { activateSubscription, rejectSubscription } = require('../subscription/activation');

// List all subscription requests
router.get('/subscriptions', async (req, res, next) => {
  try {
    const status = req.query.status; // pending | approved | rejected | (all)
    const filter = status ? { status } : {};
    // Pending queue is worked oldest-first (FIFO) so nobody waits longer than necessary.
    const sort = status === 'pending' ? { createdAt: 1 } : { createdAt: -1 };
    const requests = await SubscriptionRequest.find(filter)
      .sort(sort)
      .limit(200)
      .populate('user', 'name email tier')
      .lean();

    // Flag payment refs that were already used on a different, already-approved
    // request — a reused/stolen UTR is the main fraud risk in a manual-UPI flow.
    const refs = requests.map((r) => r.paymentRef);
    const reused = refs.length
      ? await SubscriptionRequest.find({
          paymentRef: { $in: refs },
          status: 'approved',
        }).select('paymentRef user').lean()
      : [];
    const approvedRefOwners = new Map(); // paymentRef -> user id string that already used it
    reused.forEach((r) => approvedRefOwners.set(r.paymentRef, String(r.user)));

    const withFlags = requests.map((r) => {
      const owner = approvedRefOwners.get(r.paymentRef);
      const duplicateRef = owner && owner !== String(r.user?._id || r.user);
      return duplicateRef ? { ...r, duplicateRef: true } : r;
    });

    res.json(withFlags);
  } catch (err) { next(err); }
});

// List all users with their tier
router.get('/subscriptions/users', async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email role tier trialStartedAt tierExpiresAt subscriptionRef createdAt status')
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (err) { next(err); }
});

// Manually change a user's tier
router.patch('/subscriptions/users/:id/tier', async (req, res, next) => {
  try {
    const { tier, subscriptionRef, tierExpiresAt } = req.body;
    if (!VALID_TIERS.includes(tier)) {
      return res.status(400).json({ message: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` });
    }

    const patch = { tier };
    if (subscriptionRef) patch.subscriptionRef = subscriptionRef;
    if (tierExpiresAt) patch.tierExpiresAt = new Date(tierExpiresAt);
    else if (tier === 'free') patch.tierExpiresAt = null; // free never expires
    else if (tier === 'trial') patch.tierExpiresAt = sevenDaysFromNow();
    else if (tier === 'placement') patch.tierExpiresAt = expiryFor('placement', 'onetime');
    else patch.tierExpiresAt = oneMonthFromNow(); // manual Pro grant defaults to one month

    const user = await User.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true })
      .select('name email tier tierExpiresAt subscriptionRef')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    // An admin-granted trial consumes the one-time self-serve trial too
    if (tier === 'trial') {
      await User.updateOne({ _id: req.params.id, trialStartedAt: null }, { trialStartedAt: new Date() });
    }

    const till = patch.tierExpiresAt
      ? ` — valid till ${new Date(patch.tierExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';
    res.json({ message: `${user.name} updated to ${tier}${till}`, user });
  } catch (err) { next(err); }
});

// Approve or reject a subscription request
router.patch('/subscriptions/:id/review', async (req, res, next) => {
  try {
    const { action, reviewNote } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const sr = await SubscriptionRequest.findById(req.params.id).populate('user', 'name email');
    if (!sr) return res.status(404).json({ message: 'Request not found' });
    if (sr.status !== 'pending') {
      return res.status(400).json({ message: 'Request already reviewed' });
    }

    // Granting the tier, computing the expiry and notifying the student all
    // live in subscription/activation.js, because the Razorpay webhook has to
    // do exactly the same thing and the two must not drift.
    if (action === 'approve') {
      await activateSubscription(sr, { reviewedBy: req.user.userId, reviewNote });
    } else {
      await rejectSubscription(sr, { reviewedBy: req.user.userId, reviewNote });
    }

    res.json({ message: `Request ${sr.status}`, request: sr });
  } catch (err) { next(err); }
});

// ── Subscription Analytics ───────────────────────────────────────────────
router.get('/subscriptions/analytics', async (req, res, next) => {
  try {
    const users = await User.find()
      .select('tier trialStartedAt tierExpiresAt createdAt subscriptionRef')
      .lean();

    const now = new Date();

    // Tier distribution
    const tierCount = {
      free: 0,
      trial: 0,
      pro: 0,
      placement: 0,
    };

    // Active subscriptions (not expired)
    const activeCount = {
      trial: 0,
      pro: 0,
      placement: 0,
    };

    // Trial conversion metrics
    let trialConverted = 0;
    let trialExpired = 0;

    // Revenue calculation (conservative estimate: avg 250k INR per Pro/yr, 500k per Max/yr)
    const proAnnualPrice = 4799; // yearly price
    const maxAnnualPrice = 12499;
    let estimatedMrr = 0;

    // Signups by day (last 30 days)
    const signupsByDay = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      signupsByDay[d.toISOString().slice(0, 10)] = 0;
    }

    users.forEach((user) => {
      tierCount[user.tier]++;

      // Count active subscriptions (non-free, not expired)
      if (user.tier !== 'free') {
        if (!user.tierExpiresAt || user.tierExpiresAt > now) {
          activeCount[user.tier]++;

          // Estimate MRR
          if (user.tier === 'pro') estimatedMrr += monthlyEquivalent('pro', 'yearly');
          if (user.tier === 'placement') estimatedMrr += monthlyEquivalent('placement', 'onetime');
        }
      }

      // Trial conversion metrics
      if (user.trialStartedAt) {
        if (user.tier !== 'trial' && user.tier !== 'free') {
          trialConverted++;
        } else if (user.tier === 'trial' && user.tierExpiresAt && user.tierExpiresAt < now) {
          trialExpired++;
        }
      }

      // Signups by day
      const signupDate = new Date(user.createdAt).toISOString().slice(0, 10);
      if (signupsByDay[signupDate] !== undefined) {
        signupsByDay[signupDate]++;
      }
    });

    const totalUsers = users.length;
    const totalTrialStarts = users.filter(u => u.trialStartedAt).length;
    const conversionRate = totalTrialStarts > 0 ? Math.round((trialConverted / totalTrialStarts) * 100) : 0;

    res.json({
      summary: {
        totalUsers,
        totalTrialStarts,
        trialConverted,
        trialExpired,
        conversionRate: `${conversionRate}%`,
        estimatedMrr: Math.round(estimatedMrr),
      },
      tierDistribution: {
        free: tierCount.free,
        trial: tierCount.trial,
        pro: tierCount.pro,
        placement: tierCount.placement,
      },
      activeSubscriptions: activeCount,
      signupsByDay: Object.entries(signupsByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, signups: count })),
    });
  } catch (err) { next(err); }
});

// ── Program Personalization & Approval ─────────────────────────────────────

const ProgramApproval = require('../models/ProgramApproval');
const { runProgramSync } = require('../services/programSyncService');

// List pending program approvals
router.get('/programs/pending-approval', async (req, res, next) => {
  try {
    const pending = await ProgramApproval.find({ status: 'pending' })
      .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(pending);
  } catch (err) { next(err); }
});

// Get sync status for a program approval
router.get('/programs/:approvalId/sync-status', async (req, res, next) => {
  try {
    const approval = await ProgramApproval.findById(req.params.approvalId).lean();

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json({
      status: approval.syncStatus,
      progress: approval.syncLog,
      emailSent: approval.emailSent,
    });
  } catch (err) { next(err); }
});

// Approve program and trigger data sync
router.post('/programs/:approvalId/approve', async (req, res, next) => {
  try {
    const approval = await ProgramApproval.findById(req.params.approvalId);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'This approval is not pending' });
    }

    // Mark as approved
    approval.status = 'approved';
    approval.approvedBy = req.user.userId;
    approval.approvedAt = new Date();
    approval.syncStatus = 'in_progress';
    approval.syncStartedAt = new Date();
    approval.syncLog = [];
    await approval.save();

    // Mark user as approved
    const user = await User.findById(approval.requestedBy);
    user.status = 'approved';
    await user.save();

    res.json({ message: 'Program approved. Data sync in progress...' });

    // Fire-and-forget: the admin polls /sync-status for progress. Failures are
    // recorded on the approval doc itself, so nothing is lost by not awaiting.
    runProgramSync(approval._id).catch((err) => {
      logger.error('Program data sync failed', { error: err.message, approvalId: String(approval._id) });
    });
  } catch (err) { next(err); }
});

// Reject program approval
router.post('/programs/:approvalId/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;

    const approval = await ProgramApproval.findById(req.params.approvalId);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    approval.status = 'rejected';
    approval.rejectionReason = reason || 'Not specified';
    approval.approvedBy = req.user.userId;
    approval.approvedAt = new Date();
    await approval.save();

    res.json({ message: 'Program approval rejected' });
  } catch (err) { next(err); }
});


// ── Placement Outcome Management (Outcome Vault) ─────────────────────────
const PlacementOutcome = require('../models/PlacementOutcome');

// GET /admin/outcomes — list all outcomes, with optional filters
router.get('/outcomes', async (req, res, next) => {
  try {
    const { company, outcome, verified, userId, limit = 100 } = req.query;
    const filter = {};
    if (company) filter.company = new RegExp(company, 'i');
    if (outcome) filter.outcome = outcome;
    if (verified === 'true') filter.verified = true;
    if (verified === 'false') filter.verified = false;
    if (userId) filter.user = userId;

    const outcomes = await PlacementOutcome.find(filter)
      .sort({ placementDate: -1 })
      .limit(Math.min(Number(limit), 500))
      .populate('user', 'name email rollNumber')
      .lean();

    res.json({ outcomes, count: outcomes.length });
  } catch (err) { next(err); }
});

// POST /admin/outcomes — create a placement outcome record
router.post('/outcomes', async (req, res, next) => {
  try {
    const { userId, company, role, stageReached, outcome, offerAccepted, package: pkg, notes, drive } = req.body;

    if (!userId || !company || !role || !stageReached || !outcome) {
      return res.status(400).json({ message: 'userId, company, role, stageReached, and outcome are required' });
    }

    const record = await PlacementOutcome.create({
      user: userId,
      company,
      role,
      stageReached,
      outcome,
      offerAccepted: offerAccepted || false,
      package: pkg || '',
      notes: notes || '',
      drive: drive || null,
      verified: true,
      verifiedBy: req.user.userId,
    });

    res.status(201).json({ outcome: record });
  } catch (err) { next(err); }
});

// PATCH /admin/outcomes/:id — update a placement outcome
router.patch('/outcomes/:id', async (req, res, next) => {
  try {
    const allowed = ['stageReached', 'outcome', 'offerAccepted', 'package', 'notes', 'verified'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (req.body.verified === true) {
      update.verifiedBy = req.user.userId;
    }

    const record = await PlacementOutcome.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ message: 'Outcome not found' });
    res.json({ outcome: record });
  } catch (err) { next(err); }
});

// ── Cohort Intelligence ──────────────────────────────────────────────────
const UserMemory = require('../models/UserMemory');
const PivotPlan = require('../models/PivotPlan');
const AiUsage = require('../models/AiUsage');

// GET /admin/insights/cohort — aggregate cohort intelligence
router.get('/insights/cohort', async (req, res, next) => {
  try {
    const [readiness, skillGaps, activity, plans] = await Promise.all([
      // Average readiness score across students
      UserMemory.aggregate([
        { $match: { readinessScore: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$readinessScore' }, count: { $sum: 1 }, max: { $max: '$readinessScore' }, min: { $min: '$readinessScore' } } },
      ]),
      // Most common strengths and weaknesses across the cohort
      UserMemory.aggregate([
        { $project: { strengths: 1, weaknesses: 1 } },
        { $unwind: { path: '$strengths', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$strengths', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      // Daily active AI users
      AiUsage.aggregate([
        { $group: { _id: '$dateKey', users: { $addToSet: '$user' }, totalCredits: { $sum: '$creditsUsed' } } },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ]),
      // Users with active skill roadmaps
      PivotPlan.aggregate([
        { $match: { 'skillGaps.0': { $exists: true } } },
        { $group: { _id: null, count: { $sum: 1 }, avgGaps: { $avg: { $size: '$skillGaps' } } } },
      ]),
    ]);

    res.json({
      readiness: readiness[0] || null,
      topStrengths: skillGaps.filter((s) => s._id).slice(0, 10),
      topGaps: skillGaps.filter((s) => !s._id).slice(0, 10),
      activity: activity.slice(0, 14),
      roadmapAdoption: plans[0] || null,
    });
  } catch (err) { next(err); }
});

// GET /admin/outcomes/stats — aggregate outcome statistics
router.get('/outcomes/stats', async (req, res, next) => {
  try {
    const stats = await PlacementOutcome.aggregate([
      {
        $group: {
          _id: '$company',
          total: { $sum: 1 },
          offers: { $sum: { $cond: [{ $eq: ['$outcome', 'offer_received'] }, 1, 0] } },
          rejections: { $sum: { $cond: [{ $eq: ['$outcome', 'rejected'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$outcome', 'in_progress'] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 50 },
    ]);
    res.json({ stats });
  } catch (err) { next(err); }
});

// ── Institutional Dashboard ──────────────────────────────────────────────

// GET /admin/institutions — per-institution readiness and analytics
router.get('/institutions', async (req, res, next) => {
  try {
    const userPipeline = [
      { $group: { _id: '$institution', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $sort: { count: -1 } },
    ];
    const usersByInst = await User.aggregate(userPipeline);

    // Readiness by institution
    const readinessByInst = await User.aggregate([
      { $match: { institution: { $ne: null, $ne: '' } } },
      { $lookup: { from: 'usermemories', localField: '_id', foreignField: 'user', as: 'memory' } },
      { $unwind: { path: '$memory', preserveNullAndEmptyArrays: true } },
      { $match: { 'memory.readinessScore': { $exists: true } } },
      { $group: { _id: '$institution', avgReadiness: { $avg: '$memory.readinessScore' }, count: { $sum: 1 } } },
      { $sort: { avgReadiness: -1 } },
    ]);

    res.json({ institutions: usersByInst, readiness: readinessByInst });
  } catch (err) { next(err); }
});

module.exports = router;

