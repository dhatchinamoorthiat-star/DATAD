const multer = require('multer');
const { MB } = require('./uploadGuards');

/**
 * Upload middleware for the LinkedIn PDF export.
 *
 * Deliberately its own instance rather than a reuse of docUpload: that one
 * accepts Word, Excel, PowerPoint, ZIP and video at 25 MB because Content
 * Studio needs all of them. This route accepts exactly one thing, and there is
 * no reason to let a 25 MB video reach a PDF parser.
 *
 * 10 MB is generous — a LinkedIn export runs to a few hundred kilobytes. The
 * limit exists because memoryStorage puts every byte on the heap.
 *
 * The MIME check here is the browser's word for it (taken from the file
 * extension), so it is only the first gate. uploadGuards.verifyFileSignatures
 * checks the leading bytes afterwards, and utils/linkedin/pdf.js checks them
 * again before parsing.
 */
const linkedinPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    // `statusCode` is what errorHandler.js reads; a bare Error from a
    // fileFilter falls through to its 500 branch, so the student would be told
    // "something went wrong" when the real problem is that they picked a .docx.
    const err = new Error('That file is not a PDF. Use LinkedIn\'s "Save to PDF" export.');
    err.statusCode = 400;
    cb(err);
  },
});

module.exports = linkedinPdfUpload;
