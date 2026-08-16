/**
 * Review controller — thin. Completed-engagement + participant + single-review
 * rules live in reviewService.
 */
const reviewService = require('../../services/talent/reviewService');

exports.create = async (req, res, next) => {
  try {
    const review = await reviewService.create(req.user.userId, req.body.engagementId, req.body);
    res.status(201).json(review);
  } catch (err) { next(err); }
};

exports.listForUser = async (req, res, next) => {
  try {
    res.json(await reviewService.listForUser(req.params.userId, { limit: req.query.limit }));
  } catch (err) { next(err); }
};
