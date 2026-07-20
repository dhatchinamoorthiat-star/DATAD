const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const { updateIdentity } = require('../services/studentIdentityService');

exports.getDirectory = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.specialization) filter.specialization = new RegExp(req.query.specialization, 'i');
    if (req.query.skill) filter.skills = new RegExp(req.query.skill, 'i');

    let profiles = await UserProfile.find(filter)
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      profiles = profiles.filter((p) => p.user?.name?.toLowerCase().includes(q));
    }

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
