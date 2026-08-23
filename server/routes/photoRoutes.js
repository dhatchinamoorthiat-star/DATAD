const router = require('express').Router();
const { uploadPhoto, deletePhoto, listRecentPhotos, listAlbumPhotos } = require('../controllers/photoController');
const verifyToken = require('../middleware/verifyToken');
const upload = require('../middleware/upload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');
const { heavyLimiter } = require('../middleware/rateLimiters');

router.use(verifyToken);
router.get('/recent', listRecentPhotos);
router.get('/album/:albumId', listAlbumPhotos);
router.post('/', heavyLimiter, checkRequestSize(LIMITS.image), upload.single('image'), verifyFileSignatures, uploadPhoto);
router.delete('/:id', deletePhoto);

module.exports = router;
