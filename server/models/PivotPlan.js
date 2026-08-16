const mongoose = require('mongoose');

// Distinguishes a career pivot from a skill roadmap.
// - 'pivot':     from one domain/role to another (original use case).
// - 'roadmap':   first-time job seeker building toward a target role.
const PLAN_TYPES = ['pivot', 'roadmap'];

// Defines the kind of work an item represents, so the UI can render an
// appropriate link out (to a course, project, mentorship session, etc.).
const ITEM_TYPES = ['course', 'project', 'mentorship', 'certification', 'reading', 'practice', 'other'];

const skillGapItemSchema = new mongoose.Schema({
  skill:  { type: String, trim: true, maxlength: 100 },
  status: { type: String, enum: ['not-started', 'in-progress', 'done'], default: 'not-started' },
  // Optional enrichment for roadmap items — keeps the schema additive so
  // existing pivot documents are unmodified.
  itemType: { type: String, enum: ITEM_TYPES },
  link:     { type: String, trim: true, maxlength: 500 },
  notes:    { type: String, trim: true, maxlength: 1000 },
  sortOrder: { type: Number, default: 0 },
});

const pivotPlanSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  planType:         { type: String, enum: PLAN_TYPES, default: 'pivot' },

  // ── Pivot fields (relevant when planType === 'pivot') ───────────
  fromDomain:       { type: String, trim: true, maxlength: 80 },
  fromRole:         { type: String, trim: true, maxlength: 120 },
  fromYears:        { type: Number, min: 0, max: 40 },

  // ── Common fields (relevant for both 'pivot' and 'roadmap') ─────
  toDomain:         { type: String, trim: true, maxlength: 80 },
  toRole:           { type: String, trim: true, maxlength: 120 },
  motivation:       { type: String, trim: true, maxlength: 2000 },
  skillGaps:        [skillGapItemSchema],
  targetCompanies:  [{ type: String, trim: true, maxlength: 100 }],

  // ── Roadmap-only fields (ignored when planType === 'pivot') ──────
  // The skills the student already has when the roadmap is generated.
  currentSkills:    [{ type: String, trim: true, maxlength: 80 }],
}, { timestamps: true });



module.exports = mongoose.model('PivotPlan', pivotPlanSchema);
module.exports.PLAN_TYPES = PLAN_TYPES;
module.exports.ITEM_TYPES = ITEM_TYPES;
