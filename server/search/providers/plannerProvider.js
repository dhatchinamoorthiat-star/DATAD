const Task = require('../../models/Task');

module.exports = {
  id: 'planner',
  label: 'Planner',
  priority: 85,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const [tasks, goals] = await Promise.all([
      Task.find({
        $and: [
          { $or: [{ createdBy: userId }, { assignee: userId }] },
          {
            $or: [
              { title: { $regex: escaped, $options: 'i' } },
              { type: { $regex: escaped, $options: 'i' } },
              { subject: { $regex: escaped, $options: 'i' } },
              { status: { $regex: escaped, $options: 'i' } },
            ],
          },
        ],
      })
        .select('title type subject dueDate status priority')
        .sort({ dueDate: 1 })
        .limit(50)
        .lean(),
      // Goals are stored in UserMemory or could be part of a Goals model
      // For now, fetch from UserMemory
    ]);

    const results = [];

    for (const t of tasks) {
      const title = (t.title || '').toLowerCase();
      const type = (t.type || '').toLowerCase();
      const subject = (t.subject || '').toLowerCase();
      const status = (t.status || '').toLowerCase();

      let matchType = null;
      if (title === q) matchType = 'exact';
      else if (title.startsWith(q)) matchType = 'prefix';
      else if (title.includes(q)) matchType = 'title';
      else if (type.includes(q)) matchType = 'type';
      else if (subject.includes(q)) matchType = 'subject';
      else if (status.includes(q)) matchType = 'status';

      if (matchType) {
        const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
        results.push({
          id: `task-${t._id}`,
          title: t.title,
          subtitle: `${t.type || 'Task'}${t.dueDate ? ` · Due ${t.dueDate.toISOString().slice(0, 10)}` : ''}${overdue ? ' · OVERDUE' : ''}`,
          url: '/me/planner',
          icon: 'CheckSquare',
          tags: [t.type, t.subject, t.status].filter(Boolean),
          matchType,
        });
      }
    }

    return results.slice(0, 8);
  },
};
