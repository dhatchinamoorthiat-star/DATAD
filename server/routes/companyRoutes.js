const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const { requireFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const {
  listCompanies,
  getCompanyBySlug,
  listQuestions,
  createCompany,
  updateCompany,
  deleteCompany,
} = require('../controllers/companyController');
const { getCompanyNews } = require('../controllers/companyNewsController');

router.use(verifyToken);
router.use(refreshTier);

// Browsing is free; DEPTH is what is sold. Listing and the basic profile were
// gated at COMPANY_PREMIUM, which is a Placement-tier feature — so every free,
// trial and Pro student got a hard 403 on the whole Career hub, and
// getCompanyBySlug's premium-field stripping (the `_prepLocked` path) could
// never run: the only users who reached the controller were Pass holders, for
// whom nothing is stripped. The gate now sits on the fields, not the page.
router.get('/', requireFeature(FEATURE.CAREER_BASIC), listCompanies);
router.get('/questions/bank', requireFeature(FEATURE.INTERVIEW_QUESTIONS), listQuestions);
router.get('/news/feed', requireFeature(FEATURE.COMPANY_RESEARCH), getCompanyNews);
router.get('/:slug', requireFeature(FEATURE.CAREER_BASIC), getCompanyBySlug);

router.post('/', checkRole('admin'), createCompany);
router.put('/:id', checkRole('admin'), updateCompany);
router.delete('/:id', checkRole('admin'), deleteCompany);

module.exports = router;
