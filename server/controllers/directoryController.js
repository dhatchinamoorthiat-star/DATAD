const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const { updateIdentity } = require('../services/studentIdentityService');
const { searchRegex } = require('../utils/safeRegex');

/**
 * Largest directory page we will assemble for one request.
 *
 * The query used to be unbounded: every profile in the database, hydrated and
 * serialised, on an endpoint any authenticated member can call as often as the
 * rate limiter allows. That is both the cheapest way to knock the server over
 * and the cheapest way to scrape the whole member list. A cap is the fix;
 * `?limit=` can ask for less but never for more.
 */
const DIRECTORY_MAX_LIMIT = 200;

exports.getDirectory = async (req, res, next) => {
  try {
    const filter = {};
    const specializationRe = searchRegex(req.query.specialization);
    if (specializationRe) filter.specialization = specializationRe;
    const skillRe = searchRegex(req.query.skill);
    if (skillRe) filter.skills = skillRe;

    // Name search resolves to user ids first so it becomes part of the database
    // query. It used to run in JavaScript on the full result set, which meant
    // every profile had to be fetched before any could be discarded — so the
    // narrower the search, the more work it wasted.
    const nameRe = searchRegex(req.query.search);
    if (nameRe) {
      const matches = await User.find({ name: nameRe })
        .select('_id')
        .limit(DIRECTORY_MAX_LIMIT)
        .lean();
      if (!matches.length) return res.json([]);
      filter.user = { $in: matches.map((u) => u._id) };
    }

    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requested) && requested > 0
      ? Math.min(requested, DIRECTORY_MAX_LIMIT)
      : DIRECTORY_MAX_LIMIT;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    // Still an array, not a paginated envelope: the client reads r.data as a
    // list, and changing that shape here would break it silently.
    const profiles = await UserProfile.find(filter)
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json(profiles);
  } catch (err) { next(err); }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    let profile = await UserProfile.findOne({ user: req.user.userId }).populate('user', 'name avatar email');
    if (!profile) {
      profile = await UserProfile.create({ user: req.user.userId });
      await profile.populate('user', 'name avatar email');
    }
    res.json(profile);
  } catch (err) { next(err); }
};

exports.upsertMyProfile = async (req, res, next) => {
  try {
    const allowed = ['skills', 'interests', 'clubs', 'languages', 'linkedin', 'github', 'portfolio', 'batch', 'specialization', 'bio', 'lookingFor', 'priorDomain'];
    const update = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user.userId },
      { $set: update },
      { upsert: true, new: true }
    ).populate('user', 'name avatar email');

    // Sync to canonical StudentIdentity
    await updateIdentity(req.user.userId, update);

    res.json(profile);
  } catch (err) { next(err); }
};
