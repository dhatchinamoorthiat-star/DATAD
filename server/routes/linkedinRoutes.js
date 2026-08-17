const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { heavyLimiter } = require('../middleware/rateLimiters');
const aiQuota = require('../middleware/aiQuota');
const { requireFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const c = require('../controllers/linkedinController');

/**
 * LinkedIn Enhancer.
 *
 * There is deliberately no endpoint that takes a LinkedIn URL and fetches it,
 * and none that accepts LinkedIn credentials. Automated retrieval of profiles
 * is against LinkedIn's terms, and asking a student for their password would
 * be indefensible whatever the terms said. Every route here operates on data
 * the student pasted, typed, or already gave DATAD.
 */
router.use(verifyToken);

// Storing your own profile and target is free — it is your data, and a student
// who lapses to free must still be able to read back what they already ran.
router.get('/', c.getState);
router.put('/profile', c.saveProfile);
router.put('/target', c.setTarget);

// Both of these run the full pipeline including a model call, so they share
// the heavy budget with resume rendering and the other send paths.
//
// They also carried no feature gate and no credit metering until now, so a free
// account could run unlimited model calls through them. Analysis is a Pro
// feature and is charged against the daily credit allowance like every other
// AI path.
router.post('/analyze', refreshTier, requireFeature(FEATURE.LINKEDIN_ENHANCER), heavyLimiter, aiQuota, c.analyze);
router.post('/job-match', refreshTier, requireFeature(FEATURE.LINKEDIN_ENHANCER), heavyLimiter, aiQuota, c.jobMatch);

router.get('/analyses', c.listAnalyses);
router.get('/analyses/:id', c.getAnalysis);
router.delete('/', c.remove);

module.exports = router;
