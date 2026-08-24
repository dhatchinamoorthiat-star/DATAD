const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'reaction', 'rsvp', 'placement_apply', 'mention', 'announcement', 'general',
        'task', 'milestone', 'subscription', 'career_alert', 'ai_complete', 'ai_error',
        'credit_alert', 'billing', 'system', 'session', 'suggestion',
      ],
      default: 'general',
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    link: { type: String, trim: true },
    read: { type: Boolean, default: false },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    groupCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
