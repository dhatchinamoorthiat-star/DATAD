const Company = require('../models/Company');
const CompanyRead = require('../models/CompanyRead');
const User = require('../models/User');
const { canAccessFeature } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const { mergeWithProgramsFilter, getProgramsFilter } = require('../utils/programFilter');
const cache = require('../utils/cache');

const LIST_CACHE_TTL = 5 * 60 * 1000;
const NEWS_CACHE_TTL = 10 * 60 * 1000;

const PREMIUM_FIELDS = ['interviewQuestions', 'prepTips', 'rounds', 'salaryRange'];

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ---- Read (any authenticated member) ----

exports.listCompanies = async (req, res, next) => {
  try {
    const base = {};
    if (req.query.sector) base.sector = req.query.sector;
    if (req.query.q) base.name = { $regex: req.query.q.trim(), $options: 'i' };
    // Recruiters the program sync tagged for this student, plus untagged
    // companies that are relevant to everyone.
    const filter = mergeWithProgramsFilter(req.user, base);

    // Companies are the same for all users — cache heavily.
    const cacheKey = `companies:list:${JSON.stringify(filter)}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const companies = await Company.find(filter)
      .select('name slug sector logoUrl salaryRange roles views')
      .sort({ views: -1, name: 1 })
      .limit(100)
      .lean();
    cache.set(cacheKey, companies, LIST_CACHE_TTL);
    res.json(companies);
  } catch (err) {
    next(err);
  }
};

exports.getCompanyBySlug = async (req, res, next) => {
  try {
    const [company, dbUser] = await Promise.all([
      // Scoped by program too: filtering only the list would leave the detail
      // page reachable by guessing a slug.
      Company.findOneAndUpdate(
        mergeWithProgramsFilter(req.user, { slug: req.params.slug }),
        { $inc: { views: 1 } },
        { returnDocument: 'after' }
      ).lean(),
      User.findById(req.user.userId).select('tier tierExpiresAt').lean(),
    ]);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    CompanyRead.updateOne(
      { user: req.user.userId, company: company._id },
      { $setOnInsert: { user: req.user.userId, company: company._id } },
      { upsert: true }
    ).catch(() => {});

    if (!canAccessFeature(dbUser, FEATURE.INTERVIEW_QUESTIONS)) {
      const stripped = { ...company };
      PREMIUM_FIELDS.forEach((f) => delete stripped[f]);
      return res.json({ ...stripped, _prepLocked: true });
    }

    res.json(company);
  } catch (err) {
    next(err);
  }
};

// Aggregated interview question bank across all companies — grouped by category.
exports.listQuestions = async (req, res, next) => {
  try {
    const companies = await Company.find({ 'interviewQuestions.0': { $exists: true } })
      .select('name slug interviewQuestions')
      .lean();

    const bank = {};
    companies.forEach((c) => {
      c.interviewQuestions.forEach((q) => {
        const cat = q.category || 'hr';
        if (!bank[cat]) bank[cat] = [];
        bank[cat].push({ question: q.question, company: c.name, companySlug: c.slug });
      });
    });
    res.json(bank);
  } catch (err) {
    next(err);
  }
};

// ---- Admin CRUD ----

exports.createCompany = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.userId };
    if (!data.slug && data.name) data.slug = slugify(data.name);
    const existing = await Company.findOne({ slug: data.slug });
    if (existing) return res.status(409).json({ message: 'A company with this name already exists' });
    const company = await Company.create(data);
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json(company);
  } catch (err) {
    next(err);
  }
};

exports.deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ message: 'Company deleted' });
  } catch (err) {
    next(err);
  }
};
