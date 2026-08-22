const { APP_SECTIONS, APP_PAGES } = require('../../ai/appKnowledge');

function flatten() {
  const entries = [];

  for (const section of APP_SECTIONS) {
    entries.push({
      title: section.label,
      subtitle: 'How this section works',
      description: section.blurb,
      url: section.route,
      keywords: section.subs.map((s) => s.label).join(' '),
    });
    for (const sub of section.subs) {
      entries.push({
        title: sub.label,
        subtitle: `Inside ${section.label}`,
        description: section.blurb,
        url: sub.route,
        keywords: section.label,
      });
    }
  }

  for (const page of APP_PAGES) {
    entries.push({
      title: page.label,
      subtitle: 'About this page',
      description: page.blurb,
      url: page.route,
      keywords: '',
    });
  }

  return entries;
}

const KNOWLEDGE_ENTRIES = flatten();

module.exports = {
  id: 'knowledge',
  label: 'Help',
  priority: 60,

  async search(query) {
    const q = query.toLowerCase();

    return KNOWLEDGE_ENTRIES
      .map((entry) => {
        const title = entry.title.toLowerCase();
        const description = entry.description.toLowerCase();
        const keywords = entry.keywords.toLowerCase();

        let matchType = null;
        if (title === q) matchType = 'exact';
        else if (title.startsWith(q)) matchType = 'prefix';
        else if (title.includes(q)) matchType = 'title';
        else if (keywords.includes(q)) matchType = 'tag';
        else if (description.includes(q)) matchType = 'content';

        return {
          id: `knowledge-${entry.url}-${entry.title}`,
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          content: entry.description,
          url: entry.url,
          icon: 'HelpCircle',
          tags: entry.keywords ? entry.keywords.split(' ').filter(Boolean) : [],
          matchType,
        };
      })
      .filter((r) => r.matchType !== null)
      .slice(0, 8);
  },
};
