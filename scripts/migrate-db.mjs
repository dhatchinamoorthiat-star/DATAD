#!/usr/bin/env node
/**
 * DATAD database migration: dump one MongoDB and seed another.
 *
 * Usage:
 *   node scripts/migrate-db.mjs dump  --uri "<source-uri>" [--out backups/<ts>]
 *   node scripts/migrate-db.mjs seed  --uri "<target-uri>" --in backups/<ts> [--drop]
 *   node scripts/migrate-db.mjs copy  --from "<source-uri>" --to "<target-uri>" [--drop]
 *
 * Falls back to MONGODB_URI for the source and MONGODB_URI_TARGET (or
 * MONGODB_URI_NEW) for the target, read from the environment.
 * Data is written as Extended JSON (one file per collection) so ObjectIds,
 * Dates, Decimal128 and Binary survive the round trip. Indexes are captured
 * alongside the documents and rebuilt on seed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'server/'));
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const BATCH = 1000;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key.startsWith('--')) continue;
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { flags[key.slice(2)] = next; i++; }
    else flags[key.slice(2)] = true;
  }
  return { command, flags };
}

const log = (...a) => console.log('[migrate]', ...a);

async function listCollections(db) {
  const all = await db.listCollections({ type: 'collection' }).toArray();
  return all.map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
}

async function dump(uri, outDir) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const names = await listCollections(db);
  await fs.mkdir(path.join(outDir, 'data'), { recursive: true });
  const manifest = { source: db.databaseName, takenAt: new Date().toISOString(), collections: [] };

  for (const name of names) {
    const coll = db.collection(name);
    const docs = await coll.find({}).toArray();
    const indexes = (await coll.indexes()).filter((ix) => ix.name !== '_id_');
    await fs.writeFile(
      path.join(outDir, 'data', `${name}.json`),
      EJSON.stringify(docs, undefined, 0, { relaxed: false }),
    );
    manifest.collections.push({ name, count: docs.length, indexes });
    log(`dumped ${name}: ${docs.length} docs, ${indexes.length} extra indexes`);
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await client.close();
  const total = manifest.collections.reduce((n, c) => n + c.count, 0);
  log(`done — ${manifest.collections.length} collections, ${total} documents -> ${outDir}`);
}

async function seed(uri, inDir, drop) {
  const manifest = JSON.parse(await fs.readFile(path.join(inDir, 'manifest.json'), 'utf8'));
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  log(`seeding ${db.databaseName} from ${manifest.source} (dumped ${manifest.takenAt})`);

  for (const entry of manifest.collections) {
    const raw = await fs.readFile(path.join(inDir, 'data', `${entry.name}.json`), 'utf8');
    const docs = EJSON.parse(raw, { relaxed: false });
    const coll = db.collection(entry.name);
    if (drop) await coll.drop().catch(() => {});
    for (let i = 0; i < docs.length; i += BATCH) {
      await coll.insertMany(docs.slice(i, i + BATCH), { ordered: false });
    }
    for (const ix of entry.indexes) {
      const { key, name, v, ns, background, ...opts } = ix;
      await coll.createIndex(key, { name, ...opts }).catch((e) => log(`index ${entry.name}.${name}: ${e.message}`));
    }
    log(`seeded ${entry.name}: ${docs.length} docs`);
  }

  await client.close();
  log('done');
}

async function copy(from, to, drop) {
  const tmp = path.join('backups', `copy-${Date.now()}`);
  await dump(from, tmp);
  await seed(to, tmp, drop);
  log(`intermediate dump kept at ${tmp}`);
}

const { command, flags } = parseArgs(process.argv.slice(2));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

try {
  if (command === 'dump') {
    const uri = flags.uri || process.env.MONGODB_URI;
    if (!uri) throw new Error('missing --uri (or MONGODB_URI)');
    await dump(uri, flags.out || path.join('backups', stamp));
  } else if (command === 'seed') {
    const uri = flags.uri || (process.env.MONGODB_URI_TARGET || process.env.MONGODB_URI_NEW);
    if (!uri) throw new Error('missing --uri (or MONGODB_URI_TARGET)');
    if (!flags.in) throw new Error('missing --in <dump-dir>');
    await seed(uri, flags.in, Boolean(flags.drop));
  } else if (command === 'copy') {
    const from = flags.from || process.env.MONGODB_URI;
    const to = flags.to || (process.env.MONGODB_URI_TARGET || process.env.MONGODB_URI_NEW);
    if (!from || !to) throw new Error('missing --from / --to');
    await copy(from, to, Boolean(flags.drop));
  } else {
    console.error('usage: migrate-db.mjs <dump|seed|copy> [flags] — see file header');
    process.exit(1);
  }
} catch (err) {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
}
