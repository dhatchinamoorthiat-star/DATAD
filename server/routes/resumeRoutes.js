const router = require('express').Router();
const {
  getMyResume,
  saveResume,
  submitResume,
  downloadResume,
} = require('../controllers/resumeController');
const verifyToken = require('../middleware/verifyToken');
const { heavyLimiter } = require('../middleware/rateLimiters');

router.use(verifyToken);
router.get('/', getMyResume);
// Rendering a PDF costs real CPU, so it shares the heavy budget with /submit.
router.get('/pdf', heavyLimiter, downloadResume);
router.put('/', saveResume);
// Submitting sends mail, so it is rate limited alongside the other send paths.
router.post('/submit', heavyLimiter, submitResume);

module.exports = router;
