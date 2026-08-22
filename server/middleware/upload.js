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
    // SVG is markup, not a raster image: it can carry <script> and event
    // handlers, and a CDN serving it as image/svg+xml will execute them when the
    // file is opened directly. `image/*` let it straight through, and the
    // signature check downstream has no magic number to catch it by. Nothing in
    // the app — avatars, album photos, resume headshots — needs vector input.
    if (file.mimetype === 'image/svg+xml' || file.mimetype === 'image/svg') {
      return cb(new Error('SVG images are not accepted'));
    }
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

module.exports = upload;
