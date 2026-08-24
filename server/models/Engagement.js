const mongoose = require('mongoose');

/**
 * Engagement — the stateful unit of work created when an Application is
 * accepted. This is where Talent Credits are escrowed and where reputation is
 * earned: nothing about a student's trust score changes until an Engagement
 * reaches 'completed'.
 *
 * Status machine (enforced in engagementService):
 *   accepted → in_progress → delivered → completed
 *   any active → cancelled (→ refund) ; delivered/in_progress → disputed
 */
const ENGAGEMENT_STATUS = [
  'accepted',
  'in_progress',
  'delivered',
  'completed',
  'disputed',
  'cancelled',
  'refunded',
];

const engagementSchema = new mongoose.Schema(
  {
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },

    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    helper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Denormalised so reputation/analytics can group without a join.
    category: { type: String, required: true },

    // Immutable snapshot of the opportunity terms AS AGREED at acceptance time.
    // The parent Opportunity can be edited or deleted afterwards; disputes,
    // reputation and the ledger must be judged against what both sides actually
    // agreed to, so these fields are `immutable: true` — Mongoose silently
    // ignores later writes to them. This is the source of truth for the deal,
    // not the live Opportunity.
    snapshot: {
      title: { type: String, required: true, maxlength: 120, immutable: true },
      scope: { type: String, required: true, maxlength: 4000, immutable: true },
      priceCredits: { type: Number, min: 0, required: true, immutable: true },
      skills: { type: [String], default: [], immutable: true },
      category: { type: String, required: true, immutable: true },
      capturedAt: { type: Date, default: Date.now, immutable: true },
    },

    // The agreed, escrowed price. Equals snapshot.priceCredits at creation and,
    // like it, is never renegotiated on an existing engagement.
    priceCredits: { type: Number, min: 0, required: true, immutable: true },
    // The CreditLedger 'hold' entry that escrows this engagement's credits.
    escrowLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditLedger', default: null },

    status: { type: String, enum: ENGAGEMENT_STATUS, default: 'accepted' },

    milestones: [
      {
        title: { type: String, trim: true, maxlength: 200 },
        done: { type: Boolean, default: false },
        doneAt: { type: Date, default: null },
      },
    ],
    deliverables: [
      {
        label: { type: String, trim: true, maxlength: 200 },
        url: { type: String, trim: true, maxlength: 500 },
        at: { type: Date, default: Date.now },
      },
    ],

    dueAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Dax prediction (0..1), refreshed by a worker. Advisory only.
    completionRisk: { type: Number, min: 0, max: 1, default: null },

    // Peer chat thread for this engagement. Its messages are shared ChatMessage
    // rows (channel:'talent'); the container is a dedicated TalentConversation.
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'TalentConversation', default: null },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One engagement per accepted application — the race-safe backstop against the
// double-accept path (audit C1). Partial so the many engagements without an
// application (e.g. future direct/offer flows, where it stays null) stay legal.
engagementSchema.index(
  { application: 1 },
  { unique: true, partialFilterExpression: { application: { $type: 'objectId' } } }
);
// "My work" views for each side, by status.
engagementSchema.index({ helper: 1, status: 1, updatedAt: -1 });
engagementSchema.index({ requester: 1, status: 1, updatedAt: -1 });
// Overdue sweep by the scheduler.
engagementSchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.model('Engagement', engagementSchema);
module.exports.ENGAGEMENT_STATUS = ENGAGEMENT_STATUS;
