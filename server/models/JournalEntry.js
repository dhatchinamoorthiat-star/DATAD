const mongoose = require('mongoose');

// Personal reflection journal — each user's private space for processing emotions,
// tracking mood, and recording personal thoughts. Never exposed to admin, Dax, or other users.
const journalEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
    mood: {
      type: String,
      enum: ['great', 'good', 'okay', 'low', 'rough'],
      default: 'good',
    },
    entryDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
