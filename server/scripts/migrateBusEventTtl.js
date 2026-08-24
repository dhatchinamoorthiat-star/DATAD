/**
 * Migration: move the BusEvent TTL from `createdAt` to `processedAt`.
 *
 * Mongoose creates indexes declared in a schema but never drops ones that were
 * removed from it, so changing the declaration in models/BusEvent.js is not
 * enough — the old `createdAt_1` TTL keeps running in production and keeps
 * deleting unprocessed events 7 days after they were emitted.
 *
 * Run once per environment:
 *
 *   node server/scripts/migrateBusEventTtl.js          # report only
 *   node server/scripts/migrateBusEventTtl.js --apply  # make the change
 *
 * Safe to re-run: both steps are checked before they are attempted.
 *
 * Dropping a TTL index never deletes data — it only stops future expiry — so
 * the risky ordering would be the reverse (dropping the new one). The new index
 * is created first regardless, so there is no window where neither exists.
 */
require('dotenv').config();

const mongoose = require('mongoose');

const OLD_INDEX = 'createdAt_1';
const NEW_INDEX = 'processedAt_1';
const TTL_SECONDS = 7 * 24 * 60 * 60;

async function main() {
  const apply = process.argv.includes('--apply');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('busevents');

  const indexes = await col.indexes();
  const byName = Object.fromEntries(indexes.map((i) => [i.name, i]));

  console.log(`mode: ${apply ? 'APPLY' : 'dry run (pass --apply to make changes)'}`);
  console.log('current indexes:');
  for (const i of indexes) {
    const ttl = i.expireAfterSeconds !== undefined ? `  TTL=${i.expireAfterSeconds}s` : '';
    console.log(`  ${i.name.padEnd(16)} ${JSON.stringify(i.key)}${ttl}`);
  }

  // How many rows the old TTL would still destroy, as a measure of what this
  // is actually preventing.
  const atRisk = await col.countDocuments({
    status: { $in: ['pending', 'processing'] },
    createdAt: { $lt: new Date(Date.now() - TTL_SECONDS * 1000) },
  });
  console.log(`\nunprocessed rows already past the old 7-day expiry: ${atRisk}`);

  if (!byName[NEW_INDEX]) {
    console.log(`\ncreate ${NEW_INDEX} (TTL ${TTL_SECONDS}s)`);
    if (apply) {
      await col.createIndex({ processedAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
      console.log('  created');
    }
  } else {
    console.log(`\n${NEW_INDEX} already exists — nothing to create`);
  }

  if (byName[OLD_INDEX]) {
    console.log(`drop ${OLD_INDEX} (the destructive TTL)`);
    if (apply) {
      await col.dropIndex(OLD_INDEX);
      console.log('  dropped');
    }
  } else {
    console.log(`${OLD_INDEX} not present — nothing to drop`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
