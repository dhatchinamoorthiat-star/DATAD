const router = require('express').Router();
const c = require('../../controllers/talent/applicationController');

router.get('/', c.listMine);
router.post('/:id/withdraw', c.withdraw);
router.post('/:id/accept', c.accept);
router.post('/:id/reject', c.reject);

module.exports = router;
