const Post = require('../../models/Post');
const Event = require('../../models/Event');
const User = require('../../models/User');

module.exports = {
  id: 'community',
  label: 'Community',
  priority: 70,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const [posts, events, members] = await Promise.all([
      Post.find({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { body: { $regex: escaped, $options: 'i' } },
          { tags: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('title body tags createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Event.find({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
          { location: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('title description date location type')
        .sort({ date: 1 })
        .limit(10)
        .lean(),
      User.find({
        $and: [
          { _id: { $ne: userId } },
          {
            $or: [
              { name: { $regex: escaped, $options: 'i' } },
              { email: { $regex: escaped, $options: 'i' } },
              { batch: { $regex: escaped, $options: 'i' } },
              { program: { $regex: escaped, $options: 'i' } },
            ],
          },
        ],
      })
        .select('name email batch program college')
        .limit(5)
        .lean(),
    ]);

    const results = [];

    for (const p of posts) {
      results.push({
        id: `post-${p._id}`,
        title: p.title || 'Untitled post',
        subtitle: `Posted ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}`,
        description: (p.body || '').slice(0, 150),
        url: '/community/feed',
        icon: 'MessageCircle',
        tags: [...(p.tags || []), 'post'],
        matchType: 'title',
      });
    }

    for (const e of events) {
      results.push({
        id: `event-${e._id}`,
        title: e.title,
        subtitle: `${e.type || 'Event'} · ${e.date ? new Date(e.date).toLocaleDateString() : 'TBA'}${e.location ? ` · ${e.location}` : ''}`,
        url: '/community/events',
        icon: 'Calendar',
        tags: [e.type, e.location, 'event'].filter(Boolean),
        matchType: (e.title || '').toLowerCase().includes(q) ? 'title' : 'content',
      });
    }

    for (const m of members) {
      results.push({
        id: `member-${m._id}`,
        title: m.name || 'Unknown',
        subtitle: `${m.program || ''}${m.batch ? ` · Batch ${m.batch}` : ''}${m.college ? ` · ${m.college}` : ''}`,
        url: '/community/directory',
        icon: 'User',
        tags: [m.batch, m.program, m.college, 'member'].filter(Boolean),
        matchType: (m.name || '').toLowerCase().includes(q) ? 'title' : 'tag',
      });
    }

    return results.slice(0, 8);
  },
};
