const MarketListing = require('../models/MarketListing');
const { searchRegex } = require('../utils/safeRegex');

exports.list = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.showSold !== 'true') filter.sold = false;
    if (req.query.category) filter.category = req.query.category;

    // ⭐ Filter by program
    const programId = req.user?.program?.id;
    if (programId) {
      filter.program = programId;
    }

    const re = searchRegex(req.query.search);
    if (re) {
      filter.$or = [{ title: re }, { description: re }, { tags: re }];
    }
    const listings = await MarketListing.find(filter)
      .populate('seller', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, description, price, category, condition, images, contact, tags } = req.body;
    if (!title || price === undefined) return res.status(400).json({ message: 'Title and price are required' });
    const listing = await MarketListing.create({
      title, description, price, category, condition,
      images: images || [], contact, tags: tags || [],
      seller: req.user.userId,
      // ⭐ Automatically scope listing to user's program
      program: req.user?.program?.id || null,
    });
    res.status(201).json(listing);
  } catch (err) { next(err); }
};

const UPDATABLE_FIELDS = ['title', 'description', 'price', 'category', 'condition', 'images', 'contact', 'tags'];

exports.update = async (req, res, next) => {
  try {
    const item = await MarketListing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.seller.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await MarketListing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.seller.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.markSold = async (req, res, next) => {
  try {
    const item = await MarketListing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (!item.seller.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    item.sold = true;
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
};
