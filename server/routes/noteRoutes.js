const router = require('express').Router();
const {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  uploadAttachment,
} = require('../controllers/noteController');
const verifyToken = require('../middleware/verifyToken');
const docUpload = require('../middleware/docUpload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');

router.use(verifyToken);
router.get('/', listNotes);
router.post('/', createNote);
router.post('/upload-attachment', checkRequestSize(LIMITS.doc), docUpload.single('file'), verifyFileSignatures, uploadAttachment);
router.get('/:id', getNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
