/**
 * Feature keys and their owning tier. MIRRORS server/subscription/featureRegistry.js
 * — that file is authoritative, this one exists so a gate can render the right
 * plan name without waiting on a network round trip.
 *
 * The mirroring is asserted by server/tests/pricing.test.js, which parses this
 * file as text. Any change here must be made server-side first.
 *
 * Access is NEVER decided from this table. TierGate asks the server-computed
 * capabilities map (SubscriptionContext.hasFeature); the tiers below only pick
 * the label and colour on the lock panel. That split is deliberate: if this file
 * goes stale the worst case is a gate that names the wrong plan, not a gate that
 * lets the wrong student through.
 */

export const FEATURE = {
  // Free — the batch utility layer.
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

  // Trial — a 14-day taste of the study layer.
  AI_SUMMARISE: 'ai_summarise',
  AI_RESUME_REVIEW: 'ai_resume_review',
  AI_PLANNER_SUGGEST: 'ai_planner_suggest',
  BRIEFING: 'briefing',
  DAILY_CASE: 'daily_case',
  STUDY_TOOLS: 'study_tools',
  FLASHCARD_GENERATE: 'flashcard_generate',
  QUIZ_GENERATE: 'quiz_generate',

  // Pro — the everyday plan: study depth plus the career tools with recurring use.
  SEMANTIC_SEARCH: 'semantic_search',
  DASHBOARD_INSIGHTS: 'dashboard_insights',
  FINANCE_ASSIST: 'finance_assist',
  RESUME_ATS: 'resume_ats',
  INTERVIEW_QUESTIONS: 'interview_questions',
  COMPANY_RESEARCH: 'company_research',
  LINKEDIN_ENHANCER: 'linkedin_enhancer',
  MULTI_WORKSPACE: 'multi_workspace',
  ADVANCED_AI_MEMORY: 'advanced_ai_memory',

  // Placement Pass — the season power tools.
  AI_INTERVIEW_SIMULATOR: 'ai_interview_simulator',
  READINESS_SCORE: 'readiness_score',
  AI_COMPARE_COMPANIES: 'ai_compare_companies',
  AI_CAREER_ADVICE: 'ai_career_advice',
  COMPANY_PREMIUM: 'company_premium',
  MARKET_INTELLIGENCE: 'market_intelligence',
  CAREER_ROADMAP: 'career_roadmap',
  KNOWLEDGE_GRAPH: 'knowledge_graph',
  AUTONOMOUS_AI: 'autonomous_ai',
  CASE_GENERATOR: 'case_generator',
};

export const FEATURE_MIN_TIER = {
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

  [FEATURE.AI_SUMMARISE]: 'trial',
  [FEATURE.AI_RESUME_REVIEW]: 'trial',
  [FEATURE.AI_PLANNER_SUGGEST]: 'trial',
  [FEATURE.BRIEFING]: 'trial',
  [FEATURE.DAILY_CASE]: 'trial',
  [FEATURE.STUDY_TOOLS]: 'trial',
  [FEATURE.FLASHCARD_GENERATE]: 'trial',
  [FEATURE.QUIZ_GENERATE]: 'trial',

  [FEATURE.SEMANTIC_SEARCH]: 'pro',
  [FEATURE.DASHBOARD_INSIGHTS]: 'pro',
  [FEATURE.FINANCE_ASSIST]: 'pro',
  [FEATURE.RESUME_ATS]: 'pro',
  [FEATURE.INTERVIEW_QUESTIONS]: 'pro',
  [FEATURE.COMPANY_RESEARCH]: 'pro',
  [FEATURE.LINKEDIN_ENHANCER]: 'pro',
  [FEATURE.MULTI_WORKSPACE]: 'pro',
  [FEATURE.ADVANCED_AI_MEMORY]: 'pro',

  [FEATURE.AI_INTERVIEW_SIMULATOR]: 'placement',
  [FEATURE.READINESS_SCORE]: 'placement',
  [FEATURE.AI_COMPARE_COMPANIES]: 'placement',
  [FEATURE.AI_CAREER_ADVICE]: 'placement',
  [FEATURE.COMPANY_PREMIUM]: 'placement',
  [FEATURE.MARKET_INTELLIGENCE]: 'placement',
  [FEATURE.CAREER_ROADMAP]: 'placement',
  [FEATURE.KNOWLEDGE_GRAPH]: 'placement',
  [FEATURE.AUTONOMOUS_AI]: 'placement',
  [FEATURE.CASE_GENERATOR]: 'placement',
};
