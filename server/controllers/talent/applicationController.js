/**
 * Application controller — thin. Ownership/duplicate/transition rules all live
 * in applicationService.
 */
const applicationService = require('../../services/talent/applicationService');

exports.listMine = async (req, res, next) => {
  try {
    res.json(await applicationService.listMine(req.user.userId));
  } catch (err) { next(err); }
};

exports.withdraw = async (req, res, next) => {
  try {
    res.json(await applicationService.withdraw(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};

exports.accept = async (req, res, next) => {
  try {
    const result = await applicationService.accept(req.user.userId, req.params.id, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    res.json(await applicationService.reject(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};
