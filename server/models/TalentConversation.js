const mongoose = require('mongoose');

/**
 * TalentConversation — the peer-chat thread for a Talent Exchange engagement.
 *
 * Kept separate from Dax's `Conversation` deliberately (Phase 0 decision D3,
 * finalised in the pre-Phase-2 schema review): the two containers have nothing
 * in common semantically. Dax's Conversation is single-owner with localStorage
 * import (`clientId`), a pinnable/foldered sidebar and an assistant transcript;
 * a TalentConversation is a two-human thread bound to an engagement.
 *
 * The *messages*, however, ARE shared — both surfaces write `ChatMessage` rows
 * (the one Message model), distinguished by `channel` and pointed here via
 * ChatMessage.conversationModel = 'TalentConversation'. This gives one message
 * store without conflating the two conversation types.
 */
const talentConversationSchema = new mongoose.Schema(
  {
    engagement: { type: mongoose.Schema.Types.ObjectId, ref: 'Engagement', required: true, unique: true },

    // Exactly the two students in the engagement (requester + helper). Used to
    // authorise reads/writes and to render the thread header.
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],

    // Denormalised from the newest talent ChatMessage so an engagement list can
    // preview/sort without a per-thread aggregation.
    lastMessageAt: { type: Date, default: Date.now, index: true },
    preview: { type: String, default: '', maxlength: 200 },
    messageCount: { type: Number, default: 0 },

    // Per-participant unread bookkeeping (userId → last-read timestamp).
    lastReadAt: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

// A participant's threads, most recent activity first.
talentConversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model('TalentConversation', talentConversationSchema);
