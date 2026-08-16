const multer = require('multer');
const { LIMITS } = require('./uploadGuards');

// Avatars and album photos. Left at 10 MB — phone camera output routinely runs
// to 8 MB and Cloudinary re-encodes on arrival, so tightening this would reject
// ordinary uploads for no memory benefit worth having. Override with
// UPLOAD_MAX_IMAGE_MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.image },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

module.exports = upload;
