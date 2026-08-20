const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const CalendarEvent = require('../models/CalendarEvent');

router.use(verifyToken);

// GET /api/calendar/holidays?year=2026&country=IN — fetch public holidays
router.get('/holidays', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const country = req.query.country || 'IN';
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
    if (!response.ok) return res.json({ holidays: [] });
    const data = await response.json();
    const holidays = data.map((h) => ({
      date: h.date,
      name: h.localName,
      global: h.global,
    }));
    res.json({ holidays });
  } catch {
    res.json({ holidays: [] });
  }
});

// GET /api/calendar/events?year=2026&month=1 — user's events for a month
router.get('/events', async (req, res) => {
  try {
    // `year`/`month` land inside a regex, so they have to be proven numeric
    // first — otherwise a missing param builds `^undefined-undefined` (always
    // empty) and an arbitrary string is a regex-injection route.
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isInteger(year) || year < 1970 || year > 9999 ||
        !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Valid year and month are required' });
    }
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const events = await CalendarEvent.find({
      user: req.user.userId,
      date: { $regex: `^${prefix}` },
    }).sort({ date: 1 }).lean();
    res.json({ events });
  } catch {
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

// POST /api/calendar/events — create an event
router.post('/events', async (req, res) => {
  try {
    const { title, date, time, type, description } = req.body;
    if (!title || !date) return res.status(400).json({ message: 'Title and date are required' });
    const event = await CalendarEvent.create({
      user: req.user.userId,
      title,
      date,
      time: time || '',
      type: type || 'event',
      description: description || '',
    });
    res.status(201).json({ event });
  } catch {
    res.status(500).json({ message: 'Failed to create event' });
  }
});

// PUT /api/calendar/events/:id — update an event
router.put('/events/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ event });
  } catch {
    res.status(500).json({ message: 'Failed to update event' });
  }
});

// DELETE /api/calendar/events/:id
router.delete('/events/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch {
    res.status(500).json({ message: 'Failed to delete event' });
  }
});

module.exports = router;
