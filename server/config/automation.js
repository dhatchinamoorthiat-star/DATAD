/**
 * Single configuration file for all automation.
 * Override any value via environment variables.
 * Never hardcode provider keys or model names elsewhere.
 */

module.exports = {
  // ── AI Providers ────────────────────────────────────────────────────────────
  providers: {
    // Primary provider — NVIDIA NIM
    primary: process.env.AI_PRIMARY_PROVIDER || 'nvidia',
    // Fallback provider — local Ollama (no API key needed)
    fallback: process.env.AI_FALLBACK_PROVIDER || 'ollama',

    groq: {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      maxTokens: 2048,
      temperature: 0.7,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: null, // use default
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: 2048,
      temperature: 0.7,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      // The numbered aliases (gemini-2.0-flash, gemini-2.5-*) report
      // "free_tier ... limit: 0" — no free-tier allocation at all, so they 429
      // on every call regardless of usage. The -latest aliases do have free
      // quota, so default there and let GEMINI_MODEL override on a paid plan.
      model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
      maxTokens: 2048,
      temperature: 0.7,
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      // The previous default, meta-llama/llama-3.3-70b-instruct, is billed
      // per-token on OpenRouter. This is one of OpenRouter's ~18 genuinely
      // $0 ":free"-suffixed models (verified live 2026-07-28) — same family,
      // no cost, and faster in testing (2.0s vs 3.3s for the paid variant).
      model: process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free',
      maxTokens: 2048,
      temperature: 0.7,
    },
    ollama: {
      apiKey: 'ollama', // no real key needed
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      maxTokens: 2048,
      temperature: 0.7,
    },
    // Cloudflare Workers AI. Sits directly behind NVIDIA in the failover chain
    // (see ai/providers/index.js) as a cheap open-weights cushion, so transient
    // NVIDIA failures are absorbed before any metered provider is reached.
    //
    // Needs BOTH a token and an account ID — the account ID is baked into the
    // URL path, not sent as a header. The key is deliberately gated on both:
    // isAvailable() only checks apiKey, so a token set without an account ID
    // would leave baseURL null and the OpenAI SDK would fall back to its
    // default host — quietly sending a Cloudflare token to api.openai.com.
    // Reporting unavailable is the safe failure here.
    cloudflare: {
      apiKey:
        process.env.CLOUDFLARE_AI_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID
          ? process.env.CLOUDFLARE_AI_TOKEN
          : undefined,
      baseURL: process.env.CLOUDFLARE_ACCOUNT_ID
        ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`
        : null,
      // Workers AI model slugs are namespaced with a leading "@cf/".
      model: process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      maxTokens: 2048,
      temperature: 0.7,
    },
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      // 70b currently hangs indefinitely on this NVIDIA account (confirmed via
      // direct API testing) — 8b responds instantly, so it's the safe default
      // until 70B availability is confirmed with NVIDIA.
      model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
      maxTokens: 2048,
      temperature: 0.7,
    },
  },

  // ── Confidence thresholds ────────────────────────────────────────────────────
  confidence: {
    // Content above this goes live automatically
    autoPublish: parseFloat(process.env.AI_CONFIDENCE_AUTO_PUBLISH || '0.75'),
    // Content below this is discarded
    minimum: parseFloat(process.env.AI_CONFIDENCE_MINIMUM || '0.4'),
  },

  // ── Scheduler intervals (cron syntax) ───────────────────────────────────────
  schedules: {
    newsRefresh:        process.env.CRON_NEWS_REFRESH        || '*/30 * * * *',   // every 30 min
    marketRefresh:      process.env.CRON_MARKET_REFRESH      || '*/15 * * * *',   // every 15 min
    // Every 15 min through the NSE session, on weekdays. Server time is UTC, so
    // 03:45–10:00 UTC covers 09:15–15:30 IST plus a little either side. The old
    // '0 1 * * *' fired at 06:30 IST — before the market opened — so it wrote
    // the previous day's close and the page then showed that same number all
    // day, which is what made the quotes look frozen.
    stockRefresh:       process.env.CRON_STOCK_REFRESH       || '*/15 3-10 * * 1-5',
    // 02:30 UTC = 08:00 IST. Ahead of every content job so the day's
    // snapshot exists before anything wants to read a trend from it.
    profileSnapshot:    process.env.CRON_PROFILE_SNAPSHOT    || '30 2 * * *',     // 02:30 UTC / 08:00 IST
    // 03:00 UTC = 08:30 IST. Half an hour after the snapshot, so today's
    // reading already exists for any prediction whose horizon lands today.
    predictionResolve:  process.env.CRON_PREDICTION_RESOLVE  || '0 3 * * *',      // 03:00 UTC / 08:30 IST
    // 03:30 UTC = 09:00 IST. After the snapshot job, whose readings it
    // aggregates; nightly rather than per request because a cohort scan on a
    // chat path would be both slow and a wider surface to get privacy wrong on.
    cohortInsights:     process.env.CRON_COHORT_INSIGHTS     || '30 3 * * *',     // 03:30 UTC / 09:00 IST
    // 04:00 UTC = 09:30 IST. After the snapshot job it reads from, and at an
    // hour a student is awake to act on it.
    judgmentNudge:      process.env.CRON_JUDGMENT_NUDGE      || '0 4 * * *',      // 04:00 UTC / 09:30 IST
    dailyCase:          process.env.CRON_DAILY_CASE          || '0 5 * * *',      // 5am daily
    dailyBriefing:      process.env.CRON_DAILY_BRIEFING      || '0 6 * * *',      // 6am daily
    dailyReflection:    process.env.CRON_DAILY_REFLECTION    || '0 6 * * *',      // 6am daily
    resumeTip:          process.env.CRON_RESUME_TIP          || '0 7 * * *',      // 7am daily
    companyRefresh:     process.env.CRON_COMPANY_REFRESH     || '0 2 * * *',      // 2am daily
    companyNews:        process.env.CRON_COMPANY_NEWS        || '0 3 * * *',      // 3am daily
    interviewQuestions: process.env.CRON_INTERVIEW_QUESTIONS || '0 4 * * 0',      // 4am Sunday
    newsletter:         process.env.CRON_NEWSLETTER          || '0 8 * * 0',      // 8am Sunday
    moderation:         process.env.CRON_MODERATION          || '*/10 * * * *',   // every 10 min
    cleanup:            process.env.CRON_CLEANUP             || '0 0 * * *',      // midnight
  },

  // ── Content settings ─────────────────────────────────────────────────────────
  content: {
    // How many days before a case study is regenerated if none published
    caseBackfillDays: 1,
    // Minimum days between identical resume tips
    resumeTipDeduplicationDays: parseInt(process.env.RESUME_TIP_DEDUP_DAYS || '60', 10),
    // How many briefing sections to include
    briefingSections: ['market', 'finance', 'consulting', 'technology', 'operations', 'economy', 'placements', 'leadership'],
    // News article max age before pruning (days)
    newsMaxAgeDays: parseInt(process.env.NEWS_MAX_AGE_DAYS || '21', 10),
    // How many discussion posts to scan for moderation per run
    moderationBatchSize: parseInt(process.env.MODERATION_BATCH_SIZE || '20', 10),
    // Spam/hate confidence threshold for auto-hide
    moderationHideThreshold: parseFloat(process.env.MODERATION_HIDE_THRESHOLD || '0.85'),
  },

  // ── Retry settings ───────────────────────────────────────────────────────────
  retry: {
    maxAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '3', 10),
    delayMs: parseInt(process.env.AI_RETRY_DELAY_MS || '2000', 10),
    backoffMultiplier: 2,
  },

  // ── RSS feeds ────────────────────────────────────────────────────────────────
  rssFeeds: {
    'stock-market':    'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
    'economy':         'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
    'banking-finance': 'https://economictimes.indiatimes.com/industry/banking/finance/rssfeeds/4264665.cms',
    'startups':        'https://economictimes.indiatimes.com/small-biz/startups/rssfeeds/13357270.cms',
    'ai-tech':         'https://economictimes.indiatimes.com/tech/technology/rssfeeds/13357274.cms',
    'global-business': 'https://economictimes.indiatimes.com/news/international/business/rssfeeds/6165346.cms',
    'operations':      'https://economictimes.indiatimes.com/industry/rssfeeds/1343637.cms',
    'marketing':       'https://economictimes.indiatimes.com/industry/services/advertising/rssfeeds/13357312.cms',
    'corporate':       'https://economictimes.indiatimes.com/news/company/rssfeeds/1309500.cms',
    'placements':      'https://economictimes.indiatimes.com/jobs/rssfeeds/1946072.cms',
  },

  // ── Company news sources ──────────────────────────────────────────────────────
  companyNewsSources: [
    'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
    'https://www.moneycontrol.com/rss/latestnews.xml',
  ],
};
