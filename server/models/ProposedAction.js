const mongoose = require('mongoose');

/**
 * A write that Dax has proposed but has NOT performed.
 *
 * The central safety property of the write-tool design: a write tool does not
 * write. When the model calls one, the server records a proposal here and
 * returns "awaiting confirmation" — nothing is mutated. The mutation happens
 * only when the student clicks Confirm, which hits an ordinary authenticated
 * endpoint that re-validates everything and does not trust model output at all.
 *
 * That matters concretely: the default chat model (llama-3.1-8b-instruct) has
 * been observed duplicating a tool call and sending a boolean as the string
 * "false" in a single turn. Without this indirection, either mistake would
 * become a real row in the database. With it, the worst a hallucinated tool
 * call can produce is a card the student dismisses.
 *
 * The client confirms by proposal id and never sends a payload, so the
 * arguments cannot be tampered with between proposal and execution — they live
 * server-side from the moment they are proposed.
 */

// One concrete mutation. Proposals hold an array of these because a single
// student intent ("reschedule all three around Thursday") must present as one
// card with one Confirm, not three separate cards. Modelling this as an array
// from the start avoids a migration later.
const actionSchema = new mongoose.Schema(
  {
    tool: {
      type: String,
      required: true,
      enum: ['create_task', 'reschedule_task', 'complete_task'],
    },

    // Validated at propose time, so a malformed tool call never reaches a card.
    args: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Human-readable line rendered on the confirm card. Built server-side from
    // validated args rather than taken from the model, so the student is shown
    // what will actually happen — not what the model claims will happen.
    summary: { type: String, default: '', maxlength: 300 },

    // Past-tense wording shown once the action has executed.
    doneSummary: { type: String, default: '', maxlength: 300 },

    // Existing document this action mutates (null for creates).
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Captured at execution time, not proposal time — the record could change
    // in between, and undo must restore what was actually overwritten.
    priorState: { type: mongoose.Schema.Types.Mixed, default: null },

    // Document produced by a create, so undo knows what to remove.
    resultId: { type: mongoose.Schema.Types.ObjectId, default: null },

    status: {
      type: String,
      enum: ['pending', 'executed', 'failed', 'undone'],
      default: 'pending',
    },
    error: { type: String, default: null },
  },
  { _id: true }
);

const proposedActionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Which conversation proposed this, so the card can be re-rendered when a
    // thread is reopened on another device.
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },

    actions: {
      type: [actionSchema],
      validate: [(v) => v.length > 0 && v.length <= 10, 'a proposal must contain 1-10 actions'],
    },

    status: {
      type: String,
      // 'confirming' is a short-lived lock, not a user-visible state: confirm
      // transitions pending -> confirming atomically so two concurrent clicks
      // (or a double-fire from the client) cannot both execute the writes.
      enum: ['pending', 'confirming', 'executed', 'partial', 'rejected', 'expired', 'undone'],
      default: 'pending',
      index: true,
    },

    // A proposal the student never answered should not be confirmable days
    // later, when the advice that produced it is stale. Enforced in code as
    // well as by the TTL below, since TTL removal is only approximately timely.
    expiresAt: { type: Date, required: true },

    executedAt: { type: Date, default: null },
    // Undo is only offered for a window after execution; past it, the action is
    // treated as a normal part of the student's data.
    undoableUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// Sweep answered/abandoned proposals. Deliberately keyed on expiresAt rather
// than createdAt so an executed proposal's undo window is never cut short.
proposedActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

// The "does this conversation have a live card?" lookup.
proposedActionSchema.index({ user: 1, conversation: 1, status: 1 });

module.exports = mongoose.model('ProposedAction', proposedActionSchema);
