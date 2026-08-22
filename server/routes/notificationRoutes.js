const router = require('express').Router();
const c = require('../controllers/notificationController');
const verifyToken = require('../middleware/verifyToken');
// EventSource cannot send an Authorization header, so the stream takes its
// token from the query string. The middleware moves it into the header slot and
// defers to verifyToken — see middleware/sseAuth.js for why it must not verify
// the token itself.
const sseAuth = require('../middleware/sseAuth');
const { sseHandler } = require('../notifications/NotificationStream');

router.get('/stream', sseAuth, sseHandler);

// All other routes require standard auth
router.use(verifyToken);
router.get('/', c.list);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', c.markRead);
router.delete('/:id', c.remove);

module.exports = router;
