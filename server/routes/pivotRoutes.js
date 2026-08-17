const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const aiQuota = require('../middleware/aiQuota');
const { requireFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const c = require('../controllers/pivotController');

router.use(verifyToken);

// Reading and editing your own pivot plan stays free — it is your data, and a
// student who lapses must still be able to see the roadmap they already have.
router.get('/', c.get);
router.put('/', c.upsert);
router.patch('/gaps/:gapId', c.updateGap);
router.get('/progress', c.getProgress);

// Generating a roadmap is a model call that ran with no feature check and no
// credit metering, so any free account could spend AI budget on it without
// limit. It is now a Placement Pass feature and charges credits like every
// other AI path.
router.post('/generate-roadmap', refreshTier, requireFeature(FEATURE.CAREER_ROADMAP), aiQuota, c.generateRoadmap);

module.exports = router;
