// Curated live RSS feeds mapped to our news categories.
// Economic Times section feeds are reliable and refresh continuously.
// Every URL below was hand-verified to both return a real RSS/Atom document
// AND parse cleanly through rss-parser before being added — several
// otherwise-plausible feeds (Psychology Today, LiveLaw, fibre2fashion,
// DVM360, AVMA, Autocar India) 404/500/block bots or ship malformed XML and
// were left out for that reason.
module.exports = [
  { url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', source: 'Economic Times', category: 'stock-market' },
  { url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms', source: 'Economic Times', category: 'economy' },
  { url: 'https://economictimes.indiatimes.com/industry/banking/finance/rssfeeds/13358319.cms', source: 'Economic Times', category: 'banking-finance' },
  { url: 'https://economictimes.indiatimes.com/tech/startups/rssfeeds/62514535.cms', source: 'Economic Times', category: 'startups' },
  { url: 'https://techcrunch.com/category/startups/feed/', source: 'TechCrunch', category: 'startups' },
  { url: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms', source: 'Economic Times', category: 'ai-tech' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch', category: 'ai-tech' },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', source: 'MIT Technology Review', category: 'ai-tech' },
  { url: 'https://economictimes.indiatimes.com/news/international/business/rssfeeds/62288148.cms', source: 'Economic Times', category: 'global-business' },
  { url: 'https://economictimes.indiatimes.com/industry/transportation/rssfeeds/13359360.cms', source: 'Economic Times', category: 'operations' },
  { url: 'https://economictimes.indiatimes.com/industry/cons-products/rssfeeds/13358350.cms', source: 'Economic Times', category: 'marketing' },
  { url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms', source: 'Economic Times', category: 'corporate' },
  { url: 'https://economictimes.indiatimes.com/jobs/rssfeeds/107115.cms', source: 'Economic Times', category: 'placements' },

  // Discipline-specific feeds — for programs whose newsCategories (see
  // config/programs.json) aren't well served by the business-press feeds above.
  { url: 'https://www.sciencedaily.com/rss/mind_brain/psychology.xml', source: 'ScienceDaily', category: 'psychology' },

  { url: 'https://www.barandbench.com/stories.rss', source: 'Bar & Bench', category: 'law' },
  { url: 'https://blog.ipleaders.in/feed/', source: 'iPleaders', category: 'law' },

  { url: 'https://wwd.com/feed/', source: "Women's Wear Daily", category: 'fashion-design' },
  { url: 'https://www.businessoffashion.com/feed/', source: 'Business of Fashion', category: 'fashion-design' },

  { url: 'https://www.sciencedaily.com/rss/plants_animals/veterinary_medicine.xml', source: 'ScienceDaily', category: 'veterinary' },
  { url: 'https://www.veterinarypracticenews.com/feed/', source: 'Veterinary Practice News', category: 'veterinary' },

  { url: 'https://www.manufacturingtomorrow.com/rss/news', source: 'ManufacturingTomorrow', category: 'mechanical-engineering' },
  { url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', source: 'IEEE Spectrum', category: 'mechanical-engineering' },

  { url: 'https://www.kdnuggets.com/feed', source: 'KDnuggets', category: 'data-science' },
];
