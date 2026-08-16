const multer = require('multer');

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/gif',
];

const MIME_TO_TYPE = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'video/mp4': 'video',
  'video/webm': 'video',
};

const { LIMITS } = require('./uploadGuards');

// Buffered in memory (see uploadGuards.js): 50 MB peaked around 120 MB of heap
// per concurrent upload once the base64 data-URI was built alongside it.
// Override with UPLOAD_MAX_DOC_MB.
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.doc },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type'));
  },
});

docUpload.mimeToType = MIME_TO_TYPE;
module.exports = docUpload;
