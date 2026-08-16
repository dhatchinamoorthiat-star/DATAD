/**
 * Event → Notification bridge — complete domain coverage.
 *
 * Registers BusEvent handlers for every DATAD domain so that every
 * meaningful state change can optionally surface as a notification.
 *
 * A controller emits a BusEvent; this bridge maps it to a notification.
 * This keeps controllers unaware of the notification system.
 *
 * Called once from server startup (events/handlers/index.js).
 */

const notificationService = require('../notifications/NotificationService');

// ── Message templates ────────────────────────────────────────────────────

const MESSAGES = {
  // ── Career / Placements ──────────────────────────────────────────────
  'career.application-submitted': {
    type: 'career_alert', title: 'Application submitted!',
    body: (d) => `You applied to ${d.companyName || 'a company'}`,
    link: (d) => `/career/applications/${d.applicationId}`,
  },
  'career.application-accepted': {
    type: 'career_alert', title: 'Application accepted! 🎉',
    body: (d) => `${d.companyName || 'A company'} accepted your application`,
    link: (d) => `/career/applications/${d.applicationId}`,
  },
  'career.application-rejected': {
    type: 'career_alert', title: 'Application update',
    body: (d) => `${d.companyName || 'A company'} has updated your application status`,
    link: (d) => `/career/applications/${d.applicationId}`,
  },
  'career.application-withdrawn': {
    type: 'career_alert', title: 'Application withdrawn',
    body: (d) => `You withdrew from ${d.companyName || 'a company'}`,
    link: () => `/career/applications`,
  },
  'career.drive-added': {
    type: 'career_alert', title: 'New placement drive! 🚀',
    body: (d) => `${d.companyName || 'A company'} added a new drive`,
    link: (d) => `/career/placements/${d.driveId}`,
  },
  'career.resume-analysis-complete': {
    type: 'ai_complete', title: 'Resume analysis complete',
    body: (d) => `Your ATS score: ${d.atsScore || 'ready'} — check the improvements`,
    link: () => `/resume`,
  },
  'career.ats-score-updated': {
    type: 'career_alert', title: 'ATS score updated',
    body: (d) => `Your resume ATS score is now ${d.score}`,
    link: () => `/resume`,
  },

  // ── Study / Learning ─────────────────────────────────────────────────
  'study.case-published': {
    type: 'general', title: "Today's case is live 📚",
    body: (d) => `${d.category || 'New'} case — ${d.difficulty || ''}`,
    link: () => '/study',
  },
  'study.quiz-completed': {
    type: 'milestone', title: 'Quiz completed! 🎯',
    body: (d) => `Score: ${d.score || 0}${d.total ? `/${d.total}` : ''}`,
    link: () => '/study',
  },
  'study.plan-generated': {
    type: 'ai_complete', title: 'Study plan ready 📋',
    body: () => 'Dax generated a personalised study plan for you',
    link: () => '/study',
  },
  'study.deadline-approaching': {
    type: 'task', title: 'Deadline approaching ⏰',
    body: (d) => `${d.title || 'A deadline'} is due ${d.daysUntil ? `in ${d.daysUntil} days` : 'soon'}`,
    link: (d) => `/study${d.link || ''}`,
  },
  'study.resource-added': {
    type: 'general', title: 'New study resource 📄',
    body: (d) => `${d.title || 'Resource'} added to ${d.subject || 'your subjects'}`,
    link: () => '/study/resources',
  },

  // ── Planner / Tasks ──────────────────────────────────────────────────
  'planner.task-created': {
    type: 'task', title: 'Task created',
    body: (d) => `"${d.title}" created${d.dueDate ? ` — due ${new Date(d.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`,
    link: () => '/me/planner',
  },
  'planner.task-assigned': {
    type: 'task', title: 'New task assigned 📋',
    body: (d) => `"${d.title}" assigned to you by ${d.by || 'someone'}`,
    link: () => '/me/planner',
  },
  'planner.task-completed': {
    type: 'task', title: 'Task completed ✅',
    body: (d) => `"${d.title}" marked done`,
    link: () => '/me/planner',
  },
  'planner.task-due-soon': {
    type: 'task', title: 'Task due soon ⏰',
    body: (d) => `"${d.title}" is due ${d.dueFmt || 'soon'}`,
    link: () => '/me/planner',
  },
  'planner.task-overdue': {
    type: 'task', title: 'Overdue task ⚠️',
    body: (d) => `"${d.title}" was due ${d.dueFmt || 'recently'}`,
    link: () => '/me/planner',
  },

  // ── Finance ──────────────────────────────────────────────────────────
  'finance.budget-exceeded': {
    type: 'general', title: 'Monthly budget exceeded 📊',
    body: (d) => `Spent ₹${Number(d.spent || 0).toLocaleString('en-IN')} of ₹${Number(d.budget || 0).toLocaleString('en-IN')}`,
    link: () => '/me/finance',
  },
  'finance.expense-added': {
    type: 'general', title: 'Expense recorded',
    body: (d) => `₹${Number(d.amount || 0).toLocaleString('en-IN')} — ${d.category || 'uncategorised'}`,
    link: () => '/me/finance',
  },
  'finance.income-added': {
    type: 'general', title: 'Income recorded',
    body: (d) => `₹${Number(d.amount || 0).toLocaleString('en-IN')} added`,
    link: () => '/me/finance',
  },
  'finance.monthly-summary': {
    type: 'general', title: 'Monthly finance summary 📊',
    body: (d) => `Earned ₹${Number(d.income || 0).toLocaleString('en-IN')}, spent ₹${Number(d.expenses || 0).toLocaleString('en-IN')}`,
    link: () => '/me/finance',
  },

  // ── AI / Dax ─────────────────────────────────────────────────────────
  'ai.task-completed': {
    type: 'ai_complete', title: 'Task complete 🤖',
    body: (d) => d.result || 'Dax finished what you asked',
    link: (d) => d.link || '/dax',
  },
  'ai.task-failed': {
    type: 'ai_error', title: 'Task failed ⚠️',
    body: (d) => d.error || 'Dax couldn\'t complete this task',
    link: () => '/dax',
  },
  'ai.credits-exhausted': {
    type: 'credit_alert', title: 'AI credits exhausted',
    body: (d) => `All ${d.limit || ''} daily credits used. Upgrade or wait until tomorrow`,
    link: () => '/subscribe',
  },
  'ai.credits-low': {
    type: 'credit_alert', title: 'AI credits running low',
    body: (d) => `${d.remaining || 0} of ${d.limit || 0} daily credits remaining`,
    link: () => '/subscribe',
  },

  // ── Subscription / Billing ───────────────────────────────────────────
  'subscription.trial-activated': {
    type: 'subscription', title: '14-day trial activated! ⭐',
    body: (d) => `Full access until ${d.trialEnd || 'soon'}`,
    link: () => '/subscribe',
  },
  'subscription.plan-expiring': {
    type: 'subscription', title: 'Plan expiring soon',
    body: (d) => `Your ${d.tier || ''} plan expires on ${d.date || 'soon'}. Renew to keep access`,
    link: () => '/subscribe',
  },
  'subscription.plan-expired': {
    type: 'subscription', title: 'Plan expired',
    body: (d) => `Your ${d.tier || ''} plan has expired. Upgrade again to regain access`,
    link: () => '/subscribe',
  },
  'subscription.plan-renewed': {
    type: 'subscription', title: 'Plan renewed! 🎉',
    body: (d) => `Your ${d.tier || ''} plan is active${d.validTill ? ` until ${d.validTill}` : ''}`,
    link: () => '/subscribe',
  },
  'subscription.payment-submitted': {
    type: 'billing', title: 'Payment submitted',
    body: () => 'Your payment reference has been submitted for verification',
    link: () => '/subscribe',
  },
  'subscription.payment-approved': {
    type: 'billing', title: 'Payment approved ✅',
    body: (d) => `Your ${d.tier || ''} plan is now active — valid for 1 month`,
    link: () => '/subscribe',
  },
  'subscription.payment-rejected': {
    type: 'billing', title: 'Payment review update',
    body: (d) => d.reason || 'Your payment was not approved. Please submit a new reference',
    link: () => '/subscribe',
  },

  // ── Achievements / Milestones ────────────────────────────────────────
  'achievement.streak-milestone': {
    type: 'milestone', title: 'Streak milestone! 🏆',
    body: (d) => `${d.streak || 0}-day streak! ${d.message || 'Keep it up!'}`,
    link: () => '/study',
  },
  'achievement.journal-streak': {
    type: 'milestone', title: 'Journal streak 📝',
    body: (d) => `You've journaled ${d.days || ''} days in a row!`,
    link: () => '/me/journal',
  },
  'achievement.case-streak': {
    type: 'milestone', title: 'Case streak! 📚',
    body: (d) => `${d.streak || 0} cases in a row — consistency pays off`,
    link: () => '/study',
  },

  // ── Social / Collaboration ───────────────────────────────────────────
  'social.mention': {
    type: 'mention', title: 'You were mentioned',
    body: (d) => `${d.by || 'Someone'} mentioned you in a post`,
    link: (d) => `/community/feed/${d.postId}`,
  },
  'social.reaction': {
    type: 'reaction', title: 'New reaction',
    body: (d) => `${d.by || 'Someone'} ${d.reaction || 'reacted to'} your ${d.contentType || 'post'}`,
    link: (d) => `/community/feed/${d.contentId}`,
  },
  'social.reply': {
    type: 'reaction', title: 'New reply',
    body: (d) => `${d.by || 'Someone'} replied to your ${d.contentType || 'post'}`,
    link: (d) => `/community/feed/${d.contentId}`,
  },
  'social.event-rsvp': {
    type: 'rsvp', title: 'New RSVP',
    body: (d) => `${d.by || 'Someone'} is ${d.status || 'attending'} your event`,
    link: (d) => `/community/events/${d.eventId}`,
  },
  'social.event-created': {
    type: 'general', title: 'New event created 📅',
    body: (d) => `"${d.title || 'An event'}" — ${d.date || ''}`,
    link: (d) => `/community/events/${d.eventId}`,
  },
  'social.skill-rated': {
    type: 'reaction', title: 'Skill rated',
    body: (d) => `${d.by || 'Someone'} rated your skill: ${d.skill || ''} (${d.rating || 0}/5)`,
    link: () => '/community/skills',
  },

  // ── Admin / System ───────────────────────────────────────────────────
  'admin.account-approved': {
    type: 'general', title: 'Welcome to DATAD! 🎓',
    body: (d) => `${d.name || 'Your'} account has been approved`,
    link: () => '/',
  },
  'admin.announcement-posted': {
    type: 'announcement', title: (d) => d.title || 'New announcement 📢',
    body: (d) => d.body || '',
    link: () => '/community/announcements',
  },

  // ── System ───────────────────────────────────────────────────────────
  'system.maintenance': {
    type: 'system', title: 'Scheduled maintenance 🔧',
    body: (d) => `DATAD will be down on ${d.date || 'soon'} for maintenance${d.duration ? ` (${d.duration})` : ''}`,
  },
  'system.new-feature': {
    type: 'system', title: 'New feature available ✨',
    body: (d) => d.description || 'Check out what\'s new in DATAD',
    link: () => '/whats-new',
  },

  // ── Intelligence / Analytics ─────────────────────────────────────────
  'intelligence.insight-ready': {
    type: 'ai_complete', title: 'New insight available 💡',
    body: (d) => d.headline || 'Dax has a personalised insight for you',
    link: () => '/intelligence',
  },
  'intelligence.briefing-ready': {
    type: 'ai_complete', title: 'Daily briefing ready 📋',
    body: (d) => d.headline || 'Your daily briefing is ready',
    link: () => '/briefing',
  },
  'intelligence.newsletter-ready': {
    type: 'announcement', title: 'Weekly newsletter 📬',
    body: (d) => d.preheader || 'Your weekly DATAD newsletter is ready',
    link: () => '/briefing',
  },

  // ── Engagement / Talent (existing) ───────────────────────────────────
  'engagement.started': {
    type: 'general', title: 'Engagement started',
    body: (d) => `A new engagement has begun${d.helperName ? ` with ${d.helperName}` : ''}`,
    link: (d) => `/career/engagements/${d.engagementId}`,
  },
  'engagement.submitted': {
    type: 'general', title: 'Engagement submitted',
    body: () => 'Your engagement has been submitted for review',
    link: (d) => `/career/engagements/${d.engagementId}`,
  },
  'engagement.completed': {
    type: 'milestone', title: 'Engagement completed! 🎉',
    body: () => 'Engagement completed successfully',
    link: (d) => `/career/engagements/${d.engagementId}`,
  },
  'engagement.cancelled': {
    type: 'general', title: 'Engagement cancelled',
    body: () => 'An engagement has been cancelled',
    link: () => `/career/engagements`,
  },
  'review.created': {
    type: 'general', title: 'New review',
    body: (d) => `${d.reviewerName || 'Someone'} left a review`,
    link: (d) => `/career/reviews/${d.reviewId}`,
  },
  'profile.refresh-needed': {
    type: 'system', title: 'Profile update needed',
    body: () => 'Your intelligence profile needs a refresh — Dax is working on it',
  },
  'profile.refreshed': {
    type: 'ai_complete', title: 'Profile refreshed',
    body: (d) => `Your profile has been updated${d.readinessScore ? ` — Readiness: ${d.readinessScore}` : ''}`,
    link: () => '/intelligence',
  },
};

// ── Handler factory ──────────────────────────────────────────────────────

function createHandler(eventType, template) {
  return async (event) => {
    const userId = event.data?.userId || event.userId;
    if (!userId) return;

    const title = typeof template.title === 'function'
      ? template.title(event.data || {})
      : (template.title || '');
    const body = typeof template.body === 'function'
      ? template.body(event.data || {})
      : (template.body || '');
    const link = typeof template.link === 'function'
      ? template.link(event.data || {})
      : (template.link || '');

    await notificationService.send(userId, {
      type: template.type,
      title,
      body,
      link,
      actor: event.data?.actorUserId || event.data?.actor,
    });
  };
}

// ── Registration ─────────────────────────────────────────────────────────

function registerAll(events) {
  for (const [eventType, template] of Object.entries(MESSAGES)) {
    events.on(eventType, createHandler(eventType, template));
  }

  events.onAny((event) => {
    if (MESSAGES[event.type]) {
      console.debug(`[events→notifications] ${event.type} → notification for user ${event.userId}`);
    }
  });

  console.log(`[events→notifications] Registered ${Object.keys(MESSAGES).length} event→notification mappings`);
}

module.exports = { registerAll };
