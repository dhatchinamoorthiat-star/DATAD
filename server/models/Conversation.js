const mongoose = require('mongoose');

/**
 * A named Dax conversation.
 *
 * Before this existed, ChatMessage carried only a `user` reference, so the
 * server held one flat undifferentiated stream per student while the client
 * showed a sidebar of separate conversations kept in localStorage. Switching
 * conversations in the UI therefore did not change what the model saw, and
 * nothing synced across devices. This model is the server-side object the
 * frontend was already pretending existed.
 */
const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Client-generated id from the pre-migration localStorage records. Kept so
    // the one-time import is idempotent: re-running it (a second device, a
    // retried request, a refresh mid-import) matches on this instead of
    // creating duplicate conversations. Sparse because conversations created
    // natively on the server after the migration have no client id.
    clientId: { type: String, default: null },

    title: { type: String, default: '', maxlength: 200, trim: true },
    pinned: { type: Boolean, default: false },
    folderId: { type: String, default: null },

    // Denormalised from the newest ChatMessage so the sidebar can sort and
    // preview without a per-conversation aggregation on every list request.
    lastMessageAt: { type: Date, default: Date.now, index: true },
    preview: { type: String, default: '', maxlength: 200 },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Sidebar query: a user's conversations, newest activity first.
conversationSchema.index({ user: 1, lastMessageAt: -1 });

// Idempotency guard for the localStorage import. Partial rather than sparse so
// that many server-native conversations (clientId: null) per user stay legal
// while any given client id can only ever be imported once.
conversationSchema.index(
  { user: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

module.exports = mongoose.model('Conversation', conversationSchema);
