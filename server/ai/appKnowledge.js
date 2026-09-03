/**
 * What Dax knows about DATAD itself, for the live chat prompt.
 *
 * Without this, the model has no idea what the product it lives inside looks
 * like. Asked "where do I track my expenses" it either refuses or — worse —
 * invents a plausible route like /expenses, and the student clicks into a 404.
 * The maintenance build already answers these questions correctly from
 * client/src/dax/appKnowledge.js; this is the same map, handed to the model so
 * the answers survive maintenance being switched off.
 *
 * DUPLICATION, DELIBERATELY: the client copy is an ES module the CommonJS
 * server cannot require, which is the same boundary client/src/utils/pricing.js
 * sits on. It is handled the same way — mirrored, with tests/appKnowledge.test.js
 * asserting every label and route matches. Change the client file and this one
 * together, or the test fails.
 *
 * Prices and chat quotas are NOT mirrored — they are derived from
 * subscription/pricing.js and CHAT_QUOTAS at require time, because on this side
 * of the boundary the authoritative modules are right here.
 */

const { PLAN_PRICING } = require('../subscription/pricing');
const { CHAT_QUOTAS } = require('../subscription/subscriptionService');

// Structure mirrors client/src/dax/appKnowledge.js SECTIONS. Blurbs here are
// written for the model rather than for the student — terser, and describing
// what the section is FOR, since the model writes its own sentences from them.
const APP_SECTIONS = [
  {
    label: 'Home', route: '/dashboard',
    blurb: 'the daily starting point — deadlines, streak, readiness, batch activity',
    subs: [],
  },
  {
    label: 'Dax', route: '/dax',
    blurb: 'me — the full chat workspace, with threads and history',
    subs: [],
  },
  {
    label: 'Study', route: '/study',
    blurb: 'everything academic',
    subs: [
      { label: 'Notes', route: '/study/notes' },
      { label: 'Work', route: '/study/work' },
      { label: 'Resources', route: '/study/resources' },
      { label: 'Subject', route: '/study/subject' },
      { label: 'Focus', route: '/study/focus' },
    ],
  },
  {
    label: 'Placement', route: '/placement',
    blurb: 'the placement core — the work that leads to an offer',
    subs: [
      { label: 'Companies', route: '/placement/companies' },
      { label: 'Opportunities', route: '/placement/opportunities' },
      { label: 'Resume', route: '/placement/resume' },
      { label: 'LinkedIn', route: '/placement/linkedin' },
      { label: 'Interview Qs', route: '/placement/questions' },
    ],
  },
  {
    label: 'Growth', route: '/growth',
    blurb: 'becoming a stronger candidate — skill gaps, direction, stories',
    subs: [
      { label: 'Roadmap', route: '/growth/roadmap' },
      { label: 'Pivot', route: '/growth/pivot' },
      { label: 'STAR Stories', route: '/growth/stories' },
    ],
  },
  {
    label: 'Community', route: '/community',
    blurb: 'the batch — posts, notices, people, events',
    subs: [
      { label: 'Feed', route: '/community/feed' },
      { label: 'Announcements', route: '/community/announcements' },
      { label: 'Events', route: '/community/events' },
      { label: 'People', route: '/community/directory' },
      { label: 'BatchVault', route: '/community/memories' },
      { label: 'Marketplace', route: '/community/marketplace' },
      { label: 'Skills', route: '/community/skills' },
    ],
  },
  {
    label: 'Life', route: '/me',
    blurb: 'personal organisation — private, never shared with the batch',
    subs: [
      { label: 'Journal', route: '/me/journal' },
      { label: 'Planner', route: '/me/planner' },
      { label: 'Calendar', route: '/me/calendar' },
      { label: 'Reflection', route: '/me/reflection' },
      { label: 'Settings', route: '/me/settings' },
      { label: 'Program', route: '/me/program' },
    ],
  },
  {
    label: 'Finance', route: '/finance',
    blurb: 'money — tracking, calculators, markets, the maths on the degree itself',
    subs: [
      { label: 'Tracker', route: '/finance/tracker' },
      { label: 'Calculator', route: '/finance/calculator' },
      { label: 'Stocks', route: '/finance/stocks' },
      { label: 'Learn', route: '/finance/learn' },
      { label: 'ROI', route: '/finance/roi' },
    ],
  },
  {
    label: 'Wellbeing', route: '/wellbeing',
    blurb: 'studying without burning out — technique, memory, routine, support',
    subs: [
      { label: 'Study Tips', route: '/wellbeing/study' },
      { label: 'Memory', route: '/wellbeing/memory' },
      { label: 'Routines', route: '/wellbeing/routines' },
      { label: 'Support', route: '/wellbeing/support' },
    ],
  },
];

const APP_PAGES = [
  { label: 'Briefing', route: '/briefing', blurb: 'daily business news and market movement' },
  { label: 'Search', route: '/search', blurb: 'search across notes, tasks, companies, people and pages' },
  { label: 'Plans', route: '/subscribe', blurb: 'plans and billing' },
  // NOT a help desk, whatever the name suggests — it is the backing/donation
  // page. Described here as "reaching a human", which is how the prompt came to
  // send billing problems to a page that cannot solve them.
  { label: 'Support', route: '/support', blurb: 'where the money goes and how to back DATAD — not a help desk' },
  // `info: true` — read-once pages nobody navigates to mid-conversation. They
  // are collapsed into a single line in the prompt: listing seven of them with
  // a blurb each cost ~250 tokens on EVERY turn to answer a question that comes
  // up rarely, and the label plus route is enough to answer it correctly.
  { label: 'About', route: '/about', info: true, blurb: 'what DATAD is and why it exists' },
  { label: 'Creator', route: '/creator', info: true, blurb: 'who built DATAD, and how to reach him' },
  { label: 'Brand', route: '/brand', info: true, blurb: 'the story of the DATAD mark' },
  { label: 'PSW', route: '/psw', info: true, blurb: 'Pitch. Sell. Win. — DATAD told as one page for an audience' },
  { label: 'Walkthrough', route: '/pitch', info: true, blurb: 'a timed, section-by-section walkthrough reel of the product' },
  { label: 'Developer', route: '/developer', info: true, blurb: 'API keys for programmatic access' },
  { label: 'Privacy', route: '/privacy', info: true, blurb: 'what is collected, and how to have it removed' },
  { label: 'Terms', route: '/terms', info: true, blurb: 'the terms of use' },
];

// Reaching a human. `/support` is not it.
const CONTACT_EMAIL = 'digitaldoncodes@gmail.com';

// What each band adds over the one below it. Feature names mirror
// subscription/featureRegistry.js's bands; the numbers are read from the
// authoritative modules above rather than written out here, so a price change
// reaches the prompt without anyone remembering to edit it.
const PLAN_BANDS = {
  free: 'notes, planner, journal, calendar, community, directory, finance tools, wellbeing, company browsing',
  trial: 'note summaries, resume review, planner suggestions, daily briefing, daily cases, flashcards and quizzes',
  pro: 'ATS resume scoring, interview question bank, company research, LinkedIn enhancer, semantic search, dashboard insights, finance assist, multiple workspaces, long-term memory',
  placement: 'mock interview simulator, readiness score, company comparisons, career advice, salary bands and hiring rounds, market intelligence, skill roadmap generator',
};

function planLines() {
  const pro = PLAN_PRICING.pro;
  const pass = PLAN_PRICING.placement;
  return [
    `- Free (₹0, ${CHAT_QUOTAS.free} messages/day): ${PLAN_BANDS.free}.`,
    `- Trial (₹0, 14 days, once per account, ${CHAT_QUOTAS.trial} messages/day): adds ${PLAN_BANDS.trial}.`,
    `- Pro (₹${pro.monthly}/month or ₹${pro.yearly}/year, ${CHAT_QUOTAS.pro} messages/day): adds ${PLAN_BANDS.pro}.`,
    `- Placement Pass (₹${pass.onetime} one-time for ${pass.durationMonths} months, ${CHAT_QUOTAS.placement} messages/day): adds ${PLAN_BANDS.placement}.`,
  ];
}

function sectionLine(section) {
  const inside = section.subs.length
    ? ` Inside: ${section.subs.map((s) => `${s.label} ${s.route}`).join(', ')}.`
    : '';
  return `- ${section.label} (${section.route}) — ${section.blurb}.${inside}`;
}

/**
 * The block appended to the chat system prompt.
 *
 * Around 800 tokens, and it rides on EVERY chat turn, on top of memory, the
 * student profile and any RAG context — so the map is one compressed line per
 * section rather than a paragraph each, and the rules are stated once. An
 * earlier, more discursive draft ran half again as long for no added accuracy.
 */
function formatAppKnowledge() {
  return [
    'DATAD, the app you live inside, has nine sections. This is the whole map — every route a student can be sent to:',
    ...APP_SECTIONS.map(sectionLine),
    '',
    'Also reachable:',
    ...APP_PAGES.filter((p) => !p.info).map((p) => `- ${p.label} (${p.route}) — ${p.blurb}.`),
    `- Read-once pages: ${APP_PAGES.filter((p) => p.info).map((p) => `${p.label} ${p.route}`).join(', ')}.`,
    '',
    'Plans, cheapest first. Each keeps everything below it:',
    ...planLines(),
    '',
    'The admin console at /admin is staff-only (student management, publishing, company and case databases, AI observability, subscriptions). A student cannot open it.',
    'Password reset and email verification run from /login, not from inside the app.',
    '',
    'Using this map:',
    '- Asked what a section is, what is in it, or where to do something: answer from the map and give the exact path. You can always answer this without a tool.',
    '- NEVER invent a page, route, feature or plan that is not listed here. If DATAD does not have it, say so plainly — a made-up path 404s the student and costs your credibility on everything else you said.',
    '- Quote prices only as written above; send anyone buying to /subscribe. Never promise a discount, a refund, or a date.',
    '- If they want something their plan lacks, name the plan that has it once, then help with what they CAN do today. You are their assistant, not a salesperson — never open with an upgrade.',
    `- You cannot see anyone's billing, payments or account settings. Anything of that kind — a payment that did not activate, a wrong email, a deletion request — goes to ${CONTACT_EMAIL}. Do NOT send them to /support for it: that page is for backing the project, not for getting help.`,
  ].join('\n');
}

module.exports = { APP_SECTIONS, APP_PAGES, PLAN_BANDS, formatAppKnowledge };
