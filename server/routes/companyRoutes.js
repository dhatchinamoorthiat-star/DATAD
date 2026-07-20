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

router.get('/', requireFeature(FEATURE.COMPANY_PREMIUM), listCompanies);
router.get('/questions/bank', requireFeature(FEATURE.INTERVIEW_QUESTIONS), listQuestions);
router.get('/news/feed', requireFeature(FEATURE.COMPANY_PREMIUM), getCompanyNews);
router.get('/:slug', requireFeature(FEATURE.COMPANY_PREMIUM), getCompanyBySlug);

router.post('/', checkRole('admin'), createCompany);
router.put('/:id', checkRole('admin'), updateCompany);
router.delete('/:id', checkRole('admin'), deleteCompany);

module.exports = router;
