const router = require('express').Router();
const {
  getMyResume,
  saveResume,
  submitResume,
  downloadResume,
  uploadResumePhoto,
  deleteResumePhoto,
} = require('../controllers/resumeController');
const verifyToken = require('../middleware/verifyToken');
const upload = require('../middleware/upload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');
const { heavyLimiter } = require('../middleware/rateLimiters');

router.use(verifyToken);
router.get('/', getMyResume);
// Rendering a PDF costs real CPU, so it shares the heavy budget with /submit.
router.get('/pdf', heavyLimiter, downloadResume);
router.put('/', saveResume);
// Submitting sends mail, so it is rate limited alongside the other send paths.
router.post('/submit', heavyLimiter, submitResume);
// The headshot. Same guard stack as every other image route: size refused on the
// declared Content-Length before anything is buffered, then the actual leading
// bytes checked against the declared type once multer has them.
router.post(
  '/photo',
  heavyLimiter,
  checkRequestSize(LIMITS.image),
  upload.single('photo'),
  verifyFileSignatures,
  uploadResumePhoto
);
router.delete('/photo', deleteResumePhoto);

module.exports = router;
