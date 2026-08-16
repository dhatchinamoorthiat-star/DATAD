#!/usr/bin/env node
/**
 * SkillListing → Opportunity migration.
 *
 * Idempotent — safe to run repeatedly and safe against an already-migrated
 * database. Each source SkillListing becomes one Opportunity{ kind:'offer' },
 * carrying `legacySkillListingId` so a re-run matches the existing row (via the
 * unique partial index on Opportunity.legacySkillListingId) instead of
 * duplicating it.
 *
 * Mapping (see docs/talent-exchange-phase0.md §3.1):
 *   skill        → title + skills[]
 *   description  → description
 *   mode         → (retained on daxMeta-free note; delivery handled later)
 *   tags         → skills[]
 *   user         → user
 *   kind         = 'offer' ; status = 'open' ; visibility = 'public'
 *   contact      → DROPPED (peer contact moves in-app; PII hardening)
 *
 * SkillRating rows are intentionally NOT migrated into TalentReview (they have
 * no Engagement). A later reputation seed reads them into TalentProfile.
 *
 * Dry run (default):  node server/scripts/migrateSkillListings.js
 * Apply:              node server/scripts/migrateSkillListings.js --apply
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

function norm(s) {
  return typeof s === 'string' ? s.trim() : '';
}

// Lowercase, de-duplicate skill tokens so the matching engine's overlap scoring
// is case-stable.
function toSkills(...parts) {
  const seen = new Set();
  for (const p of parts) {
    if (Array.isArray(p)) p.forEach((x) => norm(x) && seen.add(norm(x).toLowerCase()));
    else if (norm(p)) seen.add(norm(p).toLowerCase());
  }
  return [...seen].slice(0, 20);
}

async function migrate(SkillListing, Opportunity) {
  const listings = await SkillListing.find({}).lean();
  let created = 0;
  let skipped = 0;

  for (const l of listings) {
    const exists = await Opportunity.findOne({ legacySkillListingId: l._id }).select('_id').lean();
    if (exists) { skipped++; continue; }
    if (!APPLY) { created++; continue; }

    const title = (norm(l.skill) || 'Skill offer').slice(0, 120);
    const doc = new Opportunity({
      user: l.user,
      kind: 'offer',
      // SkillListing carried no category; 'tutoring' is the safest default for a
      // person offering a skill. Requesters can recategorise after migration.
      category: 'tutoring',
      title,
      description: (norm(l.description) || title).slice(0, 4000),
      skills: toSkills(l.skill, l.tags),
      priceCredits: 0,
      urgency: 'normal',
      status: 'open',
      visibility: 'public',
      legacySkillListingId: l._id,
      // Carry the source row's timestamps so migrated offers keep their place in
      // feeds and reputation recency windows. save({timestamps:false}) stops
      // Mongoose from overwriting createdAt with "now".
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    });
    await doc.save({ timestamps: false });
    created++;
  }

  return { total: listings.length, created, skipped };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(2);
  }

  await mongoose.connect(uri);
  const SkillListing = require('../models/SkillListing');
  const Opportunity = require('../models/Opportunity');

  console.log(APPLY ? '\nAPPLYING migration\n' : '\nDRY RUN — no writes. Re-run with --apply to commit.\n');

  const res = await migrate(SkillListing, Opportunity);
  console.log(`SkillListings      : ${res.total}`);
  console.log(`${APPLY ? 'Created' : 'Would create'}    : ${res.created}`);
  console.log(`Already migrated   : ${res.skipped}`);

  const totalOpps = await Opportunity.countDocuments();
  console.log(`\nOpportunities now  : ${totalOpps}`);

  console.log('');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
