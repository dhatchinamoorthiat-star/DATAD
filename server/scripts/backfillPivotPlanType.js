/**
 * One-time migration: backfill planType on existing PivotPlan documents.
 *
 * Existing pivot-plan documents were created before the planType field
 * existed (all were implicitly career pivots). This migration sets them
 * to planType='pivot' so they remain backward-compatible.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node server/scripts/backfillPivotPlanType.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', 'server', '.env') });

const PivotPlan = require('../models/PivotPlan');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI / MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // Count documents that need a planType (missing or empty).
  const pending = await PivotPlan.countDocuments({
    $or: [
      { planType: { $exists: false } },
      { planType: null },
      { planType: '' },
    ],
  });

  if (pending === 0) {
    console.log('No pivot-plan documents need migration.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Migrating ${pending} document(s) → planType='pivot'…`);

  const result = await PivotPlan.updateMany(
    {
      $or: [
        { planType: { $exists: false } },
        { planType: null },
        { planType: '' },
      ],
    },
    { $set: { planType: 'pivot' } }
  );

  console.log(`\nDone. ${result.modifiedCount} document(s) updated.`);

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
