const Task = require('../../models/Task');
const { notify } = require('../../controllers/notificationController');

async function sendOverdueReminders() {
  const now = new Date();
  const tasks = await Task.find({
    dueDate: { $lt: now },
    status: { $nin: ['done', 'completed'] },
  }).lean();

  if (!tasks.length) return;

  const notified = new Set();
  for (const task of tasks) {
    const dueFmt = new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const recipients = [];
    if (task.assignee) recipients.push(String(task.assignee));
    if (task.createdBy && !recipients.includes(String(task.createdBy))) recipients.push(String(task.createdBy));
    for (const uid of recipients) {
      const key = `${uid}:${task._id}`;
      if (notified.has(key)) continue;
      notified.add(key);
      // dedupUnread: bumps the existing unread notification instead of piling
      // up a fresh "Overdue" ping every single day the task stays open.
      await notify({ user: uid, type: 'task', title: `Overdue: ${task.title}`, body: `Was due ${dueFmt}`, link: '/me/planner', dedupUnread: true }).catch(() => {});
    }
  }
  console.log(`[overdue-tasks] Notified for ${tasks.length} overdue task(s)`);
}

module.exports = { sendOverdueReminders };
