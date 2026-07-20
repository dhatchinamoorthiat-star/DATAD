const mongoose = require('mongoose');

const programApprovalSchema = new mongoose.Schema(
  {
    // Program info
    programId: { type: String, required: true },                           // 'mba', 'custom-xyz'
    programLabel: { type: String, required: true },                        // 'MBA', 'Fashion Design'
    programType: { type: String, enum: ['preset', 'custom'], required: true },

    // Request info
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },

    // Approval info
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    // Data sync tracking
    syncStatus: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
    syncStartedAt: { type: Date, default: null },
    syncCompletedAt: { type: Date, default: null },
    syncLog: [
      {
        // Must stay in step with STEPS in services/programSyncService.js —
        // a step missing from this enum fails the whole sync on save.
        component: {
          type: String,
          enum: ['registry', 'news', 'companies', 'career', 'community', 'study'],
        },
        status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'] },
        count: { type: Number, default: 0 },
        error: { type: String, default: null },
        completedAt: { type: Date, default: null },
      },
    ],

    // Email notification
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for querying pending approvals
programApprovalSchema.index({ status: 1, createdAt: -1 });
programApprovalSchema.index({ requestedBy: 1 });
programApprovalSchema.index({ programId: 1 });

module.exports = mongoose.model('ProgramApproval', programApprovalSchema);
