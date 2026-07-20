const mongoose = require('mongoose');

// A recruiter prep card: everything a student needs before that company's
// placement drive, curated by the admin.
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    sector: {
      type: String,
      required: true,
      enum: ['it_services', 'banking', 'fmcg', 'auto', 'consulting', 'manufacturing', 'startup', 'other'],
      index: true,
    },
    logoUrl: { type: String, maxlength: 500 },
    website: { type: String, maxlength: 300 },
    headquarters: { type: String, maxlength: 120 },

    // The prep content
    overview: { type: String, required: true, maxlength: 2000 },
    businessModel: { type: String, maxlength: 2000 },
    whatTheyLookFor: { type: String, maxlength: 1500 },
    salaryRange: { type: String, maxlength: 200 }, // indicative, e.g. "₹4 – 7 LPA (campus)"
    roles: { type: [{ type: String, maxlength: 120 }], default: [] },
    rounds: { type: [{ type: String, maxlength: 300 }], default: [] }, // hiring process steps
    interviewQuestions: {
      type: [
        {
          category: { type: String, enum: ['hr', 'technical', 'case', 'guesstimate'], default: 'hr' },
          question: { type: String, required: true, maxlength: 500 },
        },
      ],
      default: [],
    },
    prepTips: { type: [{ type: String, maxlength: 400 }], default: [] },

    // Program personalization: which programs this company recruits from.
    // Populated by the program sync; empty means "shown to everyone".
    programs: { type: [{ type: String }], default: [], index: true },

    views: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    contentItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentItem' },

    // AI enrichment tracking
    aiEnrichedAt:              { type: Date },
    aiEnrichedBy:              { type: String },
    aiQuestionsGeneratedAt:    { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
