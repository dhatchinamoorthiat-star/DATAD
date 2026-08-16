/**
 * Engagement controller — thin. Participant checks and status transitions are
 * enforced in engagementService / moderationService.
 */
const engagementService = require('../../services/talent/engagementService');
const moderationService = require('../../services/talent/moderationService');

exports.listMine = async (req, res, next) => {
  try {
    res.json(await engagementService.listMine(req.user.userId, {
      role: req.query.role,
      status: req.query.status,
    }));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    res.json(await engagementService.getById(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.start = async (req, res, next) => {
  try {
    res.json(await engagementService.start(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.submit = async (req, res, next) => {
  try {
    res.json(await engagementService.submit(req.user.userId, req.params.id, req.body));
  } catch (err) { next(err); }
};

exports.complete = async (req, res, next) => {
  try {
    res.json(await engagementService.complete(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    res.json(await engagementService.cancel(req.user.userId, req.params.id, req.body));
  } catch (err) { next(err); }
};

exports.dispute = async (req, res, next) => {
  try {
    const result = await moderationService.freeze(req.user.userId, req.params.id, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};
