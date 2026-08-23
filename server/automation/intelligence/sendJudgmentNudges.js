/**
 * Daily job — the one cron that pushes judgement rather than content.
 *
 * The other ~20 jobs push things: today's case, this week's newsletter, a
 * resume tip. Useful, but none of them looks at a particular student and says
 * "this specific combination of facts is a problem, here is what I would do".
 * That is what this does, using the trend history Phase 1 started keeping.
 *
 * The whole design constraint is restraint. A nudge that fires most days is
 * indistinguishable from the content jobs, and the student mutes Dax — at which
 * point the one genuinely urgent nudge, months later, is never seen. So all
 * three conditions must hold at once, and there is a hard cap of one judgement
 * nudge per student per day regardless.
 */
const { runJob } = require('../jobRunner');
const SiteMeta = require('../../models/SiteMeta');
const Notification = require('../../models/Notification');
const StudentProfileSnapshot = require('../../models/StudentProfileSnapshot');
const { notify } = require('../../controllers/notificationController');
const { getDelta } = require('../../ai/intelligence-layer/trends');

// ── Thresholds. Every one of these must be crossed. ─────────────────────────
// Close enough to the drive that a lost week cannot be made up quietly.
const PLACEMENT_WINDOW_DAYS = parseInt(process.env.NUDGE_PLACEMENT_WINDOW_DAYS || '21', 10);
// Enough overdue work that it is a pattern, not a slipped afternoon.
const MIN_OVERDUE_TASKS = parseInt(process.env.NUDGE_MIN_OVERDUE || '3', 10);
// A real fall in consistency, not day-to-day noise.
const MAX_CONSISTENCY_DELTA = parseInt(process.env.NUDGE_CONSISTENCY_DROP || '-15', 10);
const TREND_DAYS = 14;

// A snapshot older than this does not describe the student today.
const SNAPSHOT_MAX_AGE_DAYS = 2;
// The hard cap. Independent of the thresholds above, so a bug in them cannot
// turn into a stream of notifications.
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Fixed prefix so the cooldown can recognise its own past nudges even though
// the body of each one differs.
const NUDGE_TITLE_PREFIX = 'Worth a look before the drive';

const dayMs = 24 * 60 * 60 * 1000;

async function recentlyNudged(userId) {
  const existing = await Notification.findOne({
    user: userId,
    type: 'suggestion',
    title: NUDGE_TITLE_PREFIX,
    createdAt: { $gte: new Date(Date.now() - NUDGE_COOLDOWN_MS) },
  }).select('_id').lean();
  return Boolean(existing);
}

/** The sentence the student actually reads. Specific, or it is not judgement. */
function buildBody({ daysToPlacement, overdue, delta }) {
  return `You are ${daysToPlacement} days from the drive with ${overdue} overdue tasks, `
    + `and your consistency is down ${Math.abs(delta.delta)} points since ${delta.startDate}. `
    + `Those three together usually mean the plan stopped fitting the week, not that you stopped trying. `
    + `Want me to replan what is left?`;
}

async function sendJudgmentNudges() {
  return runJob('judgment-nudge', async () => {
    const counts = { candidates: 0, sent: 0, skippedCooldown: 0, skippedTrend: 0, failed: 0 };

    // One read for the whole run: the drive date is global.
    const meta = await SiteMeta.findOne({ key: 'main' }).select('placementDate').lean();
    if (!meta?.placementDate) {
      console.log('[judgment-nudge] No placement date configured — nothing to judge against');
      return { itemsProcessed: 0, meta: { ...counts, reason: 'no-placement-date' } };
    }

    const daysToPlacement = Math.ceil((new Date(meta.placementDate) - Date.now()) / dayMs);
    if (daysToPlacement < 0 || daysToPlacement > PLACEMENT_WINDOW_DAYS) {
      console.log(`[judgment-nudge] Drive is ${daysToPlacement} days out — outside the nudge window`);
      return { itemsProcessed: 0, meta: { ...counts, reason: 'outside-window' } };
    }

    // Candidates come from the snapshot collection, not from rebuilding every
    // profile: the first two conditions are already recorded there, so only the
    // handful of students who pass them cost a trend query.
    const cutoff = new Date(Date.now() - SNAPSHOT_MAX_AGE_DAYS * dayMs).toISOString().slice(0, 10);
    const candidates = await StudentProfileSnapshot.find({
      dateKey: { $gte: cutoff },
      'signals.overdueTasks': { $gte: MIN_OVERDUE_TASKS },
    }).select('user signals.overdueTasks').lean();

    // One row per student even if two days are in range.
    const byUser = new Map();
    for (const row of candidates) byUser.set(String(row.user), row);
    counts.candidates = byUser.size;

    for (const [, row] of byUser) {
      try {
        if (await recentlyNudged(row.user)) { counts.skippedCooldown += 1; continue; }

        const delta = await getDelta(row.user, 'consistency', { days: TREND_DAYS });
        // No history is not a falling trend. Saying "your consistency is down"
        // to a student with four days of data would be a fabrication, and the
        // nudge quotes the number it is claiming.
        if (!delta || delta.delta > MAX_CONSISTENCY_DELTA) { counts.skippedTrend += 1; continue; }

        await notify({
          user: row.user,
          type: 'suggestion',
          title: NUDGE_TITLE_PREFIX,
          body: buildBody({
            daysToPlacement,
            overdue: row.signals.overdueTasks,
            delta,
          }),
          link: '/planner',
          // Belt and braces with the cooldown above: if two runs overlap, the
          // dedup window still collapses them.
          dedupWindowMs: NUDGE_COOLDOWN_MS,
        });
        counts.sent += 1;
      } catch (err) {
        counts.failed += 1;
        console.warn(`[judgment-nudge] user ${row.user} failed: ${err.message}`);
      }
    }

    console.log(
      `[judgment-nudge] ${counts.candidates} candidates, ${counts.sent} nudged, `
      + `${counts.skippedCooldown} on cooldown, ${counts.skippedTrend} without a falling trend, ${counts.failed} failed`
    );
    return { itemsProcessed: counts.sent, meta: counts };
  });
}

module.exports = {
  sendJudgmentNudges,
  buildBody,
  NUDGE_TITLE_PREFIX,
  PLACEMENT_WINDOW_DAYS,
  MIN_OVERDUE_TASKS,
  MAX_CONSISTENCY_DELTA,
};
