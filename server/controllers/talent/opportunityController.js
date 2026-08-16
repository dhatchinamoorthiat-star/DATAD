/**
 * Opportunity controller — thin. Validates presence at the HTTP edge, passes
 * the authenticated user through, delegates every rule to opportunityService.
 */
const opportunityService = require('../../services/talent/opportunityService');
const applicationService = require('../../services/talent/applicationService');
const moderationService = require('../../services/talent/moderationService');

exports.list = async (req, res, next) => {
  try {
    const items = await opportunityService.list(req.user, {
      category: req.query.category,
      kind: req.query.kind,
      status: req.query.status,
      mine: req.query.mine === 'true',
      limit: req.query.limit,
      skip: req.query.skip,
    });
    res.json(items);
  } catch (err) { next(err); }
};

exports.search = async (req, res, next) => {
  try {
    res.json(await opportunityService.search(req.user, { q: req.query.q, limit: req.query.limit }));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const opp = await opportunityService.create(req.user.userId, req.user, req.body);
    res.status(201).json(opp);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    res.json(await opportunityService.getById(req.user, req.params.id));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    res.json(await opportunityService.update(req.user.userId, req.params.id, req.body));
  } catch (err) { next(err); }
};

exports.publish = async (req, res, next) => {
  try {
    res.json(await opportunityService.publish(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.close = async (req, res, next) => {
  try {
    res.json(await opportunityService.close(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.archive = async (req, res, next) => {
  try {
    await opportunityService.archive(req.user.userId, req.params.id);
    res.json({ message: 'Archived' });
  } catch (err) { next(err); }
};

exports.listApplications = async (req, res, next) => {
  try {
    res.json(await applicationService.listForOpportunity(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.apply = async (req, res, next) => {
  try {
    const app = await applicationService.apply(req.user, req.params.id, req.body);
    res.status(201).json(app);
  } catch (err) { next(err); }
};

exports.report = async (req, res, next) => {
  try {
    const c = await moderationService.report(req.user.userId, {
      subjectType: 'opportunity',
      subjectId: req.params.id,
      reason: req.body.reason,
    });
    res.status(201).json({ message: 'Reported', id: c._id });
  } catch (err) { next(err); }
};
