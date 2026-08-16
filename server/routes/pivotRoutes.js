const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const c = require('../controllers/pivotController');

router.use(verifyToken);
router.get('/', c.get);
router.put('/', c.upsert);
router.patch('/gaps/:gapId', c.updateGap);

// Roadmap endpoints
router.post('/generate-roadmap', c.generateRoadmap);
router.get('/progress', c.getProgress);

module.exports = router;
