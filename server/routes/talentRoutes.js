/**
 * Talent Exchange pillar router.
 *
 * Aggregates the five sub-resources under one mount (/api/talent). verifyToken
 * is applied once here so every talent route is authenticated — no talent
 * endpoint is ever public.
 */
const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');

router.use(verifyToken);

router.use('/opportunities', require('./talent/opportunityRoutes'));
router.use('/applications', require('./talent/applicationRoutes'));
router.use('/engagements', require('./talent/engagementRoutes'));
router.use('/conversations', require('./talent/conversationRoutes'));
router.use('/reviews', require('./talent/reviewRoutes'));

module.exports = router;
