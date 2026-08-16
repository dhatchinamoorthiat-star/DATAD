const router = require('express').Router();
const c = require('../../controllers/talent/conversationController');

router.get('/', c.listMine);
router.post('/', c.create);
router.get('/:id/messages', c.getMessages);
router.post('/:id/messages', c.sendMessage);
router.post('/:id/read', c.markRead);

module.exports = router;
