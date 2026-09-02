const Parser = require('rss-parser');
const NewsItem = require('../models/NewsItem');
const FEEDS = require('../config/newsFeeds');

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DATAD/1.0)' },
});

const MAX_PER_FEED = 25;
const PRUNE_AFTER_DAYS = 21;

const clean = (s) =>
  (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

async function fetchFeed({ url, source, category }) {
  const feed = await parser.parseURL(url);
  const items = (feed.items || []).slice(0, MAX_PER_FEED);
  let upserted = 0;
  for (const it of items) {
    if (!it.link || !it.title) continue;
    const summary = clean(it.contentSnippet || it.content || '').slice(0, 500);
    await NewsItem.updateOne(
      { link: it.link },
      {
        $set: {
          title: clean(it.title).slice(0, 400),
          summary,
          source,
          category,
          publishedAt: it.isoDate ? new Date(it.isoDate) : new Date(),
        },
      },
      { upsert: true }
    );
    upserted += 1;
  }
  return upserted;
}

// Pull every configured feed. Feeds are independent — one failure never blocks others.
async function refreshNews() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    failed.forEach((f) => console.error('News feed failed:', f.reason?.message));
  }
  // Prune stale items to keep the collection bounded.
  const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 86400000);
  await NewsItem.deleteMany({ publishedAt: { $lt: cutoff } });
  const total = await NewsItem.estimatedDocumentCount();
  console.log(`News refresh: ${ok.length}/${FEEDS.length} feeds ok, ${total} items cached`);

  // Fire-and-forget AI enhancement of the newest un-enhanced articles.
  // No-op until an AI provider is configured. Lazy require avoids cycles.
  const { enhancePending } = require('./newsEnhancer');
  enhancePending().catch((err) => console.error('News enhancement failed:', err.message));

  return { feedsOk: ok.length, total };
}

// Kick off an initial fetch, then refresh on an interval.
function startNewsRefresh(intervalMinutes = 30) {
  refreshNews().catch((err) => console.error('Initial news refresh failed:', err.message));
  setInterval(() => {
    refreshNews().catch((err) => console.error('Scheduled news refresh failed:', err.message));
  }, intervalMinutes * 60 * 1000);
}

module.exports = { refreshNews, startNewsRefresh };
