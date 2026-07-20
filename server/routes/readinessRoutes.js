const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { requireFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const { getReadiness } = require('../controllers/readinessController');

router.get('/', verifyToken, refreshTier, requireFeature(FEATURE.READINESS_SCORE), getReadiness);

module.exports = router;
