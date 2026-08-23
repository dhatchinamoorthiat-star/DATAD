/**
 * Scheduler registry — registers all cron jobs using node-cron.
 * Called once from server/index.js after the DB connects.
 * Each job catches its own errors so one failure never kills the rest.
 */
const cron = require('node-cron');
const cfg = require('../config/automation');

// Automation modules
const { generateDailyCase }         = require('../automation/cases/generateDailyCase');
const { generateDailyBriefing }     = require('../automation/briefing/generateDailyBriefing');
const { generateDailyReflection }   = require('../automation/reflections/generateDailyReflection');
const { generateResumeTip }         = require('../automation/resume/generateResumeTip');
const { enrichCompanies }           = require('../automation/companies/enrichCompanies');
const { generateInterviewQuestions }= require('../automation/interviews/generateInterviewQuestions');
const { moderatePosts }             = require('../automation/moderation/moderatePosts');
const { generateWeeklyNewsletter }  = require('../automation/newsletter/generateWeeklyNewsletter');
const { sendPlannerReminders }      = require('../automation/planner/plannerReminders');
const { sendOverdueReminders }      = require('../automation/reminders/overdueTasksReminder');
const { sendRsvpReminders }         = require('../automation/reminders/rsvpEventReminder');
const { sendCalendarEventReminders }= require('../automation/reminders/calendarEventReminder');
const { sendTrialExpiryReminders }  = require('../automation/reminders/trialExpiryReminder');
const { sendJournalNudges }         = require('../automation/reminders/journalNudge');
const { checkStreakMilestones }     = require('../automation/reminders/streakMilestone');
const { snapshotProfiles }          = require('../automation/intelligence/snapshotProfiles');
const { resolvePredictions }        = require('../automation/intelligence/resolvePredictions');
const { computeCohortInsights }     = require('../automation/intelligence/computeCohortInsights');
const { sendJudgmentNudges }        = require('../automation/intelligence/sendJudgmentNudges');

// Existing services (kept running via cron instead of setInterval)
const { refreshNews }   = require('../services/newsFetcher');
const { refreshMarket } = require('../services/marketFetcher');
const { refreshStocks, refreshStocksIfStale } = require('../services/stockFetcher');

function safe(name, fn) {
  return async () => {
    try { await fn(); }
    catch (err) { console.error(`[scheduler:${name}] uncaught error: ${err.message}`); }
  };
}

function register() {
  const s = cfg.schedules;

  // ── Every 15 min: market data ───────────────────────────────────────────────
  cron.schedule(s.marketRefresh, safe('market-refresh', refreshMarket));

  // ── 1am daily: stock watchlist quotes ───────────────────────────────────────
  cron.schedule(s.stockRefresh, safe('stock-refresh', refreshStocks));
  // Prime on boot whenever the stored quotes have gone stale — not just when
  // the collection is empty. This instance spins down when idle, so a boot is
  // usually a wake-up after a stretch of missed cron ticks, and the old
  // empty-only check meant those quotes stayed frozen at whatever the very
  // first run ever wrote.
  safe('stock-refresh-initial', refreshStocksIfStale)();

  // ── Every 30 min: news RSS + enhancement ────────────────────────────────────
  cron.schedule(s.newsRefresh, safe('news-refresh', refreshNews));

  // ── Every 10 min: discussion moderation ─────────────────────────────────────
  cron.schedule(s.moderation, safe('moderation', moderatePosts));

  // ── 02:30 UTC (08:00 IST): freeze each active student's profile ─────────────
  // Runs before every content job: snapshot history cannot be backfilled, so a
  // missed run is a permanently lost day of that student's history.
  cron.schedule(s.profileSnapshot, safe('profile-snapshot', snapshotProfiles));

  // ── 03:00 UTC (08:30 IST): settle predictions that came due ────────────────
  // After the snapshot job, so the reading a due prediction is judged against
  // is already written.
  cron.schedule(s.predictionResolve, safe('prediction-resolve', resolvePredictions));

  // ── 03:30 UTC (09:00 IST): rebuild k-anonymous cohort aggregates ───────────
  cron.schedule(s.cohortInsights, safe('cohort-insights', computeCohortInsights));

  // ── 04:00 UTC (09:30 IST): the one job that pushes judgement, not content ──
  // Hard-capped at one nudge per student per day — see the job's header.
  cron.schedule(s.judgmentNudge, safe('judgment-nudge', sendJudgmentNudges));

  // ── 5am daily: case study ───────────────────────────────────────────────────
  cron.schedule(s.dailyCase, safe('daily-case', generateDailyCase));

  // ── 6am daily: briefing + reflection ────────────────────────────────────────
  cron.schedule(s.dailyBriefing, safe('daily-briefing', generateDailyBriefing));
  cron.schedule(s.dailyReflection, safe('daily-reflection', generateDailyReflection));

  // ── 7am daily: resume tip ───────────────────────────────────────────────────
  cron.schedule(s.resumeTip, safe('resume-tip', generateResumeTip));

  // ── 2am daily: company enrichment ───────────────────────────────────────────
  cron.schedule(s.companyRefresh, safe('company-enrichment', enrichCompanies));

  // ── 4am Sunday: interview questions ─────────────────────────────────────────
  cron.schedule(s.interviewQuestions, safe('interview-questions', generateInterviewQuestions));

  // ── 8am Sunday: weekly newsletter ───────────────────────────────────────────
  cron.schedule(s.newsletter, safe('weekly-newsletter', generateWeeklyNewsletter));

  // ── 8am daily: planner due-date reminders + overdue tasks ──────────────────
  cron.schedule('0 8 * * *', safe('planner-reminders', sendPlannerReminders));
  cron.schedule('0 9 * * *', safe('overdue-tasks', sendOverdueReminders));

  // ── 8am daily: RSVP + calendar event reminders for tomorrow ─────────────────
  cron.schedule('0 8 * * *', safe('rsvp-reminder', sendRsvpReminders));
  cron.schedule('0 8 * * *', safe('calendar-reminder', sendCalendarEventReminders));

  // ── 7am daily: trial/subscription expiry reminders ──────────────────────────
  cron.schedule('0 7 * * *', safe('trial-expiry', sendTrialExpiryReminders));

  // ── 10pm daily: journal nudge for users who haven't written in 3 days ───────
  cron.schedule('0 22 * * *', safe('journal-nudge', sendJournalNudges));

  // ── After daily case (5:30am): streak milestone check ───────────────────────
  cron.schedule('30 5 * * *', safe('streak-milestone', checkStreakMilestones));

  // ── Every minute: publish scheduled Content Studio items ───────────────────
  if (process.env.STUDIO_ENABLED !== 'false') {
    const { publishDue } = require('../services/publishing/publishService');
    cron.schedule('* * * * *', safe('studio-scheduled-publish', publishDue));
  }

  console.log('[schedulers] All cron jobs registered');
}

module.exports = { register };
