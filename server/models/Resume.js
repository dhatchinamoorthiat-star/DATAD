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
      type: [{ degree: short(), institution: short(), years: short(40), score: short(40) }],
      validate: cap(20),
    },
    experience: {
      type: [{ role: short(), organization: short(), duration: short(40), description: long() }],
      validate: cap(20),
    },
    projects: {
      type: [{ title: short(), description: long(), link: short() }],
      validate: cap(20),
    },
    skills: { type: [short(60)], validate: cap(50) },
    certifications: {
      type: [{ name: short(), issuer: short(), year: short(20) }],
      validate: cap(30),
    },
    achievements: { type: [short(300)], validate: cap(30) },
    leadership: { type: [short(300)], validate: cap(30) },
    priorExperienceSummary: long(1500),
  },
  { timestamps: true }
);

// Removed resumeSchema.index({ user: 1 }); because unique: true already auto-indexes 'user'.

const Resume = mongoose.models.Resume || mongoose.model('Resume', resumeSchema);

module.exports = Resume;