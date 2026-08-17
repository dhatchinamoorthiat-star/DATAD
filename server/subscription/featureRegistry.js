const { getRank } = require('./tierHierarchy');

const FEATURE = {
  NOTES: 'notes',
  PLANNER: 'planner',
  JOURNAL: 'journal',
  NEWS: 'news',
  CAREER_BASIC: 'career_basic',
  COMMUNITY: 'community',
  DIRECTORY: 'directory',
  FINANCE: 'finance',
  WELLBEING: 'wellbeing',
  AI_CHAT: 'ai_chat',

  AI_SUMMARISE: 'ai_summarise',
  AI_RESUME_REVIEW: 'ai_resume_review',
  AI_PLANNER_SUGGEST: 'ai_planner_suggest',
  SEMANTIC_SEARCH: 'semantic_search',
  BRIEFING: 'briefing',
  DAILY_CASE: 'daily_case',
  STUDY_TOOLS: 'study_tools',

  INTERVIEW_QUESTIONS: 'interview_questions',
  COMPANY_PREMIUM: 'company_premium',
  AI_INTERVIEW_SIMULATOR: 'ai_interview_simulator',
  AI_COMPARE_COMPANIES: 'ai_compare_companies',
  AI_CAREER_ADVICE: 'ai_career_advice',
  RESUME_ATS: 'resume_ats',
  READINESS_SCORE: 'readiness_score',

  KNOWLEDGE_GRAPH: 'knowledge_graph',
  ADVANCED_AI_MEMORY: 'advanced_ai_memory',
  MULTI_WORKSPACE: 'multi_workspace',
  AUTONOMOUS_AI: 'autonomous_ai',
  MARKET_INTELLIGENCE: 'market_intelligence',
  CAREER_ROADMAP: 'career_roadmap',
  CASE_GENERATOR: 'case_generator',

  LINKEDIN_ENHANCER: 'linkedin_enhancer',

  FLASHCARD_GENERATE: 'flashcard_generate',
  QUIZ_GENERATE: 'quiz_generate',
  FINANCE_ASSIST: 'finance_assist',
  DASHBOARD_INSIGHTS: 'dashboard_insights',
  COMPANY_RESEARCH: 'company_research',

  ADMIN_STUDIO: 'admin_studio',
  ADMIN_USERS: 'admin_users',
  ADMIN_ANALYTICS: 'admin_analytics',
  ADMIN_AUTOMATION: 'admin_automation',
  ADMIN_SUBSCRIPTIONS: 'admin_subscriptions',
};

const FEATURE_ACCESS = {
  [FEATURE.NOTES]: 'free',
  [FEATURE.PLANNER]: 'free',
  [FEATURE.JOURNAL]: 'free',
  [FEATURE.NEWS]: 'free',
  [FEATURE.CAREER_BASIC]: 'free',
  [FEATURE.COMMUNITY]: 'free',
  [FEATURE.DIRECTORY]: 'free',
  [FEATURE.FINANCE]: 'free',
  [FEATURE.WELLBEING]: 'free',
  [FEATURE.AI_CHAT]: 'free',

  // Trial band — a 14-day taste of the study layer, not a taste of everything.
  // The trial is deliberately a strict subset of Pro: it should make the student
  // want Pro, not make Pro redundant. Resume *review* sits here because it is
  // the strongest single hook we have; resume *ATS scoring* sits in Pro.
  [FEATURE.AI_SUMMARISE]: 'trial',
  [FEATURE.AI_RESUME_REVIEW]: 'trial',
  [FEATURE.AI_PLANNER_SUGGEST]: 'trial',
  [FEATURE.BRIEFING]: 'trial',
  [FEATURE.DAILY_CASE]: 'trial',
  [FEATURE.STUDY_TOOLS]: 'trial',
  [FEATURE.FLASHCARD_GENERATE]: 'trial',
  [FEATURE.QUIZ_GENERATE]: 'trial',

  // Pro — the everyday plan. Pro previously added only three features over the
  // free trial while every tool a student actually wanted sat behind the
  // Placement Pass, which made Pro a rung nobody had a reason to buy: the
  // rational student ran the trial, dropped to free, and waited for the Pass.
  //
  // Pro now owns the career tools with *recurring* use — the ones you come back
  // to all year, not just in placement season. You iterate a resume for months,
  // you browse the question bank from term one, you research companies before
  // you ever sit an interview. Those belong in a subscription.
  [FEATURE.SEMANTIC_SEARCH]: 'pro',
  [FEATURE.DASHBOARD_INSIGHTS]: 'pro',
  [FEATURE.FINANCE_ASSIST]: 'pro',
  [FEATURE.RESUME_ATS]: 'pro',
  [FEATURE.INTERVIEW_QUESTIONS]: 'pro',
  [FEATURE.COMPANY_RESEARCH]: 'pro',
  // The LinkedIn Enhancer's two model calls previously had no feature gate and
  // no credit metering at all — only verifyToken — so a free account could run
  // them without limit. Saving a profile and a target stays free; the analysis
  // is the part that costs money to serve.
  [FEATURE.LINKEDIN_ENHANCER]: 'pro',
  // Everyday assistant quality rather than placement tooling: workspaces are how
  // a student separates courses, and memory is what makes Dax better than a
  // fresh chatbot session. Both are cheap to serve and argue for Pro directly.
  [FEATURE.MULTI_WORKSPACE]: 'pro',
  [FEATURE.ADVANCED_AI_MEMORY]: 'pro',

  // Placement Pass — the season power tools. What survives here is everything
  // whose value is tied to a specific offer and whose use is bursty: you mock
  // interview for three weeks, not for three terms. This is also the band a
  // general-purpose chatbot cannot substitute for, because it runs on DATAD's
  // own campus/company data.
  [FEATURE.AI_INTERVIEW_SIMULATOR]: 'placement',
  [FEATURE.READINESS_SCORE]: 'placement',
  [FEATURE.AI_COMPARE_COMPANIES]: 'placement',
  [FEATURE.AI_CAREER_ADVICE]: 'placement',
  // The company prep card is split by depth: Pro gets the questions and tips you
  // work through all year (COMPANY_RESEARCH), the Pass gets the salary bands and
  // hiring rounds that only matter once you have an offer conversation coming.
  [FEATURE.COMPANY_PREMIUM]: 'placement',
  // Both of these were fully built and completely ungated. Market intelligence
  // was even advertised as a Placement feature on the pricing page while every
  // free account could read it. The roadmap generator is an AI call that ran
  // with no feature check and no credit metering at all.
  [FEATURE.MARKET_INTELLIGENCE]: 'placement',
  [FEATURE.CAREER_ROADMAP]: 'placement',
  [FEATURE.KNOWLEDGE_GRAPH]: 'placement',
  [FEATURE.AUTONOMOUS_AI]: 'placement',
  [FEATURE.CASE_GENERATOR]: 'placement',

  [FEATURE.ADMIN_STUDIO]: 'admin',
  [FEATURE.ADMIN_USERS]: 'admin',
  [FEATURE.ADMIN_ANALYTICS]: 'admin',
  [FEATURE.ADMIN_AUTOMATION]: 'admin',
  [FEATURE.ADMIN_SUBSCRIPTIONS]: 'admin',
};

function getMinimumTier(feature) {
  return FEATURE_ACCESS[feature] || null;
}

function getAllFeatures() {
  return Object.values(FEATURE);
}

/**
 * The capability map handed to the client.
 *
 * `|| minTier === 'admin'` used to make every admin feature true for everyone —
 * getRank('admin') is undefined and falls back to 0, so the rank test passed for
 * a free account too. canAccessFeature() refused these server-side, so it was
 * never an escalation, but the map still told every student the admin studio was
 * unlocked, and anything rendering off `hasFeature(ADMIN_*)` would show it.
 *
 * Admins get everything, matching canAccessFeature's own admin short-circuit.
 */
function getFeaturesForTier(tier, { isAdmin = false } = {}) {
  const rank = getRank(tier);
  return Object.fromEntries(
    Object.entries(FEATURE_ACCESS).map(([feature, minTier]) => [
      feature,
      isAdmin || (minTier !== 'admin' && getRank(minTier) <= rank),
    ])
  );
}

module.exports = { FEATURE, FEATURE_ACCESS, getMinimumTier, getAllFeatures, getFeaturesForTier };
