const JournalEntry = require('../../models/JournalEntry');

module.exports = {
  id: 'wellbeing',
  label: 'Wellbeing',
  priority: 65,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const entries = await JournalEntry.find({
      user: userId,
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { mood: { $regex: escaped, $options: 'i' } },
      ],
    })
      .select('title content mood createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const results = [];

    for (const e of entries) {
      const title = (e.title || '').toLowerCase();
      const content = (e.content || '').toLowerCase();
      const mood = (e.mood || '').toLowerCase();

      let matchType = null;
      if (title === q) matchType = 'exact';
      else if (title.startsWith(q)) matchType = 'prefix';
      else if (title.includes(q)) matchType = 'title';
      else if (mood.includes(q)) matchType = 'mood';
      else if (content.includes(q)) matchType = 'content';

      if (matchType) {
        results.push({
          id: `journal-${e._id}`,
          title: e.title || 'Journal entry',
          subtitle: `${e.mood ? `Mood: ${e.mood}` : ''} · ${e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ''}`,
          description: (e.content || '').slice(0, 150),
          url: '/me/journal',
          icon: 'BookOpen',
          tags: [e.mood, 'journal'].filter(Boolean),
          matchType,
        });
      }
    }

    return results.slice(0, 6);
  },
};
