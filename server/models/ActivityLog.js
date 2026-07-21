const mongoose = require('mongoose');

// Append-only feed of membership events, shown in the Admin Console.
const activityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'register_pending',
        'register_referral',
        'register_admin',
        'register_program_pending',
        'register_program_auto_approved',
        'approved',
        'rejected',
        'password_reset_requested',
        'password_reset_done',
        'account_deleted',
      ],
      index: true,
    },
    message: { type: String, required: true, maxlength: 300 },
    // Snapshot names/emails as strings so log lines survive account deletion.
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
