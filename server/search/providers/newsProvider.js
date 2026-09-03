const NewsItem = require('../../models/NewsItem');
const Company = require('../../models/Company');

module.exports = {
  id: 'news',
  label: 'Intelligence',
  priority: 60,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const [articles, companies] = await Promise.all([
      NewsItem.find({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { content: { $regex: escaped, $options: 'i' } },
          { summary: { $regex: escaped, $options: 'i' } },
          { source: { $regex: escaped, $options: 'i' } },
          { topics: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('title content summary source url topics publishedAt')
        .sort({ publishedAt: -1 })
        .limit(10)
        .lean(),
      Company.find({
        name: { $regex: escaped, $options: 'i' },
      })
        .select('name industry slug')
        .limit(5)
        .lean(),
    ]);

    const results = [];

    for (const a of articles) {
      results.push({
        id: `news-${a._id}`,
        title: (a.title || '').slice(0, 120),
        subtitle: `${a.source || 'News'} · ${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : ''}`,
        description: (a.summary || a.content || '').slice(0, 200),
        url: '/briefing',
        icon: 'Newspaper',
        tags: [...(a.topics || []), a.source, 'news'].filter(Boolean),
        matchType: (a.title || '').toLowerCase().includes(q) ? 'title' : 'content',
      });
    }

    for (const c of companies) {
      results.push({
        id: `news-co-${c._id}`,
        title: c.name,
        subtitle: `${c.industry || 'Company'} · News available`,
        url: `/placement/companies/${c.slug}`,
        icon: 'Building2',
        tags: [c.industry, 'company', 'news'].filter(Boolean),
        matchType: 'tag',
      });
    }

    return results.slice(0, 8);
  },
};
