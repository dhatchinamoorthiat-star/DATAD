/**
 * Backfill programs onto accounts and content that predate personalization.
 *
 * Content created before Phase 2 has `program: null`, and every content filter
 * matches on a concrete program id — so without this, existing posts, notes,
 * events, tasks and listings are visible to nobody.
 *
 *   node scripts/backfillPrograms.js          # dry run, prints what it would do
 *   node scripts/backfillPrograms.js --apply  # writes
 *
 * Idempotent: only ever touches rows that are still missing a program.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const Post = require('../models/Post');
const Note = require('../models/Note');
const Event = require('../models/Event');
const Task = require('../models/Task');
const MarketListing = require('../models/MarketListing');
const { resolveProgramFromCourse } = require('../utils/programResolver');

const APPLY = process.argv.includes('--apply');

// [model, field naming the author] — every content type scoped by program.
const CONTENT = [
  [Post, 'author'],
  [Note, 'author'],
  [Event, 'createdBy'],
  [Task, 'createdBy'],
  [MarketListing, 'seller'],
];

async function backfillUsers() {
  const users = await User.find({
    $or: [{ 'program.id': null }, { 'program.id': { $exists: false } }],
  }).select('_id name email').lean();

  const results = [];
  for (const u of users) {
    // The course lives on UserProfile, which registration has always written.
    const profile = await UserProfile.findOne({ user: u._id })
      .select('course specialization graduationYear college').lean();
    const program = resolveProgramFromCourse(profile || {});
    results.push({ user: u, program });

    if (APPLY) {
      await User.updateOne({ _id: u._id }, {
        $set: {
          program,
          programs: [program.id],
          activeProgram: program.id,
        },
      });
    }
  }
  return results;
}

async function backfillContent() {
  const summary = [];
  for (const [Model, authorField] of CONTENT) {
    const orphans = await Model.find({
      $or: [{ program: null }, { program: { $exists: false } }],
    }).select(`_id ${authorField}`).lean();

    let updated = 0;
    for (const doc of orphans) {
      const owner = await User.findById(doc[authorField]).select('program').lean();
      // An author with no program of their own (or a deleted author) falls back
      // to 'general' rather than leaving the row invisible.
      const programId = owner?.program?.id || 'general';
      if (APPLY) {
        await Model.updateOne({ _id: doc._id }, { $set: { program: programId } });
      }
      updated++;
    }
    summary.push({ model: Model.modelName, orphans: orphans.length, updated });
  }
  return summary;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(APPLY ? '── APPLYING ──' : '── DRY RUN (pass --apply to write) ──');

  const users = await backfillUsers();
  console.log(`\nUsers missing a program: ${users.length}`);
  users.forEach(({ user, program }) =>
    console.log(`  ${String(user.email).padEnd(34)} -> ${program.id} (${program.type})`)
  );

  const content = await backfillContent();
  console.log('\nOrphaned content:');
  content.forEach((c) =>
    console.log(`  ${c.model.padEnd(14)} ${String(c.orphans).padStart(4)} rows`)
  );

  const total = content.reduce((n, c) => n + c.orphans, 0);
  console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${users.length} users and ${total} content rows.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
