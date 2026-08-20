const Event = require('../../models/Event');
const EventRSVP = require('../../models/EventRSVP');
const { notify } = require('../../controllers/notificationController');

async function sendRsvpReminders() {
  // Calendar-day "tomorrow" window, not a rolling 24h one — a rolling window
  // catches events happening later *today* (e.g. 10am when this cron runs at
  // 8am) and mislabels them "tomorrow".
  const tomorrowStart = new Date();
  tomorrowStart.setHours(0, 0, 0, 0);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterStart = new Date(tomorrowStart);
  dayAfterStart.setDate(dayAfterStart.getDate() + 1);

  const events = await Event.find({ date: { $gte: tomorrowStart, $lt: dayAfterStart } }).select('_id title date').lean();
  if (!events.length) return;

  for (const event of events) {
    const rsvps = await EventRSVP.find({ event: event._id, status: 'going' }).select('user').lean();
    const timeFmt = new Date(event.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    for (const rsvp of rsvps) {
      // dedupUnread: a re-run within the same day (or a restarted scheduler)
      // bumps the existing unread reminder instead of stacking a duplicate.
      await notify({ user: rsvp.user, type: 'rsvp', title: `Reminder: ${event.title} is tomorrow`, body: `Starting at ${timeFmt}`, link: '/community/events', dedupUnread: true }).catch(() => {});
    }
  }
  console.log(`[rsvp-reminder] Sent reminders for ${events.length} upcoming event(s)`);
}

module.exports = { sendRsvpReminders };
