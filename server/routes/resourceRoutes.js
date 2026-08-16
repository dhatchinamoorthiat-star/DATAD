const router = require('express').Router();
const c = require('../controllers/resourceController');
const verifyToken = require('../middleware/verifyToken');
const docUpload = require('../middleware/docUpload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');

router.use(verifyToken);
router.get('/', c.list);
router.post('/', c.create);
router.post('/upload', checkRequestSize(LIMITS.doc), docUpload.single('file'), verifyFileSignatures, c.uploadFile);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.post('/:id/download', c.incrementDownload);

module.exports = router;
