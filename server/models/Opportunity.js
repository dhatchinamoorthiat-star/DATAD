const mongoose = require('mongoose');

/**
 * Opportunity — the canonical unit of the Talent Exchange pillar.
 *
 * Supersedes the thin SkillListing (a person offering one skill) with a
 * stateful, lifecycle-bearing entity that Applications and Engagements hang
 * off. SkillListing rows are migrated here as { kind: 'offer' } by
 * scripts/migrateSkillListings.js; MarketListing (goods resale) is a different
 * domain and is deliberately NOT folded in.
 *
 * `kind`:
 *   need_help     — requester needs help (may pay Talent Credits)
 *   collaborator  — looking for a collaborator / team (usually unpaid)
 *   offer         — a helper advertising a service (migrated SkillListings)
 */
const OPPORTUNITY_KINDS = ['need_help', 'collaborator', 'offer'];

const OPPORTUNITY_CATEGORIES = [
  'tutoring',
  'resume_review',
  'mock_interview',
  'coding_help',
  'assignment_help',
  'research',
  'design',
  'club_work',
  'team_formation',
  'mentoring',
];

// Visibility default is 'public' (all programs) per Phase 0 decision D2, with
// program/private retained as opt-in scopes.
const OPPORTUNITY_VISIBILITY = ['public', 'program', 'private'];

const OPPORTUNITY_URGENCY = ['low', 'normal', 'high', 'urgent'];

// Status machine. Legal transitions are enforced in opportunityService, not
// here — the enum only guards the set of valid states.
//   draft → open → matched → in_progress → completed
//   open/matched → cancelled ; open → expired
const OPPORTUNITY_STATUS = [
  'draft',
  'open',
  'matched',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
];

// Who an opportunity belongs to. `student` is the only owner type that exists
// today; the rest are future first-class posters (a club recruiting members, a
// company posting a paid gig, faculty seeking research help, an alumnus
// mentoring). Modelled now so controllers, matching and reputation never assume
// "owner == a User" — they read ownerType and, for non-student owners, ownerRef.
const OPPORTUNITY_OWNER_TYPES = ['student', 'club', 'organization', 'company', 'faculty', 'alumni'];

const opportunitySchema = new mongoose.Schema(
  {
    // The acting human: who posted it and is the point of contact / auth
    // subject. Always present, even for org-owned opportunities (the authorised
    // poster), so ownership checks and notifications have a real user to target.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    ownerType: { type: String, enum: OPPORTUNITY_OWNER_TYPES, default: 'student', index: true },
    // The owning entity when ownerType !== 'student'. Kept as a loose ref
    // (ObjectId + model name) rather than a hard `ref` because Club/Organization/
    // Company/Faculty/Alumni models do not exist yet — this reserves the shape
    // without a dangling populate target. Resolve via ownerModel when those land.
    ownerRef: { type: mongoose.Schema.Types.ObjectId, default: null },
    ownerModel: { type: String, default: null },
    // Display fields denormalised so feeds render org-owned opportunities
    // without a second collection to join before those models exist.
    ownerName: { type: String, trim: true, maxlength: 120, default: null },
    ownerAvatarUrl: { type: String, trim: true, maxlength: 500, default: null },

    kind: { type: String, enum: OPPORTUNITY_KINDS, required: true },
    category: { type: String, enum: OPPORTUNITY_CATEGORIES, required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },

    // Detected (Dax) + requester-confirmed skills. Lowercased on write by the
    // service layer so overlap scoring in the matching engine is case-stable.
    skills: { type: [{ type: String, trim: true, maxlength: 40 }], default: [], index: true },

    estDurationMin: { type: Number, min: 0, max: 60 * 24 * 30, default: null },

    // Talent Credits (see CreditLedger). 0 for pure collaboration.
    priceCredits: { type: Number, min: 0, default: 0 },
    // Immutable audit of Dax's original suggestion, for measuring accept-rate.
    priceSuggested: { type: Number, min: 0, default: null },

    urgency: { type: String, enum: OPPORTUNITY_URGENCY, default: 'normal' },

    status: { type: String, enum: OPPORTUNITY_STATUS, default: 'draft', index: true },

    visibility: { type: String, enum: OPPORTUNITY_VISIBILITY, default: 'public' },
    // Program slug (User.program.id) — only meaningful when visibility='program'.
    program: { type: String, default: null },

    // team_formation and group tutoring can accept more than one helper.
    slotsTotal: { type: Number, min: 1, default: 1 },
    slotsFilled: { type: Number, min: 0, default: 0 },

    // Dax-derived metadata. Facts only — never the compatibility number, which
    // is computed deterministically by the matching engine.
    daxMeta: {
      effortScore: { type: Number, default: null },
      riskScore: { type: Number, default: null },
      skillsDetected: { type: [String], default: [] },
      modelVersion: { type: String, default: null },
    },

    // Provenance for the one-time SkillListing migration; unique+sparse makes
    // the backfill idempotent (a re-run matches instead of duplicating).
    legacySkillListingId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Soft delete — nothing in Talent Exchange is hard-deleted, so reputation
    // and ledger history stay auditable.
    deletedAt: { type: Date, default: null, index: true },

    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Discover feed: newest open opportunities in a category.
opportunitySchema.index({ status: 1, category: 1, createdAt: -1 });
// Program-scoped visibility queries.
opportunitySchema.index({ visibility: 1, program: 1, status: 1 });
// Idempotent migration guard.
opportunitySchema.index(
  { legacySkillListingId: 1 },
  { unique: true, partialFilterExpression: { legacySkillListingId: { $type: 'objectId' } } }
);
// Full-text discovery over the human-authored fields.
opportunitySchema.index({ title: 'text', description: 'text', skills: 'text' });

module.exports = mongoose.model('Opportunity', opportunitySchema);
module.exports.OPPORTUNITY_KINDS = OPPORTUNITY_KINDS;
module.exports.OPPORTUNITY_OWNER_TYPES = OPPORTUNITY_OWNER_TYPES;
module.exports.OPPORTUNITY_CATEGORIES = OPPORTUNITY_CATEGORIES;
module.exports.OPPORTUNITY_VISIBILITY = OPPORTUNITY_VISIBILITY;
module.exports.OPPORTUNITY_URGENCY = OPPORTUNITY_URGENCY;
module.exports.OPPORTUNITY_STATUS = OPPORTUNITY_STATUS;
