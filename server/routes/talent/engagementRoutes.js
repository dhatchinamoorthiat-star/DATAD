const router = require('express').Router();
const c = require('../../controllers/talent/engagementController');

router.get('/', c.listMine);
router.get('/:id', c.getById);
router.post('/:id/start', c.start);
router.post('/:id/submit', c.submit);
router.post('/:id/complete', c.complete);
router.post('/:id/cancel', c.cancel);
router.post('/:id/dispute', c.dispute);

module.exports = router;
