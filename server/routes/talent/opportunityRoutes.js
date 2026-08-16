const router = require('express').Router();
const c = require('../../controllers/talent/opportunityController');

// '/search' is declared before '/:id' so it is not swallowed as an id.
router.get('/search', c.search);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.archive);
router.post('/:id/publish', c.publish);
router.post('/:id/close', c.close);
router.post('/:id/report', c.report);
router.get('/:id/applications', c.listApplications);
router.post('/:id/apply', c.apply);

module.exports = router;
