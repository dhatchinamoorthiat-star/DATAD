const Note = require('../../models/Note');

module.exports = {
  id: 'notes',
  label: 'Notes',
  priority: 90,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const notes = await Note.find({
      author: userId,
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { folder: { $regex: escaped, $options: 'i' } },
        { subject: { $regex: escaped, $options: 'i' } },
      ],
    })
      .select('title content tags subject folder createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return notes
      .map((n) => {
        const title = (n.title || '').toLowerCase();
        const content = (n.content || '').toLowerCase();
        const tags = (n.tags || []).join(' ').toLowerCase();
        const folder = (n.folder || '').toLowerCase();
        const subject = (n.subject || '').toLowerCase();

        let matchType = null;
        if (title === q) matchType = 'exact';
        else if (title.startsWith(q)) matchType = 'prefix';
        else if (title.includes(q)) matchType = 'title';
        else if (tags.includes(q)) matchType = 'tag';
        else if (folder.includes(q)) matchType = 'folder';
        else if (subject.includes(q)) matchType = 'subject';
        else if (content.includes(q)) matchType = 'content';

        return {
          id: `note-${n._id}`,
          title: n.title || 'Untitled',
          subtitle: `${n.subject || 'General'} · ${n.tags?.length || 0} tags · ${n.folder || 'No folder'}`,
          description: (n.content || '').slice(0, 200),
          url: `/study/notes/${n._id}`,
          icon: 'FileText',
          tags: [...(n.tags || []), n.subject, n.folder].filter(Boolean),
          content: n.content || '',
          recentlyViewed: n.updatedAt?.getTime?.() || n.updatedAt,
          matchType,
        };
      })
      .filter((r) => r.matchType !== null)
      .slice(0, 8);
  },
};
