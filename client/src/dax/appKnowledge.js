// What Dax knows about DATAD itself — the sections, what lives inside each one,
// and what the plans cost.
//
// This exists because "explain the Career section" is a question Dax should be
// able to answer perfectly without a model: the answer is a fact about the
// product, not a generation. Keeping it here means the maintenance build can
// answer it today, and the live build can be handed the same text later instead
// of hallucinating a tour of pages that don't exist.
//
// SOURCES OF TRUTH — every route and price below is copied from these, and any
// change there must be mirrored here:
//   client/src/utils/workspaces.js      WORKSPACES / WORKSPACE_TABS (the 9 sections)
//   client/src/App.jsx                  the routes themselves
//   server/subscription/pricing.js      prices and durations
//   server/subscription/featureRegistry.js  which tier unlocks what
//   server/subscription/subscriptionService.js  CHAT_QUOTAS
//
// Blurbs are written in Dax's voice (first person, no "as an AI") per
// DAX_NAMING.md, because they are spoken straight back to the student.

/**
 * The nine primary sections, in the order they appear in the rail and the
 * mobile tab bar. `aliases` are what a student might actually type — the label
 * is rarely the word they use ("money" for Finance, "placement" for Career).
 */
export const SECTIONS = [
  {
    key: 'dashboard',
    label: 'Home',
    route: '/dashboard',
    aliases: ['home', 'dashboard', 'landing', 'main page', 'front page'],
    blurb:
      'Your daily starting point. It pulls together what needs you today — upcoming tasks, your case streak, readiness cards and the latest from your batch — so you can see where you stand without opening five pages.',
    subs: [],
  },
  {
    key: 'dax',
    label: 'Dax',
    route: '/dax',
    aliases: ['dax', 'assistant', 'chat', 'ai', 'chatbot'],
    blurb:
      // First sentence has to stand alone: the section overview quotes it.
      "Me — a full chat workspace with threads, history and folders. I can read your notes, tasks, resume and the company database, so you don't have to paste things in to ask about them.",
    subs: [],
  },
  {
    key: 'study',
    label: 'Study',
    route: '/study',
    aliases: ['study', 'studies', 'academics', 'academic', 'coursework', 'learning'],
    blurb:
      'Everything academic in one place: your notes, the work you owe, the resources your batch shares, and the focus tools for actually getting through it.',
    subs: [
      // /study/notes/new and /career/resume/preview are actions inside these
      // pages rather than destinations of their own, so they are aliases here
      // instead of separate entries in the map.
      { label: 'Notes', route: '/study/notes', aliases: ['note', 'new note', 'write a note'], blurb: 'Write and organise notes, and read the ones your batch has shared. I can summarise any of them.' },
      { label: 'Work', route: '/study/work', aliases: ['assignments', 'projects', 'homework', 'submissions'], blurb: 'Assignments and projects — what is due, what is in progress, what is done.' },
      { label: 'Resources', route: '/study/resources', aliases: ['study material', 'references', 'reading'], blurb: 'Shared study material and references for your subjects.' },
      { label: 'Subject', route: '/study/subject', aliases: ['subjects', 'my subjects', 'courses'], blurb: 'A single subject in one view — its notes, work and resources together.' },
      { label: 'Focus', route: '/study/focus', aliases: ['study tools', 'flashcards', 'quiz', 'quizzes', 'revision'], blurb: 'Study tools — flashcards, quizzes and focus sessions built from your own topics.' },
    ],
  },
  {
    key: 'career',
    label: 'Career',
    route: '/career',
    aliases: ['career', 'careers', 'placement', 'placements', 'job', 'jobs', 'recruitment', 'hiring', 'career hub'],
    blurb:
      'The placement core — the things you work on all the way to an offer: your resume, the companies hiring on campus, the roles open to you, and the questions you will be asked.',
    subs: [
      { label: 'Companies', route: '/career/companies', aliases: ['recruiters', 'company database', 'company list'], blurb: 'The campus recruiter database — what each company does, the roles they hire for, their selection rounds and what they look for.' },
      { label: 'Opportunities', route: '/career/opportunities', aliases: ['internships', 'openings', 'vacancies', 'apply'], blurb: 'Jobs and internships open to your batch.' },
      { label: 'Resume', route: '/career/resume', aliases: ['cv', 'resume builder', 'resume preview', 'export my resume'], blurb: 'Build your resume section by section, preview it, export it — and have me review it against a real placement bar.' },
      { label: 'LinkedIn', route: '/career/linkedin', blurb: 'Your LinkedIn profile against a target role, with what to change.' },
      { label: 'Interview Qs', route: '/career/questions', aliases: ['interview questions', 'question bank', 'interview prep', 'interview'], blurb: 'The interview question bank — HR, technical and case, sorted by company and round.' },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    route: '/growth',
    aliases: ['growth', 'upskill', 'upskilling', 'skill', 'skills', 'roadmap', 'development'],
    blurb:
      'The longer game, split out of Career because it is about becoming a stronger candidate rather than chasing one offer: closing skill gaps, changing direction, and having your stories ready.',
    subs: [
      { label: 'Roadmap', route: '/growth/roadmap', aliases: ['skill roadmap', 'skill gap', 'upskilling plan'], blurb: 'A month-by-month upskilling plan built from the gap between where you are and the role you want.' },
      { label: 'Pivot', route: '/growth/pivot', aliases: ['career change', 'switch track', 'change domain'], blurb: 'Switching track — what transfers, what is missing, and how long the move realistically takes.' },
      { label: 'STAR Stories', route: '/growth/stories', aliases: ['star', 'stories', 'behavioural answers'], blurb: 'Your experiences written up as STAR answers, so you are not inventing them in the interview.' },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    route: '/community',
    aliases: ['community', 'batch', 'batchmates', 'social', 'people', 'network', 'classmates'],
    blurb:
      'Your batch, on one page — what everyone is posting, what is officially announced, who is who, and what they are trading, teaching and remembering.',
    subs: [
      { label: 'Feed', route: '/community/feed', aliases: ['stream', 'posts', 'discussions', 'timeline'], blurb: 'The batch stream — posts, discussions and reactions.' },
      { label: 'Announcements', route: '/community/announcements', aliases: ['notices', 'official news'], blurb: 'Official notices. The ones you should not miss.' },
      { label: 'Events', route: '/community/events', aliases: ['meetups'], blurb: 'What is coming up, and who is going.' },
      { label: 'People', route: '/community/directory', aliases: ['directory', 'batch directory', 'find a classmate'], blurb: 'The batch directory — find a classmate by name, skill or interest.' },
      { label: 'BatchVault', route: '/community/memories', aliases: ['batch vault', 'memories', 'gallery', 'photos', 'albums', 'archive'], blurb: 'The batch archive — photos and memories that outlast the term.' },
      { label: 'Marketplace', route: '/community/marketplace', aliases: ['buy and sell', 'selling', 'second hand'], blurb: 'Buy, sell and pass on things within the batch.' },
      { label: 'Skills', route: '/community/skills', aliases: ['skill exchange', 'peer learning', 'teach'], blurb: 'Skill exchange — teach what you know, learn what you do not, from your own batch.' },
    ],
  },
  {
    key: 'me',
    label: 'Life',
    route: '/me',
    // No 'me' alias, however natural it looks: "tell me about yourself" would
    // then resolve to the Life section instead of reaching the identity answer.
    aliases: ['life', 'personal', 'planner', 'journal', 'calendar', 'schedule', 'tasks', 'todo', 'settings'],
    blurb:
      'Your own organisation layer — the plan for your days and the record of them. Personal by default: nothing here is shared with your batch.',
    subs: [
      // No 'reflection' alias — that is now its own page below, and the two tied
      // on alias length, so Journal was answering for it.
      { label: 'Journal', route: '/me/journal', aliases: ['diary'], blurb: 'Private writing and reflection.' },
      { label: 'Planner', route: '/me/planner', aliases: ['add a task', 'deadlines', 'to do list'], blurb: 'Tasks and deadlines — what is due, what is overdue, what is next.' },
      { label: 'Calendar', route: '/me/calendar', aliases: ['timetable'], blurb: 'Your schedule, with your tasks and batch events on it.' },
      { label: 'Reflection', route: '/me/reflection', aliases: ['weekly reflection', 'review my week'], blurb: 'A structured look back at how the week actually went.' },
      { label: 'Settings', route: '/me/settings', aliases: ['preferences', 'my account', 'profile settings'], blurb: 'Your account, program details and preferences.' },
      { label: 'Program', route: '/me/program', aliases: ['my program', 'course settings', 'degree settings'], blurb: 'Which program and subjects you are on — this is what tailors the rest of DATAD to your course.' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    route: '/finance',
    aliases: ['finance', 'financial', 'money', 'budget', 'expenses', 'spending', 'loan', 'investment', 'stocks'],
    blurb:
      'Money, for a student who is spending on a degree and starting to earn from it. Track what goes out, run the numbers on decisions, and learn the concepts behind them.',
    subs: [
      { label: 'Tracker', route: '/finance/tracker', aliases: ['expense tracker', 'track expenses', 'budgeting'], blurb: 'Where your money actually goes — expenses, budgets, and the gap between them.' },
      { label: 'Calculator', route: '/finance/calculator', aliases: ['emi', 'sip', 'compounding'], blurb: 'EMI, SIP, compounding and the rest, without a spreadsheet.' },
      { label: 'Stocks', route: '/finance/stocks', aliases: ['market', 'shares', 'trading'], blurb: 'Market tracking and how to read what you are looking at.' },
      { label: 'Learn', route: '/finance/learn', aliases: ['finance basics', 'personal finance'], blurb: 'Personal finance explained for where you are now, not for someone with a salary.' },
      { label: 'ROI', route: '/finance/roi', aliases: ['return on investment', 'degree worth it', 'fees vs salary'], blurb: 'What your degree costs against what it is likely to return.' },
    ],
  },
  {
    key: 'wellbeing',
    label: 'Wellbeing',
    route: '/wellbeing',
    aliases: ['wellbeing', 'well being', 'wellness', 'health', 'mental health', 'stress', 'burnout', 'habits', 'sleep'],
    blurb:
      'The part of placement season nobody schedules. How to study without burning out, how to hold on to what you learn, how to keep a routine, and where to go when it gets heavy.',
    subs: [
      { label: 'Study Tips', route: '/wellbeing/study', aliases: ['study techniques', 'how to study'], blurb: 'How to study — the techniques that hold up under pressure.' },
      { label: 'Memory', route: '/wellbeing/memory', aliases: ['retention', 'recall', 'cramming', 'spaced repetition'], blurb: 'Retention and recall: spacing, retrieval, and why cramming fails you.' },
      { label: 'Routines', route: '/wellbeing/routines', aliases: ['sleep', 'habits', 'daily routine', 'breaks'], blurb: 'Sleep, breaks and daily structure that survive a heavy term.' },
      // Two pages are called "Support" — this one and the backing page at
      // /support. Bare "support" resolves here, since a student inside DATAD
      // asking about support usually means this; "support page" is given to the
      // other one by the longer alias there.
      { label: 'Support', route: '/wellbeing/support', aliases: ['counselling', 'mental health support', 'wellbeing support', 'struggling'], blurb: 'Where to turn when it is more than a bad week.' },
    ],
  },
];

// Every page that is not a section or one of its tabs. Auth pages and the admin
// console are handled separately below — the first are reachable only when
// logged out, the second only by admins, and describing either as though a
// student can just open it would be wrong.
export const EXTRA_PAGES = [
  { label: 'Briefing', route: '/briefing', aliases: ['briefing', 'news', 'market news', 'daily brief'], blurb: 'The daily briefing — business news and market movement, filtered to what is worth your ten minutes.' },
  // 'find' and 'help' are deliberately not aliases — both are ordinary verbs
  // ("find me a job", "can you help me") and would hijack unrelated questions.
  { label: 'Search', route: '/search', aliases: ['search', 'search page'], blurb: 'Search across everything at once — notes, tasks, companies, people and pages.' },
  { label: 'Plans', route: '/subscribe', aliases: ['subscribe', 'plans', 'pricing', 'upgrade', 'billing', 'subscription'], blurb: 'Plans and billing — compare what each plan unlocks and upgrade from here.' },
  // NOT a help desk, despite the name — it is the "back the project" page. It
  // was described here as "where to reach a human when something is wrong",
  // which would have sent students with a billing problem to a donation page.
  { label: 'Support', route: '/support', aliases: ['support page', 'back the project', 'donate', 'early supporter', 'backing'], blurb: 'Where the money goes and how to back DATAD as an early supporter — the mission, the costs, and a UPI link. Not a help desk.' },
  { label: 'About', route: '/about', aliases: ['about', 'about datad', 'the story'], blurb: 'What DATAD is and why it exists.' },
  { label: 'Creator', route: '/creator', aliases: ['creator', 'the maker', 'who built datad'], blurb: 'The person who built DATAD, what guides the decisions, and how to reach him.' },
  { label: 'Brand', route: '/brand', aliases: ['brand', 'the logo', 'the mark'], blurb: 'The story of the DATAD mark — why the logo looks the way it does.' },
  { label: 'PSW', route: '/psw', aliases: ['psw', 'pitch deck'], blurb: 'Pitch. Sell. Win. — the story of DATAD told for an audience, in one page.' },
  { label: 'Walkthrough', route: '/pitch', aliases: ['pitch', 'walkthrough', 'demo', 'demo video', 'product tour'], blurb: 'A timed walkthrough reel of the product, section by section — the demo, without a video file.' },
  { label: 'Developer', route: '/developer', aliases: ['developer', 'api', 'api keys'], blurb: 'API keys, for programmatic access to your own DATAD data.' },
  { label: 'Privacy', route: '/privacy', aliases: ['privacy', 'privacy policy', 'my data'], blurb: 'What is collected, what is not, and how to have your data removed.' },
  { label: 'Terms', route: '/terms', aliases: ['terms', 'terms of service', 'legal'], blurb: 'The terms you are using DATAD under.' },
];

// How a student actually reaches a human. `/support` is not it, and Dax must
// never imply it can see anyone's account, payment or data itself.
export const CONTACT_EMAIL = 'digitaldoncodes@gmail.com';

// The account pages only exist while logged out, so they are answered as
// instructions rather than as places to visit.
export const ACCOUNT_HELP = {
  aliases: ['forgot password', 'reset password', 'change password', 'log in', 'sign in', 'sign up', 'verify email', 'log out', 'delete my account'],
  blurb: [
    'Password reset runs from the login page — "Forgot password" at /login sends a reset link to your registered address.',
    'Email verification uses the link mailed to you when you registered.',
    `Anything else about your account — a wrong email, a deletion request, an upgrade that did not activate — goes to ${CONTACT_EMAIL}. I cannot change account details myself.`,
  ].join('\n'),
};

// 15 admin routes exist under /admin. A student cannot open any of them, so
// they are one answer rather than fifteen entries in the map.
export const ADMIN_NOTE =
  'The admin console at /admin is staff-only — student management, content publishing, the company and case databases, AI observability and subscriptions all live there. If you are not an admin the route simply will not open for you.';

// ── Plans ───────────────────────────────────────────────────────────────────
//
// Prices mirror server/subscription/pricing.js; chat limits mirror CHAT_QUOTAS;
// the feature splits mirror featureRegistry.js's FEATURE_ACCESS bands. The
// trial line describes what the trial actually unlocks (the study band), not
// "all of Pro" — enforcement treats it as a strict subset of Pro.

export const PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: '₹0',
    chat: 20,
    line: 'Free — ₹0. Notes, planner, journal, calendar, community, directory, finance tools, wellbeing and company browsing, plus 20 messages with me a day.',
    best: 'Everything your batch shares. Nothing AI-heavy.',
  },
  {
    id: 'trial',
    label: '14-day trial',
    price: '₹0',
    chat: 50,
    line: 'Free 14-day trial — ₹0, once per account. Adds note summaries, resume review, planner suggestions, the daily briefing, daily cases and the study tools (flashcards, quizzes). 50 messages a day.',
    best: 'Trying the study layer before you pay for it.',
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '₹149/month or ₹1,199/year',
    chat: 200,
    line: 'Pro — ₹149 a month, or ₹1,199 a year. Everything in the trial, kept, plus ATS resume scoring, the interview question bank, company research, the LinkedIn enhancer, semantic search across your own work, dashboard insights, finance help, multiple workspaces and my long-term memory of you. 200 messages a day.',
    best: 'The everyday plan — the tools you come back to all year.',
  },
  {
    id: 'placement',
    label: 'Placement Pass',
    price: '₹999 one-time, 4 months',
    chat: 750,
    line: 'Placement Pass — ₹999 once, covering 4 months. Everything in Pro, plus the mock interview simulator, your readiness score, company comparisons, personalised career advice, salary bands and hiring rounds, market intelligence and the skill roadmap generator. 750 messages a day.',
    best: 'Placement season itself — bought once, not renewed.',
  },
];

/**
 * Which plan a stated need points at, or null when nothing in the text is
 * specific enough to recommend on.
 *
 * Deliberately conservative: with no model behind it, guessing wrong sends a
 * student to pay for the wrong thing. Matching nothing produces the comparison
 * instead, which is never wrong — only less helpful.
 */
// No trailing \b on the alternations: "mock interviews" would fail it, since
// there is no word boundary between the "w" of interview and its plural "s".
// Tested — that exact phrasing was silently falling through to the comparison.
const PLAN_SIGNALS = [
  {
    plan: 'placement',
    test: /\b(mock\s+interview|interview\s+simulat|placement\s+season|readiness|compare\s+compan|salary|package|ctc|career\s+advice|market\s+intelligence|roadmap|getting\s+placed|placement\s+prep)/,
    because: 'that is placement-season tooling',
  },
  {
    plan: 'pro',
    test: /\b(ats|resume\s+score|question\s+bank|interview\s+question|company\s+research|linkedin|semantic\s+search|workspace|memory|every\s?day|all\s+year|long\s+term)/,
    because: 'those are the tools you use all year rather than for one season',
  },
  {
    plan: 'trial',
    test: /\b(try|trial|test\s+it|before\s+i\s+(pay|buy)|not\s+sure|see\s+first|free\s+trial)/,
    because: 'you can see the study layer for yourself before paying',
  },
  {
    plan: 'free',
    // "I only need notes and a planner" is the commonest way this gets asked,
    // so the qualifier and the noun are matched with words allowed between them
    // rather than glued together.
    test: /\b(no\s+money|cannot\s+pay|can'?t\s+pay|broke|cheap|budget|free\s+one|stay\s+free)|\b(only|just)\b[\w\s]{0,20}\b(notes?|planner|journal|community|basics?)/,
    because: 'the notes, planner, community and finance tools cost nothing',
  },
];

export function recommendPlan(query) {
  const signal = PLAN_SIGNALS.find((s) => s.test.test(query));
  if (!signal) return null;
  const plan = PLANS.find((p) => p.id === signal.plan);
  return { plan, because: signal.because };
}

/**
 * Questions about the student's OWN data — which nothing here can answer.
 *
 * These were the worst failure in the maintenance build: "what are my tasks"
 * matched the word "tasks", so Dax answered with a description of the Life
 * section. A student asking what they have due and receiving a page blurb reads
 * that as a dodge, and it is — the honest answer is that Dax cannot see their
 * data while it is in training, plus the page where the data actually is.
 *
 * Ordered most-specific first: "my resume" must beat the bare "my notes on X".
 */
const PERSONAL_DATA = [
  { test: /\bmy\s+(resume|cv)\b|\bresume\s+(review|feedback|score)\b/, thing: 'your resume', route: '/career/resume' },
  { test: /\bmy\s+(tasks?|deadlines?|to\s?dos?|assignments?|homework)\b|\bwhat.{0,12}\b(due|pending|overdue)\b|\bwhen\s+is\s+my\s+next\b/, thing: 'your tasks and deadlines', route: '/me/planner' },
  { test: /\bmy\s+(notes?)\b|\bsummaris[ez]\s+(my|this|the)\b/, thing: 'your notes', route: '/study/notes' },
  { test: /\bmy\s+(schedule|timetable|calendar)\b/, thing: 'your schedule', route: '/me/calendar' },
  { test: /\bmy\s+(journal|diary)\b/, thing: 'your journal', route: '/me/journal' },
  { test: /\bmy\s+(expenses?|budget|spending|money)\b/, thing: 'your expenses', route: '/finance/tracker' },
  { test: /\bmy\s+(plan|tier|subscription|billing)\b|\b(what|which)\s+plan\s+am\s+i\b|\bam\s+i\s+(on\s+)?(pro|free|subscribed)\b/, thing: 'which plan you are on', route: '/subscribe' },
  { test: /\bmy\s+(streak|progress|readiness|score|stats)\b|\bhow\s+am\s+i\s+doing\b/, thing: 'your progress', route: '/dashboard' },
  // Not 'account' — "delete my account" and "log in to my account" are for the
  // account intent, which answers them properly instead of pointing at Settings.
  { test: /\bmy\s+(profile|settings|details)\b/, thing: 'your account details', route: '/me/settings' },
];

/**
 * @returns {{thing: string, route: string}|null}
 */
export function findPersonalData(query) {
  const hit = PERSONAL_DATA.find((p) => p.test.test(query));
  return hit ? { thing: hit.thing, route: hit.route } : null;
}

/** Every topic a student can name, sections and their sub-pages alike. */
function allTopics() {
  const topics = [];
  for (const section of SECTIONS) {
    topics.push({ kind: 'section', section, aliases: [section.label.toLowerCase(), ...section.aliases] });
    for (const sub of section.subs) {
      topics.push({ kind: 'sub', section, sub, aliases: [sub.label.toLowerCase(), ...(sub.aliases || [])] });
    }
  }
  for (const page of EXTRA_PAGES) {
    topics.push({ kind: 'page', page, aliases: [page.label.toLowerCase(), ...page.aliases] });
  }
  return topics;
}

const TOPICS = allTopics();

/**
 * Every spelling of an alias worth matching: the alias itself, its plural, and
 * — when it is already plural — its singular.
 *
 * The singular variant is what makes "how do I add a task" find the Planner:
 * the alias is "tasks", and an optional trailing "s" on the pattern only ever
 * added a letter, it could never remove one. Variants that are nonsense
 * ("studie" from "studies") are harmless, since they simply never match.
 */
function variantsOf(alias) {
  const variants = [alias, `${alias}s`];
  if (alias.endsWith('s') && !alias.endsWith('ss') && !alias.endsWith('es')) {
    variants.push(alias.slice(0, -1));
  }
  return variants;
}

function mentions(query, alias) {
  // Word-boundary match so "art" never matches inside "start". The query is
  // already normalised (lowercased, punctuation stripped) by the caller.
  return variantsOf(alias).some((v) =>
    new RegExp(`(^|\\s)${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`).test(query)
  );
}

/**
 * The topic a message is about, or null.
 *
 * Longest alias wins, so "star stories" beats "stories" and "career hub" beats
 * "career". A section outranks its own sub-page on an equal-length tie, since
 * the broader answer names the sub-pages anyway and is the safer miss.
 */
export function findTopic(query) {
  let best = null;
  let bestLength = 0;
  for (const topic of TOPICS) {
    for (const alias of topic.aliases) {
      if (alias.length <= bestLength) continue;
      if (!mentions(query, alias)) continue;
      best = topic;
      bestLength = alias.length;
    }
  }
  return best;
}
