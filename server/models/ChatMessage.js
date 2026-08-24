const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Null only for messages written before conversations existed. The import
    // in scripts/migrateConversations.js adopts those into a single "Earlier
    // chats" conversation, after which every message is scoped.
    //
    // Polymorphic: a message belongs to either a Dax `Conversation` or a
    // `TalentConversation`, resolved by conversationModel via refPath. ChatMessage
    // is deliberately the ONE shared Message model across both surfaces; the
    // conversation containers stay separate so Dax's sidebar/import semantics and
    // Talent's engagement/participant semantics never bleed into each other.
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'conversationModel',
      default: null,
    },
    // Which conversation collection `conversation` points at. Defaults to
    // 'Conversation' so every pre-existing Dax message resolves correctly with
    // no backfill.
    conversationModel: {
      type: String,
      enum: ['Conversation', 'TalentConversation'],
      default: 'Conversation',
    },

    // For a Dax message: 'user' (student) or 'assistant' (model).
    // For a Talent message: always 'user' — both parties are human; the sender
    // is identified by `user`. Kept required so the Dax path is unchanged.
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 8000 },

    // 'dax' (default) preserves every existing message and keeps the AI-quota
    // count (role:'user', channel:'dax') and Dax history reads unchanged.
    // 'talent' marks a peer message in an engagement thread; those MUST be
    // excluded from the AI-chat quota and Dax context by filtering channel:'dax'
    // (see subscription/subscriptionService.getRemainingChatQuota — Phase 2 wiring).
    channel: { type: String, enum: ['dax', 'talent'], default: 'dax', index: true },
  },
  { timestamps: true }
);

// The history window query: one conversation's messages, newest first.
chatMessageSchema.index({ conversation: 1, createdAt: -1 });

// Kept for the daily-quota count, which is deliberately per-user and
// cross-conversation.
chatMessageSchema.index({ user: 1, createdAt: -1 });

// NOTE: a 30-day TTL index used to live here:
//   chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60*60*24*30 });
// It silently deleted server-side history while the localStorage-backed UI
// still listed the conversation, so a month-old chat would open empty with no
// explanation. Now that conversations are durable, user-owned objects, message
// retention is the user's to control via delete — not a background reaper.
//
// Removing the declaration here does NOT drop the index from an existing
// database; Mongo keeps it until dropped explicitly. Run:
//   node server/scripts/migrateConversations.js
// which drops it as part of the migration.

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
