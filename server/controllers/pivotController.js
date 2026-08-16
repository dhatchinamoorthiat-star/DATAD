const PivotPlan = require('../models/PivotPlan');
const roadmapService = require('../services/roadmapService');

exports.get = async (req, res, next) => {
  try {
    let plan = await PivotPlan.findOne({ user: req.user.userId });
    if (!plan) plan = await PivotPlan.create({ user: req.user.userId });
    res.json(plan);
  } catch (err) { next(err); }
};

exports.upsert = async (req, res, next) => {
  try {
    const allowed = [
      'planType', 'fromDomain', 'fromRole', 'fromYears',
      'toDomain', 'toRole', 'motivation', 'skillGaps',
      'targetCompanies', 'currentSkills',
    ];
    const update = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    const plan = await PivotPlan.findOneAndUpdate(
      { user: req.user.userId },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(plan);
  } catch (err) { next(err); }
};

exports.updateGap = async (req, res, next) => {
  try {
    const { status } = req.body;
    const plan = await PivotPlan.findOne({ user: req.user.userId });
    if (!plan) return res.status(404).json({ message: 'No pivot plan found' });
    const gap = plan.skillGaps.id(req.params.gapId);
    if (!gap) return res.status(404).json({ message: 'Skill gap not found' });
    gap.status = status;
    await plan.save();
    res.json(plan);
  } catch (err) { next(err); }
};

/**
 * POST /api/pivot/generate-roadmap
 * Generates a 3-month skill roadmap using the existing student data context.
 */
exports.generateRoadmap = async (req, res, next) => {
  try {
    const { targetRole, additionalContext } = req.body;
    const result = await roadmapService.generateRoadmap(req.user.userId, {
      targetRole,
      additionalContext,
    });
    res.json(result);
  } catch (err) {
    if (err.message.includes('A target role is required')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/pivot/progress
 * Returns roadmap completion progress.
 */
exports.getProgress = async (req, res, next) => {
  try {
    const progress = await roadmapService.getProgress(req.user.userId);
    res.json(progress);
  } catch (err) { next(err); }
};
