const mongoose = require('mongoose');

// Capped-length string helpers to bound stored size.
const short = (max = 200) => ({ type: String, maxlength: max });
const long = (max = 3000) => ({ type: String, maxlength: max });

// Cap how many items an array field may hold.
const cap = (limit) => ({
  validator: (arr) => !arr || arr.length <= limit,
  message: `A maximum of ${limit} items is allowed`,
});

// One resume per user, private. Sub-schemas are loose on purpose — the editor
// saves drafts, so nothing beyond the owning user is required.
const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    personal: {
      fullName: short(120),
      email: short(120),
      phone: short(30),
      location: short(120),
      linkedin: short(200),
      website: short(200),
    },
    summary: long(2000),
    education: {
      type: [{ degree: short(), institution: short(), year: short(40), score: short(40) }],
      validate: cap(20),
    },
    experience: {
      type: [{ role: short(), organization: short(), duration: short(40), description: long() }],
      validate: cap(20),
    },
    projects: {
      type: [{ title: short(), description: long(), technologies: short(300), link: short() }],
      validate: cap(20),
    },
    skills: { type: [short(60)], validate: cap(50) },
    certifications: {
      type: [{ name: short(), issuer: short(), year: short(20) }],
      validate: cap(30),
    },
    // Objects rather than bare strings: the builder collects a headline and an
    // optional detail line, and the preview renders them differently.
    // controllers/resumeController.js coerces legacy string entries on write.
    achievements: {
      type: [{ title: short(300), description: long(600) }],
      validate: cap(30),
    },
    leadership: {
      type: [{ title: short(300), description: long(600) }],
      validate: cap(30),
    },
    priorExperienceSummary: long(1500),

    // Set when the student explicitly submits (not on every draft save).
    lastSubmittedAt: Date,

    // Throttle key for the confirmation email, deliberately separate from
    // lastSubmittedAt. When one field served both, every submit pushed the
    // window forward — so a student who resubmitted every few minutes silently
    // never received the mail at all.
    lastEmailedAt: Date,
  },
  { timestamps: true }
);

// Removed resumeSchema.index({ user: 1 }); because unique: true already auto-indexes 'user'.

const Resume = mongoose.models.Resume || mongoose.model('Resume', resumeSchema);

module.exports = Resume;