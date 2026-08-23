// Vocabulary for the Talent Exchange, mirroring the enums in
// server/models/Opportunity.js. The server rejects anything outside these sets,
// so they are kept in the same order and spelling as the model.

export const KINDS = [
  { value: 'need_help', label: 'I need help', blurb: 'Someone to help you with a specific task.' },
  { value: 'collaborator', label: 'Looking for a collaborator', blurb: 'A teammate for a project or club work.' },
  { value: 'offer', label: 'I can help others', blurb: 'A service you are offering.' },
];

export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export const CATEGORIES = [
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'resume_review', label: 'Resume review' },
  { value: 'mock_interview', label: 'Mock interview' },
  { value: 'coding_help', label: 'Coding help' },
  { value: 'assignment_help', label: 'Assignment help' },
  { value: 'research', label: 'Research' },
  { value: 'design', label: 'Design' },
  { value: 'club_work', label: 'Club work' },
  { value: 'team_formation', label: 'Team formation' },
  { value: 'mentoring', label: 'Mentoring' },
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

export const URGENCIES = [
  { value: 'low', label: 'Whenever' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Soon' },
  { value: 'urgent', label: 'Urgent' },
];

export const URGENCY_LABEL = Object.fromEntries(URGENCIES.map((u) => [u.value, u.label]));

// Only 'high' and 'urgent' get a colour. Badging every post defeats the point.
export const URGENCY_CLASS = {
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const STATUS_LABEL = {
  draft: 'Draft',
  open: 'Open',
  matched: 'Matched',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const APPLICATION_STATUS_LABEL = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

/**
 * Talent Credits are the exchange's own unit — a bookkeeping entry in the
 * credit ledger, not money. Rendering them as a bare number invites the reading
 * that they are rupees, so they are always named.
 */
export function formatCredits(n) {
  if (!n) return 'No credits';
  return `${n} credit${n === 1 ? '' : 's'}`;
}

export function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
