const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const { requireFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const {
  listArticles,
  listBookmarked,
  toggleBookmark,
  refresh,
  setInterests,
  getMarket,
} = require('../controllers/intelligenceController');

router.use(verifyToken);

// Read / personalization (all users). The article feed stays open on purpose —
// it is content, and content only compounds if everyone reads it.
router.get('/', listArticles);

// The market snapshot is the "Market Intelligence" the pricing page has been
// advertising as a Placement Pass feature while every free account could read
// it. The gate makes the product match the promise.
router.get('/market', refreshTier, requireFeature(FEATURE.MARKET_INTELLIGENCE), getMarket);

router.get('/bookmarks', listBookmarked);
router.post('/:id/bookmark', toggleBookmark);
router.put('/interests', setInterests);

// Admin
router.post('/refresh', checkRole('admin'), refresh);

module.exports = router;
