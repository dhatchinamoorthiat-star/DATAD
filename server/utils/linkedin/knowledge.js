/**
 * LinkedIn knowledge layer — the rules the analysis reasons from.
 *
 * Everything a human would call "an opinion about LinkedIn" lives here rather
 * than being scattered through the scorer, the prompts and the UI. Two reasons:
 *
 *  1. Scores have to be reproducible. `RULES_VERSION` is stamped onto every
 *     stored analysis, so an old score can always be explained by the rules
 *     that produced it, and improving the rules never silently rewrites
 *     history.
 *  2. Careers advice ages. Bumping a lexicon or a role's terminology should be
 *     a one-file edit, not a rewrite of the analyzer.
 *
 * What is deliberately NOT here: claims of the form "adding N skills increases
 * views by X%". Those numbers circulate widely and are not verifiable, so the
 * rules encode *structural* guidance (say what role you want, back claims with
 * evidence, use the terminology recruiters search) rather than growth-hacking
 * folklore.
 */

// Bump on any change that can move a score. Stored on every analysis.
const RULES_VERSION = '2026.08.1';

// Bump when the analysis *shape* changes (new sections, new fields), so the
// client can refuse to render a payload it does not understand.
const ANALYSIS_VERSION = 1;

// ── Role taxonomy ──────────────────────────────────────────────────────────
// Per role: the terminology recruiters actually search on, split by kind.
// `titles`   — job-title language that belongs in the headline / experience.
// `hard`     — tools and techniques; these are the keywords worth chasing.
// `domain`   — industry/function vocabulary that signals context.
// `evidence` — the kinds of proof that make a claim to this role credible.
//
// Extends roadmapService.ROLE_SKILL_MAP rather than replacing it: that map
// answers "what should I learn", this one answers "what should a recruiter be
// able to find". Roles absent from this table still score — they fall back to
// the generic profile in `roleProfile()` — they just score less specifically.
const ROLES = {
  'product analyst': {
    titles: ['Product Analyst', 'Data Analyst', 'Business Analyst', 'Analytics'],
    hard: ['SQL', 'Product Analytics', 'A/B Testing', 'Excel', 'Python', 'Dashboards', 'Mixpanel', 'Amplitude', 'GA4', 'Tableau'],
    domain: ['Funnel Analysis', 'Retention', 'Experimentation', 'Metrics', 'User Behaviour', 'Cohort Analysis'],
    evidence: ['analysis project with a stated decision it informed', 'dashboard or notebook link', 'experiment writeup'],
  },
  'data analyst': {
    titles: ['Data Analyst', 'Business Analyst', 'Analytics'],
    hard: ['SQL', 'Excel', 'Python', 'Power BI', 'Tableau', 'Statistics', 'Data Visualisation'],
    domain: ['Reporting', 'KPIs', 'Data Cleaning', 'Stakeholder Reporting', 'Forecasting'],
    evidence: ['a dashboard', 'a published analysis', 'a dataset project on GitHub'],
  },
  'data scientist': {
    titles: ['Data Scientist', 'Machine Learning', 'Applied Scientist'],
    hard: ['Python', 'Machine Learning', 'Statistics', 'SQL', 'scikit-learn', 'Deep Learning', 'Pandas', 'Model Evaluation'],
    domain: ['Feature Engineering', 'Experimentation', 'Predictive Modelling', 'NLP', 'Time Series'],
    evidence: ['a model with reported evaluation metrics', 'a Kaggle placement', 'a research paper or preprint'],
  },
  'software engineer': {
    titles: ['Software Engineer', 'Software Developer', 'Backend Engineer', 'Full Stack Developer'],
    hard: ['Data Structures', 'Algorithms', 'System Design', 'Git', 'REST APIs', 'SQL', 'Testing', 'Docker'],
    domain: ['Scalability', 'Code Review', 'CI/CD', 'Debugging', 'Open Source'],
    evidence: ['a GitHub repository with real commits', 'a deployed application', 'a technical writeup'],
  },
  'frontend engineer': {
    titles: ['Frontend Engineer', 'Frontend Developer', 'UI Engineer', 'Software Engineer'],
    hard: ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'Accessibility', 'Performance', 'Testing'],
    domain: ['Responsive Design', 'Design Systems', 'Web Vitals', 'State Management'],
    evidence: ['a live deployed interface', 'a component library', 'a performance case study'],
  },
  'backend engineer': {
    titles: ['Backend Engineer', 'Software Engineer', 'Platform Engineer'],
    hard: ['Node.js', 'Python', 'Java', 'SQL', 'REST APIs', 'System Design', 'Docker', 'CI/CD', 'Caching'],
    domain: ['Scalability', 'Database Design', 'Reliability', 'Observability'],
    evidence: ['a deployed API', 'a load or reliability writeup', 'a GitHub repository'],
  },
  'product manager': {
    titles: ['Product Manager', 'Associate Product Manager', 'Product Owner'],
    hard: ['Product Strategy', 'User Research', 'Roadmapping', 'A/B Testing', 'SQL', 'Analytics', 'Agile'],
    domain: ['Discovery', 'Prioritisation', 'Stakeholder Management', 'Go-to-Market', 'Customer Interviews'],
    evidence: ['a product teardown', 'a shipped feature with an outcome', 'user research writeup'],
  },
  'business analyst': {
    titles: ['Business Analyst', 'Data Analyst', 'Operations Analyst'],
    hard: ['Excel', 'SQL', 'Requirements Gathering', 'Process Modelling', 'Data Analysis', 'Power BI'],
    domain: ['Stakeholder Management', 'Process Improvement', 'Documentation', 'Cost Analysis'],
    evidence: ['a process improvement with a stated result', 'a requirements document', 'an analysis deck'],
  },
  'consultant': {
    titles: ['Consultant', 'Business Analyst', 'Strategy Analyst'],
    hard: ['Case Analysis', 'Excel', 'Financial Modelling', 'Market Research', 'Presentation', 'Data Analysis'],
    domain: ['Problem Structuring', 'Client Management', 'Strategy', 'Benchmarking'],
    evidence: ['a case competition placement', 'a live client project', 'a published market study'],
  },
  'marketing manager': {
    titles: ['Marketing Manager', 'Growth Marketer', 'Digital Marketing'],
    hard: ['SEO', 'SEM', 'Google Analytics', 'Content Strategy', 'Email Marketing', 'Campaign Management', 'A/B Testing'],
    domain: ['Brand', 'Positioning', 'Funnel', 'Audience Segmentation', 'Conversion Rate'],
    evidence: ['a campaign with reported reach or conversion', 'a content portfolio', 'a growth case study'],
  },
  'ux designer': {
    titles: ['UX Designer', 'Product Designer', 'UI/UX Designer'],
    hard: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Usability Testing', 'Interaction Design'],
    domain: ['Design Systems', 'Accessibility', 'Information Architecture', 'User Flows'],
    evidence: ['a portfolio with process, not just screens', 'a usability study', 'a case study'],
  },
  'financial analyst': {
    titles: ['Financial Analyst', 'Investment Analyst', 'Equity Research'],
    hard: ['Financial Modelling', 'Valuation', 'Excel', 'Accounting', 'DCF', 'Financial Statements'],
    domain: ['Equity Research', 'Forecasting', 'Variance Analysis', 'Capital Markets'],
    evidence: ['a valuation model', 'an equity research note', 'a stock pitch'],
  },
  'human resources': {
    titles: ['HR Generalist', 'Talent Acquisition', 'People Operations', 'HR Analyst'],
    hard: ['Recruitment', 'HRIS', 'Excel', 'Onboarding', 'Employee Engagement', 'HR Analytics'],
    domain: ['Talent Pipeline', 'Employer Branding', 'Performance Management', 'Compensation'],
    evidence: ['hiring numbers you actually own', 'an engagement initiative and its result', 'an HR analytics project'],
  },
};

// Skills every professional profile benefits from naming, kept small on
// purpose — a long generic list is how keyword stuffing starts.
const UNIVERSAL_TERMS = ['Communication', 'Problem Solving', 'Teamwork', 'Stakeholder Management'];

const GENERIC_ROLE_PROFILE = {
  titles: [],
  hard: [],
  domain: [],
  evidence: ['a project with a described outcome', 'a portfolio or GitHub link', 'a certification relevant to the role'],
};

/** Case/spacing-insensitive lookup with a "contains" fallback for near-misses. */
function roleProfile(targetRole) {
  const key = String(targetRole || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!key) return { ...GENERIC_ROLE_PROFILE, matched: null };
  if (ROLES[key]) return { ...ROLES[key], matched: key };

  // "Junior Product Analyst" / "Product Analyst Intern" should still resolve.
  const hit = Object.keys(ROLES).find((r) => key.includes(r) || r.includes(key));
  return hit ? { ...ROLES[hit], matched: hit } : { ...GENERIC_ROLE_PROFILE, matched: null };
}

// ── Lexicons ───────────────────────────────────────────────────────────────

/**
 * Words that describe a personality rather than a contribution. Their presence
 * is not itself a fault; a headline or About built *only* from them is, because
 * a recruiter cannot verify or search any of it.
 */
const BUZZWORDS = [
  'passionate', 'motivated', 'hardworking', 'hard-working', 'dedicated', 'enthusiastic',
  'dynamic', 'results-driven', 'detail-oriented', 'team player', 'go-getter', 'self-starter',
  'thought leader', 'guru', 'ninja', 'rockstar', 'visionary', 'synergy', 'leverage',
  'aspiring', 'seeking opportunities', 'eager to learn', 'quick learner', 'out of the box',
];

/** Verbs that report attendance rather than contribution. */
const WEAK_VERBS = [
  'worked on', 'helped with', 'assisted with', 'involved in', 'participated in',
  'responsible for', 'was part of', 'took part in', 'exposure to', 'familiar with',
  'learned about', 'gained knowledge', 'handled', 'dealt with',
];

/** Phrases so common they carry no information about this particular person. */
const GENERIC_PHRASES = [
  'i am a passionate', 'looking for opportunities', 'open to opportunities',
  'i am a student pursuing', 'currently pursuing my', 'always eager to learn',
  'i believe in', 'strong believer', 'wear many hats', 'proven track record',
  'excellent communication skills', 'good team player', 'i am a highly',
];

/** Openings that signal a rewritten-by-a-model About with no specifics in it. */
const TEMPLATE_OPENERS = [
  'in today\'s fast-paced', 'in the ever-evolving', 'as a seasoned',
  'with a proven track record of', 'i am a results-driven professional',
  'throughout my journey', 'i thrive in',
];

/** Verbs that describe a contribution someone can be held to. */
const STRONG_VERBS = [
  'built', 'designed', 'shipped', 'launched', 'analysed', 'analyzed', 'automated',
  'reduced', 'increased', 'improved', 'led', 'founded', 'migrated', 'implemented',
  'developed', 'created', 'delivered', 'negotiated', 'published', 'presented',
  'trained', 'optimised', 'optimized', 'scaled', 'forecast', 'modelled', 'modeled',
];

// ── Thresholds ─────────────────────────────────────────────────────────────
// Named so the scorer reads as prose and every number has one home.
const T = {
  HEADLINE_MIN: 40,          // below this a headline is usually just a degree
  HEADLINE_MAX: 220,         // LinkedIn's own limit
  HEADLINE_KEYWORD_MAX: 6,   // more separators than this reads as a keyword list
  ABOUT_MIN: 400,            // roughly three short paragraphs
  ABOUT_STRONG: 900,
  ABOUT_MAX: 2600,           // past this, nobody finishes it
  EXPERIENCE_BULLET_MIN: 60, // a one-line duty statement
  SKILLS_MIN: 8,
  SKILLS_STRONG: 15,
  SKILLS_MAX: 50,            // LinkedIn's cap; near it, relevance is diluted
  RECOMMENDATIONS_STRONG: 2,
  BUZZWORD_DENSITY_FLAG: 0.02, // buzzwords per word before it reads as filler
};

/** Dimension weights. Must total 100 — asserted in tests. */
const DIMENSIONS = {
  positioning:  { label: 'Positioning',  max: 20 },
  searchability:{ label: 'Searchability',max: 20 },
  credibility:  { label: 'Credibility',  max: 20 },
  completeness: { label: 'Completeness', max: 15 },
  narrative:    { label: 'Narrative',    max: 15 },
  conversion:   { label: 'Conversion',   max: 10 },
};

module.exports = {
  RULES_VERSION,
  ANALYSIS_VERSION,
  ROLES,
  UNIVERSAL_TERMS,
  roleProfile,
  BUZZWORDS,
  WEAK_VERBS,
  GENERIC_PHRASES,
  TEMPLATE_OPENERS,
  STRONG_VERBS,
  T,
  DIMENSIONS,
};
