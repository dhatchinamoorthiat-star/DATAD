const mongoose = require('mongoose');

const dailyBriefingSchema = new mongoose.Schema({
  dateKey: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  headline: { type: String, required: true },
  sections: {
    market:      { type: String },
    finance:     { type: String },
    consulting:  { type: String },
    technology:  { type: String },
    operations:  { type: String },
    economy:     { type: String },
    placements:  { type: String },
    leadership:  { type: String },
  },
  interviewTip:  { type: String },
  keyNumbers:    [{ type: String }],
  mustKnowTerm:  { term: String, definition: String },
  generatedBy:   { type: String }, // provider name
  model:         { type: String },
  tokensUsed:    { type: Number },
  confidence:    { type: Number, default: 0.8 },
  status:        { type: String, enum: ['published', 'pending_review', 'failed'], default: 'published' },

  // ⭐ Program Personalization
  programs:      [{ type: String }], // Program-specific briefings (can be empty for general)
}, { timestamps: true });

module.exports = mongoose.model('DailyBriefing', dailyBriefingSchema);
