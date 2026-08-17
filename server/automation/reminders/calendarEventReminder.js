const CalendarEvent = require('../../models/CalendarEvent');
const User = require('../../models/User');
const { send, wrap, esc } = require('../../config/mailer');
const { primaryClientUrl } = require('../../utils/clientUrl');
const { notify } = require('../../controllers/notificationController');

async function sendCalendarEventReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const prefix = tomorrow.toISOString().slice(0, 10);

  const events = await CalendarEvent.find({ date: prefix }).lean();
  if (!events.length) return;

  const userIds = [...new Set(events.map((e) => e.user.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = {};
  for (const u of users) userMap[u._id.toString()] = u;

  for (const event of events) {
    const user = userMap[event.user.toString()];
    if (!user) continue;

    const typeLabel = event.type.charAt(0).toUpperCase() + event.type.slice(1);
    const timeStr = event.time ? ` at ${event.time}` : '';

    await notify({
      user: event.user,
      type: 'general',
      title: `⏰ Tomorrow: ${event.title}`,
      body: `${typeLabel}${timeStr}`,
      link: '/me/calendar',
    }).catch(() => {});

    if (user.email) {
      try {
        await send({
          to: [{ name: user.name, email: user.email }],
          subject: `⏰ Reminder: ${event.title} is tomorrow`,
          // Shares the branded header from config/mailer rather than defining
          // its own, so the mark and lockup stay identical across every mail.
          html: wrap(
            'Upcoming event reminder',
            `<p>Hi ${esc(user.name)},</p>
             <p>Just a heads-up — you have something coming up tomorrow.</p>
             <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0">
               <p style="margin:0 0 4px;font-weight:600;font-size:16px;color:#1f2937">${esc(event.title)}</p>
               <p style="margin:0;color:#6b7280;font-size:14px">${esc(typeLabel)} — ${esc(event.date)}${esc(timeStr)}</p>
               ${event.description ? `<p style="margin:8px 0 0;color:#6b7280;font-size:13px">${esc(event.description)}</p>` : ''}
             </div>
             <p><a href="${primaryClientUrl()}/me/calendar"
               style="display:inline-block;background:#4D7CFF;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-size:14px">
               View in calendar
             </a></p>`
          ),
        });
      } catch {
        // email failed silently
      }
    }
  }
  console.log(`[calendar-reminder] Sent reminders for ${events.length} event(s) tomorrow`);
}

module.exports = { sendCalendarEventReminders };
