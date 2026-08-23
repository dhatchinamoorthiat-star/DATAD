const mongoose = require('mongoose');

const newsletterDraftSchema = new mongoose.Schema({
  weekStart:  { type: String, required: true, unique: true }, // YYYY-MM-DD (Monday)
  subject:    { type: String, required: true },
  preheader:  { type: String },
  headline:   { type: String },
  intro:      { type: String },
  sections:   { type: Object },
  closingNote:{ type: String },
  sentAt:     { type: Date },
  recipientCount: { type: Number, default: 0 },
  generatedBy:{ type: String },
  model:      { type: String },
  tokensUsed: { type: Number },
  /**
   * `draft`    generated, passed validation, waiting for an admin to approve.
   * `blocked`  failed newsletterGuard. Terminal — sendDraft() will not mail it
   *            at any approval level; it must be regenerated.
   * `refused`  every provider declined, and the chain deliberately did not keep
   *            shopping for one that would.
   * `sent`     an admin approved it and the fan-out completed.
   * `failed`   an admin approved it and the mail transport failed.
   */
  status:     { type: String, enum: ['draft', 'blocked', 'refused', 'sent', 'failed'], default: 'draft' },
  /** Why it was blocked or refused, in a form an admin can act on. */
  guardNotes: { type: String },
  /** Who released it. Recorded because "nobody approved this" was the H4 bug. */
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('NewsletterDraft', newsletterDraftSchema);
