/**
 * Lightweight feature flags — read from environment variables.
 *
 * All flags default to `true` (enabled) so the app works out of the box
 * in development. Set any flag to `'false'` to disable for beta segments
 * or gradual rollout.
 *
 * Usage:
 *   const features = require('../config/features');
 *   if (features.ROADMAP_AUTO_ADVANCE) { ... }
 */
const flags = {};

// ___ Beta feature flags ___
// Roadmap auto-advance from daily check-in notes
flags.ROADMAP_AUTO_ADVANCE = process.env.FF_ROADMAP_AUTO_ADVANCE !== 'false';
// Browse popular roles on empty roadmap
flags.ROADMAP_BROWSE_ROLES = process.env.FF_ROADMAP_BROWSE_ROLES !== 'false';
// Weekly trend view on the roadmap page
flags.ROADMAP_WEEKLY_TREND = process.env.FF_ROADMAP_WEEKLY_TREND !== 'false';
// Onboarding card on the dashboard
flags.DASHBOARD_ONBOARDING_CARD = process.env.FF_DASHBOARD_ONBOARDING_CARD !== 'false';
// Role discovery for first-year students
flags.ROLE_DISCOVERY = process.env.FF_ROLE_DISCOVERY !== 'false';

// ___ Platform feature flags ___
// Allow new user registration
flags.REGISTRATION_ENABLED = process.env.FF_REGISTRATION_ENABLED !== 'false';
// Allow AI roadmap generation (disable if provider costs are too high)
flags.AI_ROADMAP_GENERATION = process.env.FF_AI_ROADMAP_GENERATION !== 'false';
// Show beta analytics events (disable in prod if not needed)
flags.BETA_ANALYTICS = process.env.FF_BETA_ANALYTICS !== 'false';

module.exports = flags;
