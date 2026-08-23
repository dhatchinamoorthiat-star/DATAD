/**
 * Nightly job — rebuild the k-anonymous cohort aggregates.
 *
 * This is the only writer of CohortInsight. Everything privacy-relevant is
 * decided here, at write time, so that a mistake downstream cannot leak
 * something the collection never held:
 *
 *   - a cohort under COHORT_MIN_MEMBERS produces no document, and any stale
 *     document for it is deleted rather than left to be served;
 *   - a converted/unconverted split is written only when both sides clear the
 *     minimum independently;
 *   - nothing per-student is written: no user refs, no names, no rows.
 *
 * Runs after the profile snapshot so the day's readings are already in.
 */
const { runJob } = require('../jobRunner');
const StudentIdentity = require('../../models/StudentIdentity');
const User = require('../../models/User');
const PlacementOutcome = require('../../models/PlacementOutcome');
const StudentProfileSnapshot = require('../../models/StudentProfileSnapshot');
const CohortInsight = require('../../models/CohortInsight');
const { cohortKey, normalize } = require('../../ai/cohort/cohortInsights');
const {
  COHORT_AGGREGATABLE,
  meetsCohortMinimum,
} = require('../../models/profileVisibility');

// How far back a snapshot may be and still describe a student. Beyond this
// they are not a current member of the cohort in any useful sense.
const SNAPSHOT_MAX_AGE_DAYS = parseInt(process.env.COHORT_SNAPSHOT_MAX_AGE_DAYS || '30', 10);

const dayMs = 24 * 60 * 60 * 1000;

function keyDaysAgo(n) {
  return new Date(Date.now() - n * dayMs).toISOString().slice(0, 10);
}

const round = (n) => Math.round(n * 10) / 10;

/**
 * Mean of each aggregatable signal over a set of per-student readings.
 * Each metric averages only over the students who actually have a reading for
 * it, so one member with no resume does not drag the resume average toward zero
 * as though they had scored zero.
 */
function aggregate(readings) {
  const out = { members: readings.length };
  for (const metric of COHORT_AGGREGATABLE) {
    const values = readings.map((r) => r[metric]).filter((v) => typeof v === 'number');
    out[metric] = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  }
  return out;
}

/** Flatten one snapshot into just the aggregatable signals. */
function readingFrom(snapshot) {
  return {
    careerReadiness: snapshot.careerReadiness,
    applicationsCount: snapshot.signals?.applicationsCount,
    resumeCompletion: snapshot.signals?.resumeCompletion,
    consistency: snapshot.signals?.consistency,
    streak: snapshot.signals?.streak,
    studyMinutes: snapshot.signals?.studyMinutes,
  };
}

async function computeCohortInsights() {
  return runJob('cohort-insights', async () => {
    const cutoff = keyDaysAgo(SNAPSHOT_MAX_AGE_DAYS);

    // ── Group students by cohort ────────────────────────────────────────────
    const identities = await StudentIdentity.find({
      batch: { $nin: ['', null] },
      college: { $nin: ['', null] },
    }).select('user batch college').lean();

    const users = await User.find({ _id: { $in: identities.map((i) => i.user) } })
      .select('activeProgram').lean();
    const programOf = new Map(users.map((u) => [String(u._id), u.activeProgram || 'general']));

    const groups = new Map(); // cohortKey → { batch, college, program, userIds[] }
    for (const identity of identities) {
      const cohort = {
        batch: identity.batch,
        college: identity.college,
        program: programOf.get(String(identity.user)) || 'general',
      };
      const key = cohortKey(cohort);
      if (!groups.has(key)) groups.set(key, { ...cohort, userIds: [] });
      groups.get(key).userIds.push(identity.user);
    }

    // ── Who converted ───────────────────────────────────────────────────────
    // Read once for everyone rather than per cohort. Only the user ids are kept
    // — company, role and package never enter this job's memory.
    const offerUserIds = new Set(
      (await PlacementOutcome.find({ outcome: 'offer_received' }).select('user').lean())
        .map((o) => String(o.user))
    );

    const counts = { written: 0, suppressed: 0, split: 0 };
    const liveKeys = [];

    for (const [key, group] of groups) {
      // First gate, before any reading is fetched: too few people means there
      // is nothing to compute, not something to compute carefully.
      if (!meetsCohortMinimum(group.userIds.length)) {
        counts.suppressed += 1;
        continue;
      }

      const snapshots = await StudentProfileSnapshot.find({
        user: { $in: group.userIds },
        dateKey: { $gte: cutoff },
      }).sort({ dateKey: -1 }).lean();

      // One reading per student — their most recent.
      const latest = new Map();
      for (const snapshot of snapshots) {
        const uid = String(snapshot.user);
        if (!latest.has(uid)) latest.set(uid, snapshot);
      }

      // Second gate: enough people with *data*, not just enough enrolled.
      if (!meetsCohortMinimum(latest.size)) {
        counts.suppressed += 1;
        continue;
      }

      const converted = [];
      const notConverted = [];
      for (const [uid, snapshot] of latest) {
        (offerUserIds.has(uid) ? converted : notConverted).push(readingFrom(snapshot));
      }

      // Third gate: a split is only written when neither side describes an
      // individual. 8 members split 7/1 would publish that one student.
      const splitOk = meetsCohortMinimum(converted.length) && meetsCohortMinimum(notConverted.length);
      if (splitOk) counts.split += 1;

      await CohortInsight.updateOne(
        { cohortKey: key },
        {
          $set: {
            batch: group.batch,
            college: group.college,
            program: group.program,
            memberCount: latest.size,
            overall: aggregate([...latest.values()].map(readingFrom)),
            converted: splitOk ? aggregate(converted) : null,
            notConverted: splitOk ? aggregate(notConverted) : null,
            // The conversion rate is itself a statistic about the cohort, so it
            // is gated on the same split rule: in a cohort of 5 where 1
            // converted, "20%" plus a roster is one student's outcome.
            conversionPct: splitOk
              ? Math.round((converted.length / latest.size) * 100)
              : null,
            computedAt: new Date(),
          },
          $setOnInsert: { cohortKey: key },
        },
        { upsert: true }
      );
      counts.written += 1;
      liveKeys.push(key);
    }

    // A cohort that has shrunk below the minimum since the last run must lose
    // its stored document, not keep serving yesterday's aggregate.
    const removed = await CohortInsight.deleteMany({ cohortKey: { $nin: liveKeys } });

    console.log(
      `[cohort-insights] ${counts.written} cohorts written (${counts.split} with a converted split), `
      + `${counts.suppressed} suppressed below k=5, ${removed?.deletedCount || 0} stale removed`
    );
    return { itemsProcessed: counts.written, meta: { ...counts, removed: removed?.deletedCount || 0 } };
  });
}

module.exports = { computeCohortInsights, aggregate, readingFrom };
