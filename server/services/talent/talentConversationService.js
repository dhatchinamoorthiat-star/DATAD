/**
 * TalentConversationService — peer chat bound to an engagement.
 *
 * Messages are stored as shared ChatMessage rows with channel:'talent' and
 * conversationModel:'TalentConversation' (the container is separate from Dax's
 * Conversation; only the Message model is shared). Because these rows are
 * channel:'talent', they are excluded from the AI-chat quota and Dax context —
 * see subscription/subscriptionService.getRemainingChatQuota.
 *
 * Only the two engagement participants may read or write a thread.
 */

const TalentConversation = require('../../models/TalentConversation');
const ChatMessage = require('../../models/ChatMessage');
const Engagement = require('../../models/Engagement');
const { badRequest, forbidden, notFound } = require('./errors');
const { withTransaction } = require('./tx');

function isParticipant(conv, userId) {
  return conv.participants.some((p) => p.equals(userId));
}

/**
 * Get or create the thread for an engagement. Idempotent — the unique index on
 * TalentConversation.engagement makes a concurrent double-create collapse to
 * one row (the 11000 is caught and the existing thread returned).
 */
async function createConversation(userId, engagementId) {
  const eng = await Engagement.findOne({ _id: engagementId, deletedAt: null });
  if (!eng) throw notFound('Engagement not found');
  if (!eng.requester.equals(userId) && !eng.helper.equals(userId)) {
    throw forbidden('You are not part of this engagement');
  }

  const existing = await TalentConversation.findOne({ engagement: eng._id });
  if (existing) return existing;

  // Create the thread and link it onto the engagement in one transaction (H2):
  // the unique index on TalentConversation.engagement is the race backstop, so a
  // concurrent double-create collapses to one row.
  try {
    return await withTransaction(async (session) => {
      const opts = session ? { session } : {};
      const [conv] = await TalentConversation.create([{
        engagement: eng._id,
        participants: [eng.requester, eng.helper],
      }], { session: session || undefined });
      await Engagement.updateOne(
        { _id: eng._id, conversation: null },
        { $set: { conversation: conv._id } },
        opts
      );
      return conv;
    });
  } catch (err) {
    if (err.code === 11000) return TalentConversation.findOne({ engagement: eng._id });
    throw err;
  }
}

async function loadParticipantConversation(userId, conversationId) {
  const conv = await TalentConversation.findById(conversationId);
  if (!conv) throw notFound('Conversation not found');
  if (!isParticipant(conv, userId)) throw forbidden('You are not in this conversation');
  return conv;
}

async function sendMessage(userId, conversationId, content) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) throw badRequest('Message cannot be empty');
  if (text.length > 8000) throw badRequest('Message is too long');

  const conv = await loadParticipantConversation(userId, conversationId);

  const message = await ChatMessage.create({
    user: userId,
    conversation: conv._id,
    conversationModel: 'TalentConversation',
    role: 'user', // both parties are human; sender is identified by `user`
    channel: 'talent',
    content: text,
  });

  conv.lastMessageAt = message.createdAt;
  conv.preview = text.slice(0, 200);
  conv.messageCount += 1;
  conv.lastReadAt.set(String(userId), message.createdAt); // sender has read their own message
  await conv.save();

  return message;
}

async function markRead(userId, conversationId) {
  const conv = await loadParticipantConversation(userId, conversationId);
  conv.lastReadAt.set(String(userId), new Date());
  await conv.save();
  return { ok: true };
}

async function getMessages(userId, conversationId, { limit = 50, before } = {}) {
  const conv = await loadParticipantConversation(userId, conversationId);
  const query = { conversation: conv._id, channel: 'talent' };
  if (before) query.createdAt = { $lt: new Date(before) };
  const messages = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .lean();
  return messages.reverse(); // oldest-first for display
}

async function listMine(userId) {
  return TalentConversation.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();
}

module.exports = { createConversation, sendMessage, markRead, getMessages, listMine };
