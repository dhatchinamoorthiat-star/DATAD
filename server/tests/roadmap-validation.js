/**
 * End-to-end validation of the complete roadmap user journey.
 *
 * Tests the entire data flow through the exported API:
 * 1. PivotPlan schema with planType, currentSkills, enriched skillGaps
 * 2. HabitLog schema with dailyNote
 * 3. computeSkillGap business logic
 * 4. roadmapService.generateRoadmap (context collection + error handling)
 * 5. roadmapService.getProgress aggregation
 * 6. Migration backfill compatibility
 *
 * These tests use only the exported API — no internal functions.
 *
 * Run: node server/tests/roadmap-validation.test.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const PivotPlan = require('./../models/PivotPlan');
const HabitLog = require('./../models/HabitLog');
const roadmapService = require('./../services/roadmapService');

const PASS = true;
const FAIL = false;
let allPassed = true;

function test(name, result, detail = '') {
  if (result) {
    console.log(`  ✓ PASS: ${name}`);
  } else {
    console.log(`  ✗ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    allPassed = false;
  }
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('\n=== DATAD End-to-End Roadmap Validation ===\n');

  // ── 1. PivotPlan schema validation ──────────────────────────────
  console.log('1. PivotPlan schema extensions');

  const pSchema = PivotPlan.schema;
  test('planType path exists', !!pSchema.path('planType'));
  test('planType defaults to "pivot"', pSchema.path('planType').defaultValue === 'pivot');
  test('currentSkills path exists', !!pSchema.path('currentSkills'));

  // skillGaps sub-schema enrichment
  const gapsPath = pSchema.path('skillGaps');
  const isArray = gapsPath.instance === 'Array' || !!gapsPath.caster;
  test('skillGaps is an array', isArray, `instance=${gapsPath.instance} hasCaster=${!!gapsPath.caster}`);
  // Mongoose SchemaArrays have a `.caster.schema` for sub-doc arrays
  const gapItemPaths = gapsPath.caster?.schema || gapsPath.schema;
  if (gapItemPaths) {
  test('skillGaps items have itemType', !!gapItemPaths.path('itemType'));
  test('skillGaps items have link', !!gapItemPaths.path('link'));
  test('skillGaps items have notes', !!gapItemPaths.path('notes'));
  test('skillGaps items have sortOrder', !!gapItemPaths.path('sortOrder'));
  test('sortOrder defaults to 0', gapItemPaths.path('sortOrder').defaultValue === 0);
  test('link maxlength is 500', gapItemPaths.path('link').options.maxlength === 500);
  test('notes maxlength is 1000', gapItemPaths.path('notes').options.maxlength === 1000);
  }

  // planType enum values
  test('planType enum includes "pivot"', pSchema.path('planType').enumValues.includes('pivot'));
  test('planType enum includes "roadmap"', pSchema.path('planType').enumValues.includes('roadmap'));

  // ── 2. HabitLog schema validation ───────────────────────────────
  console.log('\n2. HabitLog schema extensions');

  const hSchema = HabitLog.schema;
  test('dailyNote path exists', !!hSchema.path('dailyNote'));
  test('dailyNote maxlength is 500', hSchema.path('dailyNote').options.maxlength === 500);
  test('dailyNote defaults to null', hSchema.path('dailyNote').defaultValue === null);

  // ── 3. computeSkillGap business logic ───────────────────────────
  console.log('\n3. computeSkillGap business logic');

  let result;

  // Exact match
  result = roadmapService.computeSkillGap(
    ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualisation', 'Deep Learning'],
    'data scientist'
  );
  test('exact skill match gives 100%', result.pct === 100,
    `got ${result.pct}%`);
  test('exact match produces empty gap array', result.gap.length === 0,
    `gaps: ${result.gap.join(', ')}`);

  // Partial match
  result = roadmapService.computeSkillGap(
    ['Python', 'SQL', 'Excel'],
    'data scientist'
  );
  test('partial 2/6 match gives 33%', result.pct === 33,
    `got ${result.pct}%`);
  test('partial match identifies 4 missing skills', result.gap.length === 4,
    `got ${result.gap.length} gaps: ${result.gap.join(', ')}`);
  test('partial match includes Statistics', result.gap.includes('Statistics'),
    `missing from gaps: ${result.gap.join(', ')}`);

  // No match
  result = roadmapService.computeSkillGap(
    ['Graphic Design', 'Photoshop'],
    'data scientist'
  );
  test('irrelevant skills gives 0%', result.pct === 0,
    `got ${result.pct}%`);

  // Unknown role (no entry in ROLE_SKILL_MAP)
  result = roadmapService.computeSkillGap(
    ['Python', 'SQL'],
    'astronaut'
  );
  test('unknown role gives 0% and empty gap', result.pct === 0 && result.gap.length === 0,
    `got ${result.pct}% gap=[${result.gap}]`);

  // Case insensitivity
  result = roadmapService.computeSkillGap(
    ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualisation', 'Deep Learning'],
    'Data Scientist'
  );
  test('case-insensitive match works', result.pct === 100,
    `got ${result.pct}%`);

  // Empty current skills
  result = roadmapService.computeSkillGap([], 'software engineer');
  test('empty skills gives 0%', result.pct === 0, `got ${result.pct}%`);
  test('empty skills reports 7 gaps for software engineer',
    result.gap.length === 7, `got ${result.gap.length} gaps`);

  // Null safety
  result = roadmapService.computeSkillGap(null, 'data scientist');
  test('null skills handled gracefully', result.pct === 0 && Array.isArray(result.gap),
    `pct=${result.pct} type=${typeof result.gap}`);

  // ── 4. getProgress edge cases ───────────────────────────────────
  console.log('\n4. getProgress edge cases');

  const fakeId = new mongoose.Types.ObjectId();
  result = await roadmapService.getProgress(fakeId);

  test('getProgress for unknown user returns hasRoadmap=false', result.hasRoadmap === false,
    `got ${result.hasRoadmap}`);
  test('getProgress for unknown user returns 0 progress', result.progress === 0,
    `got ${result.progress}`);
  test('getProgress for unknown user returns 0 total', result.total === 0,
    `got ${result.total}`);
  test('getProgress result has items array', Array.isArray(result.items),
    `type: ${typeof result.items}`);

  // ── 5. generateRoadmap error handling ───────────────────────────
  console.log('\n5. generateRoadmap error handling');

  // Missing target role
  try {
    await roadmapService.generateRoadmap(fakeId, {});
    test('generateRoadmap without target should throw', false,
      'should have thrown but returned');
  } catch (err) {
    test('generateRoadmap throws when target role is missing',
      err && err.message && err.message.includes('A target role is required'),
      err ? err.message : 'no error thrown');
  }

  // ── 6. Migration / backward compatibility ───────────────────────
  console.log('\n6. Migration & backward compatibility');

  // Create a doc WITHOUT planType (simulates pre-migration state)
  const testDoc = await PivotPlan.create({
    user: new mongoose.Types.ObjectId(),
    toRole: 'Data Scientist',
    toDomain: 'Technology',
    skillGaps: [
      { skill: 'Python', status: 'done' },
      { skill: 'SQL', status: 'not-started' },
    ],
  });
  const docId = testDoc._id;

  // Unset planType to simulate a pre-migration document that was
  // created before the field existed in the schema.
  await PivotPlan.updateOne({ _id: docId }, { $unset: { planType: '' } });
  const rawDoc = await PivotPlan.findById(docId).lean();
  test('pre-migration doc has no planType after $unset', rawDoc.planType === undefined || rawDoc.planType === null,
    `planType=${rawDoc.planType}`);

  // Apply migration logic (same as backfillPivotPlanType.js)
  const updateResult = await PivotPlan.updateMany(
    { $or: [{ planType: { $exists: false } }, { planType: null }, { planType: '' }] },
    { $set: { planType: 'pivot' } }
  );
  test('migration affected at least 1 document', updateResult.modifiedCount >= 1,
    `modified: ${updateResult.modifiedCount}`);

  // Verify migration persisted
  const migratedDoc = await PivotPlan.findById(docId).lean();
  test('migrated doc has planType="pivot"', migratedDoc.planType === 'pivot',
    `got "${migratedDoc.planType}"`);

  // Verify existing data is preserved after migration
  test('existing skillGaps preserved after migration',
    migratedDoc.skillGaps.length === 2 &&
    migratedDoc.skillGaps[0].skill === 'Python' &&
    migratedDoc.skillGaps[1].status === 'not-started',
    `skillGaps: ${JSON.stringify(migratedDoc.skillGaps)}`);

  // Cleanup
  await PivotPlan.deleteOne({ _id: docId });

  // ── 7. Roadmap persistence round-trip ────────────────────────────
  console.log('\n7. Roadmap persistence round-trip');

  const roadmapUser = new mongoose.Types.ObjectId();

  // Create a roadmap by directly saving to PivotPlan
  const savedPlan = await PivotPlan.create({
    user: roadmapUser,
    planType: 'roadmap',
    toRole: 'ML Engineer',
    currentSkills: ['Python', 'SQL'],
    skillGaps: [
      {
        skill: 'Deep Learning',
        status: 'in-progress',
        itemType: 'course',
        link: 'https://coursera.org/deep-learning',
        notes: 'Andrew Ng course',
        sortOrder: 0,
      },
      {
        skill: 'MLOps',
        status: 'not-started',
        itemType: 'project',
        notes: 'Build an end-to-end ML pipeline',
        sortOrder: 1,
      },
      {
        skill: 'TensorFlow',
        status: 'done',
        itemType: 'certification',
        sortOrder: 2,
      },
    ],
    targetCompanies: ['Google', 'Meta'],
  });

  // Read back and verify
  const fetched = await PivotPlan.findById(savedPlan._id).lean();
  test('roadmap persisted with correct planType', fetched.planType === 'roadmap',
    `got "${fetched.planType}"`);
  test('roadmap persisted with correct target role', fetched.toRole === 'ML Engineer',
    `got "${fetched.toRole}"`);
  test('roadmap persisted with currentSkills', fetched.currentSkills.length === 2,
    `got ${fetched.currentSkills.length}`);
  test('roadmap persisted with 3 skillGaps', fetched.skillGaps.length === 3,
    `got ${fetched.skillGaps.length}`);
  test('skillGap enriched: itemType preserved',
    fetched.skillGaps[0].itemType === 'course',
    `got "${fetched.skillGaps[0].itemType}"`);
  test('skillGap enriched: link preserved',
    fetched.skillGaps[0].link === 'https://coursera.org/deep-learning',
    `got "${fetched.skillGaps[0].link}"`);
  test('skillGap enriched: notes preserved',
    fetched.skillGaps[0].notes != null,
    `got null`);
  test('skillGap enriched: sortOrder preserved',
    fetched.skillGaps[0].sortOrder === 0,
    `got ${fetched.skillGaps[0].sortOrder}`);
  test('in-progress milestone persisted', fetched.skillGaps[0].status === 'in-progress',
    `got "${fetched.skillGaps[0].status}"`);
  test('done milestone persisted', fetched.skillGaps[2].status === 'done',
    `got "${fetched.skillGaps[2].status}"`);
  test('target companies preserved', fetched.targetCompanies.length === 2,
    `got ${fetched.targetCompanies.length}`);

  // getProgress on this roadmap
  const progress = await roadmapService.getProgress(roadmapUser);
  test('getProgress returns hasRoadmap=true', progress.hasRoadmap === true);
  test('getProgress returns progress > 0',
    progress.progress > 0, `got ${progress.progress}%`);
  test('getProgress returns completed=1', progress.completed === 1,
    `got ${progress.completed}`);
  test('getProgress returns inProgress=1', progress.inProgress === 1,
    `got ${progress.inProgress}`);
  test('getProgress returns items', Array.isArray(progress.items) && progress.items.length === 3,
    `got ${progress.items?.length} items`);

  // Cleanup
  await PivotPlan.deleteOne({ _id: savedPlan._id });

  // ── 8. HabitLog dailyNote round-trip ──────────────────────────────
  console.log('\n8. HabitLog dailyNote round-trip');

  const habitUser = new mongoose.Types.ObjectId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const savedLog = await HabitLog.create({
    user: habitUser,
    date: today,
    habits: [{ name: 'Study 2h', done: true }],
    studyMinutes: 120,
    pomodoroCount: 4,
    dailyNote: 'Worked on TensorFlow tutorial for ML roadmap',
  });

  const fetchedLog = await HabitLog.findById(savedLog._id).lean();
  test('dailyNote persisted correctly',
    fetchedLog.dailyNote === 'Worked on TensorFlow tutorial for ML roadmap',
    `got "${fetchedLog.dailyNote}"`);
  test('existing fields preserved alongside dailyNote',
    fetchedLog.studyMinutes === 120 &&
    fetchedLog.pomodoroCount === 4 &&
    fetchedLog.habits.length === 1,
    `minutes=${fetchedLog.studyMinutes} pomos=${fetchedLog.pomodoroCount}`);

  // Verify dailyNote can be null
  const nullNoteLog = await HabitLog.create({
    user: new mongoose.Types.ObjectId(),
    date: new Date(Date.now() - 86400000), // yesterday
    dailyNote: null,
  });
  test('dailyNote allows null', nullNoteLog.dailyNote === null,
    `got ${nullNoteLog.dailyNote}`);

  // Verify dailyNote enforces maxlength
  const tooLong = 'x'.repeat(600);
  try {
    await HabitLog.create({
      user: new mongoose.Types.ObjectId(),
      date: new Date(),
      dailyNote: tooLong,
    });
    test('dailyNote with 600 chars is rejected by Mongoose', false,
      'should have thrown validation error');
  } catch (err) {
    test('dailyNote enforces maxlength',
      err && err.name === 'ValidationError',
      err ? err.name : 'no error');
  }

  // Cleanup
  await HabitLog.deleteOne({ _id: savedLog._id });
  await HabitLog.deleteOne({ _id: nullNoteLog._id });

  // ── Summary ─────────────────────────────────────────────────────
  console.log(`\n${allPassed ? '=== ALL TESTS PASSED ===' : '=== SOME TESTS FAILED ==='}`);
  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('Validation error:', err.message);
  process.exit(1);
});
