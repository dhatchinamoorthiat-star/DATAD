const mongoose = require('mongoose');

/**
 * The student's normalised LinkedIn profile plus the career target it is being
 * evaluated against. One per user, private to that user.
 *
 * Stored normalised rather than raw so the expensive parse happens on import,
 * not on every analysis. The raw paste is deliberately NOT kept — it is a
 * verbatim copy of a third-party page, it can run to tens of thousands of
 * characters, and nothing downstream reads it once parsing is done. Only a
 * hash is retained, which is enough to skip a re-analysis of unchanged text.
 */

const short = (max = 200) => ({ type: String, maxlength: max, default: '' });
const cap = (limit) => ({
  validator: (a) => !a || a.length <= limit,
  message: `A maximum of ${limit} items is allowed`,
});

// true / false / null, where null means the student was never asked. Consumers
// must treat null as unknown — scoring drops unknown checks rather than
// failing them, so an unanswered question never costs points.
const tri = { type: Boolean, default: null };

const titled = { title: short(300), detail: short(600) };

const linkedInProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // ── Career intent ──────────────────────────────────────────────────────
    // Everything the analysis is measured against. Without a target the score
    // is meaningless, so the controller refuses to analyse until `role` is set.
    target: {
      role: short(120),
      secondaryRole: short(120),
      industry: short(120),
      seniority: { type: String, enum: ['intern', 'entry', 'mid', 'senior', ''], default: '' },
      location: short(120),
      companyType: short(120),
      employmentType: { type: String, enum: ['internship', 'full-time', 'either', ''], default: '' },
      objective: short(500),
      // Whether the target was stated by the student or inferred from their
      // DATAD profile. Inferred targets are shown back for confirmation, and
      // recommendations derived from them carry lower confidence.
      inferred: { type: Boolean, default: false },
    },

    // ── Normalised profile ─────────────────────────────────────────────────
    profile: {
      name: short(120),
      headline: short(300),
      location: short(120),
      about: { type: String, maxlength: 6000, default: '' },
      experience: {
        type: [{
          role: short(200),
          organization: short(200),
          duration: short(80),
          location: short(120),
          employmentType: short(40),
          description: { type: String, maxlength: 4000 },
        }],
        validate: cap(25),
      },
      education: {
        type: [{ institution: short(200), degree: short(200), year: short(60), detail: short(500) }],
        validate: cap(12),
      },
      skills: {
        type: [{ name: short(60), endorsements: { type: Number, min: 0, max: 9999, default: 0 } }],
        validate: cap(60),
      },
      certifications: { type: [titled], validate: cap(30) },
      projects: { type: [titled], validate: cap(20) },
      featured: { type: [titled], validate: cap(10) },
      recommendations: {
        type: [{ recommender: short(120), relationship: short(200), text: { type: String, maxlength: 2000 } }],
        validate: cap(20),
      },
      volunteer: { type: [titled], validate: cap(10) },
      awards: { type: [titled], validate: cap(15) },
      publications: { type: [titled], validate: cap(10) },
      organizations: { type: [titled], validate: cap(10) },
      courses: { type: [short(160)], validate: cap(20) },
      languages: { type: [short(60)], validate: cap(10) },
      links: { type: [{ url: short(300), kind: short(40) }], validate: cap(20) },
      hasPhoto: tri,
      hasBanner: tri,
      hasActivity: tri,
      openToWork: tri,
    },

    source: { type: String, enum: ['paste', 'manual', 'datad'], default: 'paste' },

    // Lets /analyze skip work when nothing changed since the last run. A hash
    // rather than the text itself: it answers the only question we ask of the
    // raw input without keeping a copy of someone's profile page around.
    contentHash: short(64),

    lastAnalyzedAt: Date,
  },
  { timestamps: true }
);

// `unique: true` on `user` already creates the index this model queries by.

module.exports = mongoose.models.LinkedInProfile
  || mongoose.model('LinkedInProfile', linkedInProfileSchema);
