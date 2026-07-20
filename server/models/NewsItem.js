const mongoose = require('mongoose');

// A live news article pulled from an RSS feed and cached here.
// AI-framing fields are left empty for now (Phase 2 when an LLM key is added).
const newsItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 400 },
    summary: { type: String, maxlength: 2000 },
    link: { type: String, required: true, unique: true, maxlength: 800 },
    source: { type: String, maxlength: 120 },
    category: { type: String, required: true, index: true },
    publishedAt: { type: Date, index: true },

    // ⭐ Program Personalization
    programs: [{ type: String }],  // Program IDs this article is relevant to

    // Reserved for the future AI enhancement layer.
    whyItMatters: String,
    concepts: [String],
    industries: [String],
    interviewRelevance: String,
    keyTakeaways: [String],
    interviewQuestions: [String],
    businessTerms: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('NewsItem', newsItemSchema);
