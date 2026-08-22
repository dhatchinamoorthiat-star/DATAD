const Internship = require('../models/Internship');
const { classifyDomain } = require('../utils/domainClassifier');
const { getIdentity } = require('../services/studentIdentityService');
const { searchRegex } = require('../utils/safeRegex');

function domainTagsFor(title, tags) {
  // Reuses the same classifier as student profiles: title + tags stand in
  // for course/specialization/careerInterests so both sides speak the same
  // domain vocabulary without needing a separate taxonomy.
  return classifyDomain({ specialization: title, careerInterests: tags }).tags;
}

exports.list = async (req, res, next) => {
  try {
    const filter = { active: true };
    if (req.query.remote === 'true') filter.remote = true;
    if (req.query.tag) filter.tags = req.query.tag;
    const re = searchRegex(req.query.search);
    if (re) {
      filter.$or = [{ title: re }, { company: re }, { tags: re }];
    }
    const internships = await Internship.find(filter)
      .populate('postedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (req.user.role !== 'admin') {
      const identity = await getIdentity(req.user.userId).catch(() => null);
      const myTags = new Set(identity?.domainTags || []);
      if (myTags.size > 0) {
        // Stable sort: overlapping-domain listings float to the top, but
        // relative recency order (the original sort) is preserved within
        // each group — this re-ranks, it never hides anything.
        internships.forEach((item, i) => { item.__order = i; });
        internships.sort((a, b) => {
          const aMatch = (a.domainTags || []).some((t) => myTags.has(t)) ? 0 : 1;
          const bMatch = (b.domainTags || []).some((t) => myTags.has(t)) ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return a.__order - b.__order;
        });
        internships.forEach((item) => { delete item.__order; });
      }
    }

    res.json(internships);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, company, location, remote, stipend, duration, applyLink, deadline, eligibility, tags } = req.body;
    if (!title || !company || !applyLink) return res.status(400).json({ message: 'Title, company and apply link are required' });
    const internship = await Internship.create({
      title, company, location, remote, stipend, duration, applyLink, deadline, eligibility,
      tags: tags || [],
      domainTags: domainTagsFor(title, tags || []),
      postedBy: req.user.userId,
    });
    res.status(201).json(internship);
  } catch (err) { next(err); }
};

const INTERNSHIP_UPDATABLE_FIELDS = ['title', 'company', 'location', 'remote', 'stipend', 'duration', 'applyLink', 'deadline', 'eligibility', 'tags'];

exports.update = async (req, res, next) => {
  try {
    const item = await Internship.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.postedBy.equals(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }
    INTERNSHIP_UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    if (req.body.title !== undefined || req.body.tags !== undefined) {
      item.domainTags = domainTagsFor(item.title, item.tags);
    }
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await Internship.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.postedBy.equals(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
