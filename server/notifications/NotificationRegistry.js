/**
 * NotificationRegistry — single source of truth for all notification types.
 *
 * Every notification type in DATAD is defined here with:
 *   • Display metadata (label, icon, color, priority)
 *   • Channel defaults (inApp, email, push)
 *   • Grouping rules (dedup window, max group size)
 *
 * Controllers, services and event handlers reference this registry
 * rather than hardcoding type strings. New notification types MUST be
 * added here first so the system stays consistent.
 */

const REGISTRY = {
  // ── Social / Community ─────────────────────────────────────────────
  reaction: {
    label: 'Reaction',
    icon: '👍',
    color: '#f43f5e',
    priority: 3,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 5 * 60 * 1000,
    description: 'Someone liked, reacted to, or rated your content',
  },
  rsvp: {
    label: 'Event RSVP',
    icon: '📅',
    color: '#8b5cf6',
    priority: 2,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 5 * 60 * 1000,
    description: 'Someone RSVP\'d to your event',
  },
  mention: {
    label: 'Mention',
    icon: '@',
    color: '#f59e0b',
    priority: 1,
    channels: { inApp: true, email: true, push: false },
    groupWindowMs: 60 * 1000,
    description: 'Someone mentioned you in a post or reply',
  },
  announcement: {
    label: 'Announcement',
    icon: '📢',
    color: '#06b6d4',
    priority: 1,
    channels: { inApp: true, email: true, push: false },
    groupWindowMs: 0,
    description: 'Admin or system wide announcement',
  },

  // ── Tasks & Planning ───────────────────────────────────────────────
  task: {
    label: 'Task',
    icon: '✓',
    color: '#10b981',
    priority: 2,
    channels: { inApp: true, email: true, push: true },
    groupWindowMs: 30 * 60 * 1000,
    description: 'Task assigned, due soon, overdue, or completed',
  },

  // ── Career / Placements ────────────────────────────────────────────
  career_alert: {
    label: 'Career Alert',
    icon: '💼',
    color: '#3b82f6',
    priority: 1,
    channels: { inApp: true, email: true, push: true },
    groupWindowMs: 60 * 60 * 1000,
    description: 'Placement updates, application status, job matches',
  },
  placement_apply: {
    label: 'Placement',
    icon: '💼',
    color: '#3b82f6',
    priority: 1,
    channels: { inApp: true, email: true, push: true },
    groupWindowMs: 0,
    description: 'Placement drive or application action',
  },

  // ── Achievements & Milestones ──────────────────────────────────────
  milestone: {
    label: 'Milestone',
    icon: '🏆',
    color: '#f59e0b',
    priority: 1,
    channels: { inApp: true, email: true, push: false },
    groupWindowMs: 0,
    description: 'Streaks, achievements, completed goals',
  },

  // ── Subscription / Billing ─────────────────────────────────────────
  subscription: {
    label: 'Subscription',
    icon: '⭐',
    color: '#8b5cf6',
    priority: 1,
    channels: { inApp: true, email: true, push: false },
    groupWindowMs: 24 * 60 * 60 * 1000,
    description: 'Trial expiry, plan changes, renewals',
  },
  billing: {
    label: 'Billing',
    icon: '💰',
    color: '#10b981',
    priority: 1,
    channels: { inApp: true, email: true, push: true },
    groupWindowMs: 0,
    description: 'Payment success, failure, invoices',
  },
  credit_alert: {
    label: 'Credit Alert',
    icon: '📊',
    color: '#f59e0b',
    priority: 1,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 0,
    description: 'AI credits running low or exhausted',
  },

  // ── AI / Dax / Intelligence ────────────────────────────────────────
  ai_complete: {
    label: 'AI Complete',
    icon: '🤖',
    color: '#8b5cf6',
    priority: 2,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 30 * 60 * 1000,
    description: 'AI task completed (resume analysis, briefing, etc.)',
  },
  ai_error: {
    label: 'AI Error',
    icon: '⚠️',
    color: '#f43f5e',
    priority: 1,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 5 * 60 * 1000,
    description: 'AI task failed to complete',
  },
  suggestion: {
    label: 'Suggestion',
    icon: '💡',
    color: '#3b82f6',
    priority: 3,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 60 * 60 * 1000,
    description: 'Dax recommendation or study suggestion',
  },

  // ── System ─────────────────────────────────────────────────────────
  general: {
    label: 'General',
    icon: '💬',
    color: '#6b7280',
    priority: 3,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 5 * 60 * 1000,
    description: 'Catch-all for uncategorized notifications',
  },
  system: {
    label: 'System',
    icon: '🔧',
    color: '#6b7280',
    priority: 2,
    channels: { inApp: true, email: false, push: false },
    groupWindowMs: 0,
    description: 'Maintenance, updates, new features',
  },
  session: {
    label: 'Session',
    icon: '🔒',
    color: '#f43f5e',
    priority: 1,
    channels: { inApp: true, email: false, push: true },
    groupWindowMs: 0,
    description: 'Session expiry, login alerts, security events',
  },
};

// ── Access helpers ────────────────────────────────────────────────────────

function get(type) {
  return REGISTRY[type] || REGISTRY.general;
}

function getColor(type) {
  return get(type).color;
}

function getIcon(type) {
  return get(type).icon;
}

function getPriority(type) {
  return get(type).priority;
}

function getAllTypes() {
  return Object.keys(REGISTRY);
}

function getHighPriorityTypes() {
  return Object.entries(REGISTRY)
    .filter(([, v]) => v.priority <= 1)
    .map(([k]) => k);
}

module.exports = {
  REGISTRY,
  get,
  getColor,
  getIcon,
  getPriority,
  getAllTypes,
  getHighPriorityTypes,
};
