/**
 * Talent conversation controller — thin. Participant-only access is enforced in
 * talentConversationService.
 */
const conversationService = require('../../services/talent/talentConversationService');

exports.listMine = async (req, res, next) => {
  try {
    res.json(await conversationService.listMine(req.user.userId));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const conv = await conversationService.createConversation(req.user.userId, req.body.engagementId);
    res.status(201).json(conv);
  } catch (err) { next(err); }
};

exports.getMessages = async (req, res, next) => {
  try {
    res.json(await conversationService.getMessages(req.user.userId, req.params.id, {
      limit: req.query.limit,
      before: req.query.before,
    }));
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const message = await conversationService.sendMessage(req.user.userId, req.params.id, req.body.content);
    res.status(201).json(message);
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    res.json(await conversationService.markRead(req.user.userId, req.params.id));
  } catch (err) { next(err); }
};
