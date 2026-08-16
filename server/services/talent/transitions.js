/**
 * Status-transition guards for the Talent Exchange lifecycles.
 *
 * Centralised so every service enforces the SAME state machine and an illegal
 * jump (e.g. completing an engagement that was never delivered) fails with a
 * clear 422 instead of a silent bad write. Pure functions — no DB, no I/O — so
 * they are cheap to unit-test.
 */

const { unprocessable } = require('./errors');

// opportunity: draft → open → matched → in_progress → completed
//              open/matched → cancelled ; open → expired ; (any) → archived(soft)
const OPPORTUNITY_TRANSITIONS = {
  draft: ['open', 'cancelled'],
  open: ['matched', 'cancelled', 'expired'],
  matched: ['in_progress', 'open', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
};

// application: pending → shortlisted → accepted ; pending/shortlisted → declined/withdrawn
const APPLICATION_TRANSITIONS = {
  pending: ['shortlisted', 'accepted', 'declined', 'withdrawn'],
  shortlisted: ['accepted', 'declined', 'withdrawn'],
  accepted: [],
  declined: [],
  withdrawn: [],
};

// engagement: accepted → in_progress → delivered → completed
//             accepted/in_progress → cancelled ; in_progress/delivered → disputed
const ENGAGEMENT_TRANSITIONS = {
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [],
  disputed: ['completed', 'refunded'],
  cancelled: [],
  refunded: [],
};

function assertTransition(map, from, to, label) {
  const allowed = map[from];
  if (!allowed) throw unprocessable(`Unknown ${label} status "${from}"`);
  if (!allowed.includes(to)) {
    throw unprocessable(`Cannot move ${label} from "${from}" to "${to}"`);
  }
}

module.exports = {
  OPPORTUNITY_TRANSITIONS,
  APPLICATION_TRANSITIONS,
  ENGAGEMENT_TRANSITIONS,
  assertOpportunity: (from, to) => assertTransition(OPPORTUNITY_TRANSITIONS, from, to, 'opportunity'),
  assertApplication: (from, to) => assertTransition(APPLICATION_TRANSITIONS, from, to, 'application'),
  assertEngagement: (from, to) => assertTransition(ENGAGEMENT_TRANSITIONS, from, to, 'engagement'),
};
