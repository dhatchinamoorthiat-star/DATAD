const Event = require('../models/Event');
const EventRSVP = require('../models/EventRSVP');
const User = require('../models/User');
const { notify, notifyBulk } = require('./notificationController');

exports.listEvents = async (req, res, next) => {
  try {
    const filter = {};

    // ⭐ Filter by program
    const programId = req.user?.program?.id;
    if (programId) {
      filter.program = programId;
    }

    if (req.query.category) filter.category = req.query.category;
    if (req.query.upcoming !== 'false') filter.date = { $gte: new Date() };
    const events = await Event.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.json(events);
  } catch (err) { next(err); }
};

exports.createEvent = async (req, res, next) => {
  try {
    const { title, description, date, endDate, location, online, meetLink, organizer, category, image, registrationOpen, maxAttendees } = req.body;
    if (!title || !date) return res.status(400).json({ message: 'Title and date are required' });
    const event = await Event.create({
      title, description, date, endDate, location, online, meetLink, organizer, category,
      image, registrationOpen, maxAttendees,
      createdBy: req.user.userId,
      // ⭐ Automatically scope event to user's program
      program: req.user?.program?.id || null,
    });
    User.find({ role: { $ne: 'admin' } }).select('_id').lean().then((users) => {
      notifyBulk(users.map((u) => u._id), {
        type: 'announcement',
        title: `New event: ${title}`,
        body: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        link: '/community/events',
        actor: req.user.userId,
      });
    }).catch(() => {});
    res.status(201).json(event);
  } catch (err) { next(err); }
};

const EVENT_UPDATABLE_FIELDS = ['title', 'description', 'date', 'endDate', 'location', 'online', 'meetLink', 'organizer', 'category', 'image', 'registrationOpen', 'maxAttendees'];

exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (!event.createdBy.equals(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }
    EVENT_UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) event[f] = req.body[f]; });
    await event.save();
    res.json(event);
  } catch (err) { next(err); }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (!event.createdBy.equals(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }
    await event.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.rsvpEvent = async (req, res, next) => {
  try {
    const { status } = req.body;
    const rsvp = await EventRSVP.findOneAndUpdate(
      { event: req.params.id, user: req.user.userId },
      { status: status || 'going' },
      { upsert: true, new: true }
    );
    if ((status || 'going') === 'going') {
      const event = await Event.findById(req.params.id).select('title createdBy').lean();
      if (event) {
        notify({ user: event.createdBy, type: 'rsvp', actor: req.user.userId,
          title: 'Someone is going to your event',
          body: event.title,
          link: '/community/events',
        }).catch(() => {});
      }
    }
    res.json(rsvp);
  } catch (err) { next(err); }
};

exports.getMyRSVPs = async (req, res, next) => {
  try {
    const rsvps = await EventRSVP.find({ user: req.user.userId, status: { $ne: 'not-going' } })
      .populate({ path: 'event', populate: { path: 'createdBy', select: 'name' } })
      .sort({ createdAt: -1 });
    res.json(rsvps);
  } catch (err) { next(err); }
};

exports.getEventAttendees = async (req, res, next) => {
  try {
    const attendees = await EventRSVP.find({ event: req.params.id })
      .populate('user', 'name avatar')
      .sort({ createdAt: 1 });
    res.json(attendees);
  } catch (err) { next(err); }
};
