const SkillListing = require('../models/SkillListing');
const SkillRating = require('../models/SkillRating');
const { notify } = require('./notificationController');
const events = require('../events/domainEvents');
const { searchRegex } = require('../utils/safeRegex');

exports.listListings = async (req, res, next) => {
  try {
    const filter = {};
    const re = searchRegex(req.query.search);
    if (re) {
      filter.$or = [{ skill: re }, { tags: re }, { description: re }];
    }
    const listings = await SkillListing.find(filter)
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    const withRatings = await Promise.all(
      listings.map(async (l) => {
        const ratings = await SkillRating.find({ listing: l._id });
        const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null;
        return { ...l.toObject(), avgRating: avg ? Math.round(avg * 10) / 10 : null, ratingCount: ratings.length };
      })
    );
    res.json(withRatings);
  } catch (err) { next(err); }
};

exports.createListing = async (req, res, next) => {
  try {
    const { skill, description, mode, availability, contact, tags } = req.body;
    if (!skill) return res.status(400).json({ message: 'Skill is required' });
    const listing = await SkillListing.create({
      user: req.user.userId, skill, description, mode, availability, contact, tags: tags || [],
    });
    res.status(201).json(listing);
  } catch (err) { next(err); }
};

const LISTING_UPDATABLE_FIELDS = ['skill', 'description', 'mode', 'availability', 'contact', 'tags'];

exports.updateListing = async (req, res, next) => {
  try {
    const item = await SkillListing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.user.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    LISTING_UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
};

exports.deleteListing = async (req, res, next) => {
  try {
    const item = await SkillListing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.user.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.addRating = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating 1-5 required' });
    const r = await SkillRating.findOneAndUpdate(
      { listing: req.params.id, rater: req.user.userId },
      { rating, comment },
      { upsert: true, new: true }
    );
    const listing = await SkillListing.findById(req.params.id).select('user skill').lean();
    if (listing && String(listing.user) !== req.user.userId) {
      notify({ user: listing.user, type: 'reaction', title: `${req.user.name} rated your skill: ${listing.skill}`, body: `${rating}/5${comment ? ` — ${comment.slice(0, 60)}` : ''}`, link: '/community/skills', actor: req.user.userId }).catch(() => {});
      events.social.skillRated(listing.user, { by: req.user.name, skill: listing.skill, rating: data.rating }).catch(() => {});
    }
    res.json(r);
  } catch (err) { next(err); }
};
