/**
 * One-time migration: tier 'max' → 'placement'.
 *
 * The 'max' tier was renamed when pricing moved to a Pro subscription plus a
 * one-time Placement Pass. The User and SubscriptionRequest enums no longer
 * accept 'max', so any document still holding it would fail validation on its
 * next save.
 *
 * Safe to re-run: it only matches documents that still say 'max'.
 *
 *   node scripts/migrateMaxToPlacement.js          # report only
 *   node scripts/migrateMaxToPlacement.js --apply  # perform the update
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  // Bypass the Mongoose enum (which no longer permits 'max') by going through
  // the raw collections.
  const db = mongoose.connection.db;
  const targets = [
    { name: 'users', collection: db.collection('users') },
    { name: 'subscriptionrequests', collection: db.collection('subscriptionrequests') },
  ];

  for (const { name, collection } of targets) {
    const count = await collection.countDocuments({ tier: 'max' });
    if (!count) {
      console.log(`${name}: nothing to migrate`);
      continue;
    }
    if (!apply) {
      console.log(`${name}: ${count} document(s) would change 'max' → 'placement' (dry run)`);
      continue;
    }
    const res = await collection.updateMany({ tier: 'max' }, { $set: { tier: 'placement' } });
    console.log(`${name}: migrated ${res.modifiedCount} document(s)`);
  }

  if (!apply) console.log('\nDry run. Re-run with --apply to write.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
