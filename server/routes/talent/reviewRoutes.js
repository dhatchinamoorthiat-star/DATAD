const router = require('express').Router();
const c = require('../../controllers/talent/reviewController');

router.post('/', c.create);
router.get('/user/:userId', c.listForUser);

module.exports = router;
