const mongoose = require('mongoose');

// A community discussion post — the atomic unit of the batch social feed.
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    tag: {
      type: String,
      enum: ['question', 'update', 'resource', 'win', 'help', 'general'],
      default: 'general',
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // ⭐ Program Personalization
    program: { type: String, default: null },     // Program ID this post belongs to
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    replyCount: { type: Number, default: 0 },
    type: { type: String, enum: ['text', 'photo', 'poll', 'achievement'], default: 'text' },
    tags: [{ type: String, trim: true }],
    imageUrl: { type: String, trim: true },
    pollOptions: [{ text: String, votes: { type: Number, default: 0 } }],
    pinned:              { type: Boolean, default: false },
    // AI moderation
    hidden:              { type: Boolean, default: false },
    hiddenReason:        { type: String },
    flaggedForReview:    { type: Boolean, default: false },
    aiModeratedAt:       { type: Date },
    aiModerationScores:  { spam: Number, hate: Number, advertising: Number, lowQuality: Number },
    aiModerationResult:  { type: String, enum: ['approve', 'review', 'hide'] },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
