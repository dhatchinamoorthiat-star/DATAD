const router = require('express').Router();
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

const { TIERS } = require('../subscription/tierHierarchy');

const VALID_TIERS = TIERS;

// Paid plans run for exactly one month from activation; trials for 14 days.
const oneMonthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};
const sevenDaysFromNow = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// List all subscription requests
router.get('/subscriptions', async (req, res, next) => {
  try {
    const status = req.query.status; // pending | approved | rejected | (all)
    const filter = status ? { status } : {};
    const requests = await SubscriptionRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'name email tier')
      .lean();
    res.json(requests);
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
    else patch.tierExpiresAt = oneMonthFromNow(); // pro/max default to one month

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

    sr.status = action === 'approve' ? 'approved' : 'rejected';
    sr.reviewedBy = req.user.userId;
    sr.reviewedAt = new Date();
    sr.reviewNote = reviewNote || '';
    await sr.save();

    // If approved, upgrade the user's tier automatically
    if (action === 'approve') {
      const expiresAt = oneMonthFromNow(); // paid plans run for exactly one month
      await User.findByIdAndUpdate(sr.user._id, {
        $set: { tier: sr.tier, subscriptionRef: sr.paymentRef, tierExpiresAt: expiresAt },
      });
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
      max: 0,
    };

    // Active subscriptions (not expired)
    const activeCount = {
      trial: 0,
      pro: 0,
      max: 0,
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
          if (user.tier === 'pro') estimatedMrr += proAnnualPrice / 12;
          if (user.tier === 'max') estimatedMrr += maxAnnualPrice / 12;
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
        max: tierCount.max,
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


// Public meta — any member can read the placement date for the countdown.
module.exports = router;

