/**
 * domainEvents — convenience emitters for every DATAD domain.
 *
 * Every controller/service calls these instead of notify() directly.
 * This keeps the event-driven pattern consistent and makes every
 * business action visible to downstream consumers (notifications,
 * analytics, intelligence layer).
 *
 * Usage:
 *   const events = require('../events/domainEvents');
 *   await events.career.applicationSubmitted(userId, { companyName, applicationId });
 */

const bus = require('./index');
const logger = require('../utils/logger');

function safe(type, userId, data) {
  return Promise.resolve(bus.emit(type, userId, data)).catch((err) => {
    logger.warn(`[domainEvents] Failed to emit ${type}: ${err.message}`);
  });
}

const domainEvents = {
  // ── Career / Placements ───────────────────────────────────────────────
  // NOTE: talent/events.js uses 'application.*' for talent marketplace;
  // career events use 'career.application-*' to avoid collision.
  career: {
    applicationSubmitted(userId, data) { return safe('career.application-submitted', userId, data); },
    applicationAccepted(userId, data) { return safe('career.application-accepted', userId, data); },
    applicationRejected(userId, data) { return safe('career.application-rejected', userId, data); },
    applicationWithdrawn(userId, data) { return safe('career.application-withdrawn', userId, data); },
    driveAdded(userId, data) { return safe('career.drive-added', userId, data); },
    resumeAnalysisComplete(userId, data) { return safe('career.resume-analysis-complete', userId, data); },
    atsScoreUpdated(userId, data) { return safe('career.ats-score-updated', userId, data); },
  },

  // ── Study / Learning ─────────────────────────────────────────────────
  study: {
    casePublished(userId, data) { return safe('study.case-published', userId, data); },
    quizCompleted(userId, data) { return safe('study.quiz-completed', userId, data); },
    studyPlanGenerated(userId, data) { return safe('study.plan-generated', userId, data); },
    deadlineApproaching(userId, data) { return safe('study.deadline-approaching', userId, data); },
    resourceAdded(userId, data) { return safe('study.resource-added', userId, data); },
  },

  // ── Planner / Tasks ──────────────────────────────────────────────────
  planner: {
    taskCreated(userId, data) { return safe('planner.task-created', userId, data); },
    taskAssigned(userId, data) { return safe('planner.task-assigned', userId, data); },
    taskCompleted(userId, data) { return safe('planner.task-completed', userId, data); },
    taskDueSoon(userId, data) { return safe('planner.task-due-soon', userId, data); },
    taskOverdue(userId, data) { return safe('planner.task-overdue', userId, data); },
  },

  // ── Finance ──────────────────────────────────────────────────────────
  finance: {
    budgetExceeded(userId, data) { return safe('finance.budget-exceeded', userId, data); },
    expenseAdded(userId, data) { return safe('finance.expense-added', userId, data); },
    incomeAdded(userId, data) { return safe('finance.income-added', userId, data); },
    monthlySummary(userId, data) { return safe('finance.monthly-summary', userId, data); },
  },

  // ── AI / Dax ─────────────────────────────────────────────────────────
  ai: {
    taskCompleted(userId, data) { return safe('ai.task-completed', userId, data); },
    taskFailed(userId, data) { return safe('ai.task-failed', userId, data); },
    creditsExhausted(userId, data) { return safe('ai.credits-exhausted', userId, data); },
    creditsLow(userId, data) { return safe('ai.credits-low', userId, data); },
    profileRefreshed(userId, data) { return safe('profile.refreshed', userId, data); },
    feedbackRecorded(userId, data) { return safe('feedback.recorded', userId, data); },
  },

  // ── Subscription / Billing ───────────────────────────────────────────
  subscription: {
    trialActivated(userId, data) { return safe('subscription.trial-activated', userId, data); },
    planExpiring(userId, data) { return safe('subscription.plan-expiring', userId, data); },
    planExpired(userId, data) { return safe('subscription.plan-expired', userId, data); },
    planRenewed(userId, data) { return safe('subscription.plan-renewed', userId, data); },
    paymentSubmitted(userId, data) { return safe('subscription.payment-submitted', userId, data); },
    paymentApproved(userId, data) { return safe('subscription.payment-approved', userId, data); },
    paymentRejected(userId, data) { return safe('subscription.payment-rejected', userId, data); },
  },

  // ── Study Streaks / Achievements ─────────────────────────────────────
  achievement: {
    streakMilestone(userId, data) { return safe('achievement.streak-milestone', userId, data); },
    journalStreak(userId, data) { return safe('achievement.journal-streak', userId, data); },
    caseStreak(userId, data) { return safe('achievement.case-streak', userId, data); },
  },

  // ── Social / Collaboration ───────────────────────────────────────────
  social: {
    mention(userId, data) { return safe('social.mention', userId, data); },
    reaction(userId, data) { return safe('social.reaction', userId, data); },
    reply(userId, data) { return safe('social.reply', userId, data); },
    eventRsvp(userId, data) { return safe('social.event-rsvp', userId, data); },
    eventCreated(userId, data) { return safe('social.event-created', userId, data); },
    skillRated(userId, data) { return safe('social.skill-rated', userId, data); },
  },

  // ── Admin / System ──────────────────────────────────────────────────
  admin: {
    accountApproved(userId, data) { return safe('admin.account-approved', userId, data); },
    announcementPosted(userId, data) { return safe('admin.announcement-posted', userId, data); },
    newSignups(userId, data) { return safe('admin.new-signups', userId, data); },
  },

  // ── System ──────────────────────────────────────────────────────────
  system: {
    maintenance(userId, data) { return safe('system.maintenance', userId, data); },
    newFeature(userId, data) { return safe('system.new-feature', userId, data); },
    sessionExpiry(userId, data) { return safe('system.session-expiry', userId, data); },
  },

  // ── Intelligence / Analytics ─────────────────────────────────────────
  intelligence: {
    insightReady(userId, data) { return safe('intelligence.insight-ready', userId, data); },
    briefingReady(userId, data) { return safe('intelligence.briefing-ready', userId, data); },
    newsletterReady(userId, data) { return safe('intelligence.newsletter-ready', userId, data); },
  },
};

module.exports = domainEvents;
