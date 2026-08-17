const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { heavyLimiter } = require('../middleware/rateLimiters');
const { checkRequestSize, verifyFileSignatures, MB } = require('../middleware/uploadGuards');
const linkedinPdfUpload = require('../middleware/linkedinUpload');
const c = require('../controllers/linkedinController');

/**
 * LinkedIn Enhancer.
 *
 * There is deliberately no endpoint that takes a LinkedIn URL and fetches it,
 * and none that accepts LinkedIn credentials. Automated retrieval of profiles
 * is against LinkedIn's terms, and asking a student for their password would
 * be indefensible whatever the terms said. Every route here operates on data
 * the student pasted, typed, or already gave DATAD.
 */
router.use(verifyToken);

router.get('/', c.getState);
router.put('/profile', c.saveProfile);

/**
 * The PDF export path. Downloading your own profile is LinkedIn's own feature,
 * so this is the best-provenance import of the three — nothing is fetched on
 * the student's behalf.
 *
 * Three gates before a byte is parsed: declared Content-Length, multer's
 * per-file limit plus a PDF-only MIME filter, then a leading-byte signature
 * check. Parsing shares the heavy budget because pdfjs is real CPU.
 */
router.post(
  '/profile/pdf',
  heavyLimiter,
  checkRequestSize(10 * MB),
  linkedinPdfUpload.single('file'),
  verifyFileSignatures,
  c.uploadPdf
);

router.put('/target', c.setTarget);

// Both of these run the full pipeline including a model call, so they share
// the heavy budget with resume rendering and the other send paths.
router.post('/analyze', heavyLimiter, c.analyze);
router.post('/job-match', heavyLimiter, c.jobMatch);

router.get('/analyses', c.listAnalyses);
router.get('/analyses/:id', c.getAnalysis);
router.delete('/', c.remove);

module.exports = router;
