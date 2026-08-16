const multer = require('multer');

// Content Studio accepts every publishable type; per-module middlewares
// (upload.js, docUpload.js) stay untouched for backwards compatibility.
const MIME_TO_TYPE = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'text/csv': 'excel',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/plain': 'text',
};

function detectType(file) {
  if (MIME_TO_TYPE[file.mimetype]) {
    // .md often arrives as text/plain — trust the extension.
    if (file.mimetype === 'text/plain' && /\.(md|markdown)$/i.test(file.originalname)) {
      return 'markdown';
    }
    return MIME_TO_TYPE[file.mimetype];
  }
  if (file.mimetype.startsWith('image/')) return 'image';
  if (file.mimetype.startsWith('video/')) return 'video';
  if (file.mimetype.startsWith('audio/')) return 'audio';
  return null;
}

const { LIMITS } = require('./uploadGuards');

// memoryStorage means every byte is heap, and the base64 data-URI built
// downstream costs ~1.37x more on top. 100 MB x 10 files was ~1 GB of demand
// per request — an OOM kill on any realistically-sized instance, taking every
// concurrent request down with it. See uploadGuards.js for the arithmetic;
// tune via UPLOAD_MAX_STUDIO_FILE_MB / UPLOAD_MAX_STUDIO_FILES.
const studioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.studioFile, files: LIMITS.studioFiles },
  fileFilter: (req, file, cb) => {
    if (detectType(file)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

studioUpload.detectType = detectType;
module.exports = studioUpload;
