const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const studioUpload = require('../middleware/studioUpload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');
const { heavyLimiter } = require('../middleware/rateLimiters');
const c = require('../controllers/studioController');

const router = express.Router();

// Content Studio is admin-only.
router.use(verifyToken, checkRole('admin'));

router.post(
  '/uploads',
  heavyLimiter,
  checkRequestSize(LIMITS.studioRequest),
  studioUpload.array('files', LIMITS.studioFiles),
  verifyFileSignatures,
  c.upload
);
router.get('/destinations', c.destinations);
router.get('/items', c.list);
router.get('/items/:id', c.get);
router.patch('/items/:id', c.update);
router.post('/items/:id/publish', c.publish);
router.post('/items/:id/draft', c.draft);
router.post('/items/:id/schedule', c.schedule);
router.post('/items/:id/reanalyze', c.reanalyze);
router.delete('/items/:id', c.remove);

module.exports = router;
