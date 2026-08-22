// Dax — maintenance mode.
//
// While Dax is being retrained, the chat page stays fully open (students can
// browse, start threads, and keep their history) but no request ever leaves
// the browser. Every reply is composed here from a fixed set of intents, so
// there is no model call, no quota burn, and no way for a half-trained answer
// to reach a student.
//
// Voice rules from DAX_NAMING.md still apply: first person, never third
// person, never "as an AI". The creator answer is the same fact the real
// system prompt carries (server/ai/dax.js) — kept in sync by hand, since the
// browser has no access to the server prompt.

// Explicit .js extensions, unlike most imports in this codebase: they let plain
// `node` import this module directly, which is what scripts/dax-ask.mjs uses to
// exercise these replies without a browser or a login. Vite resolves them the
// same either way.
import { MAKER_ORIGIN_ANSWER } from '../utils/maker.js';
import {
  SECTIONS, PLANS, findTopic, recommendPlan, findPersonalData,
  CONTACT_EMAIL, ACCOUNT_HELP, ADMIN_NOTE,
} from './appKnowledge.js';

// The one switch. Flip to false to bring the real Dax back everywhere: the
// /dax page, the workspace panel, and the dashboard's Ask Dax box all read
// this flag, and each falls back to its normal API-backed path when it's off.
export const DAX_MAINTENANCE = true;

export const DAX_MAINTENANCE_BANNER =
  'Dax is under maintenance and training — replies are limited to a few set answers for now.';

// The prompts that have a real answer right now. Surfaces offer these as
// chips instead of their usual suggestions, so nobody is walked into the
// "I can't answer that yet" reply.
// Kept short and answerable. The app-knowledge answers below cover far more
// than this — any section or sub-page by name, and the plans — but a chip row
// is a sample, not an index, so these are the four openers plus the two
// questions students actually arrive with (where things are, what to pay).
export const DAX_MAINTENANCE_PROMPTS = [
  'Hi',
  'Who are you?',
  'Who made you?',
  'What can you do?',
  'What sections does DATAD have?',
  'Explain the Career section',
  'Which plan should I choose?',
];

// Appended to every reply so the student is never left guessing why Dax sounds
// smaller than usual.
// Was "a handful of set questions", which stopped being true once the app
// knowledge landed — Dax now answers about any section, page or plan. The note
// still has to set the limit honestly, so it names what IS covered instead of
// understating it and making the rest look broken.
const STATUS_NOTE =
  "I'm still under maintenance and training, so I'm working from set answers — I can walk you through anything in DATAD and its plans, but I'm not thinking freely yet. My full self is coming back soon.";

const GREETING =
  "Hi — I'm Dax, your personal assistant.";

// From utils/maker.js, so the maintenance answer and the live model's answer
// tell the same story. The earlier copy here ended "He is who I answer to" —
// wrong on two counts: Dax works with the student, not for a boss, and a
// chain-of-command line reads badly beside a handle like "Digital Don".
const CREATOR = MAKER_ORIGIN_ANSWER;

const IDENTITY =
  "I'm Dax — the assistant built into DATAD. One assistant, not a pile of tools: study plans, career questions, resumes, notes, whatever you bring me, it's the same me every time.";

const CAPABILITIES = [
  'Once training finishes, here is what I do:',
  '',
  '- Plan your studies and tell you what to focus on today',
  '- Read your resume and say what actually needs fixing',
  '- Work through career questions, interviews, and applications with you',
  '- Summarise your notes, documents, and research',
  '- Remember your context so you never start from scratch',
].join('\n');

const STATUS =
  "I'm in maintenance and training at the moment. The page, your chats, and your history all stay available — I'm just not answering freely yet. No date to promise you, but it won't be long.";

// ── App knowledge ───────────────────────────────────────────────────────────
//
// These answers are facts about DATAD, not generated text, so they are exactly
// as good under maintenance as they will be afterwards — which is why they are
// worth answering now rather than waiting for the model to come back. Content
// lives in ./appKnowledge; the wording of the sentence around it lives here.

function sectionAnswer(section) {
  const lines = [`**${section.label}** — ${section.blurb}`];
  if (section.subs.length) {
    lines.push('', "What's inside:");
    for (const sub of section.subs) lines.push(`- **${sub.label}** — ${sub.blurb}`);
  }
  lines.push('', `You'll find it at \`${section.route}\`.`);
  return lines.join('\n');
}

function subAnswer(section, sub) {
  return [
    `**${sub.label}** — ${sub.blurb}`,
    '',
    `It sits inside **${section.label}**, at \`${sub.route}\`.`,
  ].join('\n');
}

function pageAnswer(page) {
  return `**${page.label}** — ${page.blurb}\n\nIt's at \`${page.route}\`.`;
}

function topicAnswer(topic) {
  if (topic.kind === 'section') return sectionAnswer(topic.section);
  if (topic.kind === 'sub') return subAnswer(topic.section, topic.sub);
  return pageAnswer(topic.page);
}

const OVERVIEW = [
  'DATAD is built as nine sections, and everything lives in one of them:',
  '',
  ...SECTIONS.map((s) => `- **${s.label}** — ${s.blurb.split(/(?<=\.)\s/)[0]}`),
  '',
  'Ask me about any one of them by name and I\'ll go through what\'s inside it.',
].join('\n');

const PLAN_COMPARISON = [
  'Four bands, and each one keeps everything below it:',
  '',
  ...PLANS.map((p) => `- ${p.line}`),
  '',
  'Tell me what you actually need it for and I\'ll tell you which one to buy. Plans are at `/subscribe`.',
].join('\n');

// Neither gateway is asserted as live: whether card/netbanking checkout is
// available depends on server config (razorpay.isConfigured()), which the
// browser cannot see from here. UPI is true on both paths.
const PAYMENT = [
  'You pay from the Plans page at `/subscribe`.',
  '',
  '- UPI works either way — GPay, Paytm, any UPI app. Cards and netbanking show up when card checkout is switched on.',
  '- Pro is a subscription (monthly or yearly). The Placement Pass is a one-time ₹999 for 4 months — nothing renews, nothing to cancel.',
  '- Paid through checkout, access is immediate. Paid by direct UPI transfer, it is verified and activated within 24 hours.',
  '',
  "If a payment went through and your plan didn't change within a day, that's one for `/support` — I can't look up your billing.",
].join('\n');

function planAdviceAnswer(query) {
  const match = recommendPlan(query);
  if (!match) return PLAN_COMPARISON;
  return [
    `Go with the **${match.plan.label}** — ${match.because}.`,
    '',
    match.plan.line,
    '',
    `Best for: ${match.plan.best}`,
    '',
    'If that is not quite your situation, tell me what you need it for and I\'ll re-check it against the other three. Plans are at `/subscribe`.',
  ].join('\n');
}

/**
 * The honest answer to "what are my tasks".
 *
 * Names the limit first, then the exact place the data lives. Never implies the
 * data was checked — while maintenance is on, nothing here can see a student's
 * account at all.
 */
function personalDataAnswer({ thing, route }) {
  return [
    `I can't see ${thing} while I'm in training — I'm answering from a fixed set right now, with no access to your account.`,
    '',
    `It's on \`${route}\`, and that page is fully working. Once I'm back I'll be able to read it and talk it through with you.`,
  ].join('\n');
}

const CONTACT = [
  `The person to reach is the maker, at ${CONTACT_EMAIL} — that's the address in the footer, and it's where anything about your account, a payment that didn't activate, or a bug should go.`,
  '',
  "I can't see accounts or billing myself, and `/support` isn't a help desk — it's the page explaining where the money goes if you want to back DATAD.",
].join('\n');

// Does this message name a plan rather than just brush against pricing words?
const PLAN_NAME_RE = /\b(free|trial|pro|placement\s+pass|placement\s+plan)\b/;

function namedPlanAnswer(query) {
  if (!PLAN_NAME_RE.test(query)) return null;
  const id = /\bplacement\b/.test(query) ? 'placement'
    : /\bpro\b/.test(query) ? 'pro'
      : /\btrial\b/.test(query) ? 'trial'
        : 'free';
  const plan = PLANS.find((p) => p.id === id);
  return `${plan.line}\n\nBest for: ${plan.best}`;
}

// Order matters: the first pattern that matches wins, so put the specific
// intents (creator, capabilities) above the loose ones (greeting).
//
// An intent may carry `test` (a regex) or `resolve(query)` — the latter for
// answers that depend on WHICH section or plan was named, where one regex per
// possible answer would be unmaintainable. `resolve` returning null means "not
// this intent", and matching continues down the list.
const INTENTS = [
  {
    id: 'creator',
    test: /\b(who|whom)\b.*\b(made|built|created|developed|designed|trained|owns?|founded|boss|owner|founder|creator|father|behind)\b|\b(your|ur)\s+(boss|owner|founder|creator|maker|father|company)\b|\bwho\s+do\s+you\s+work\s+for\b/,
    reply: () => `${CREATOR}\n\n${STATUS_NOTE}`,
  },
  {
    id: 'capabilities',
    test: /\bwhat\s+(can|do)\s+you\s+(do|help)\b|\b(how\s+)?can\s+(you|u)\s+help\b|\b(your|ur)\s+(features?|abilities|capabilities|skills)\b|\bwhat\s+are\s+you\s+for\b/,
    reply: () => `${CAPABILITIES}\n\n${STATUS_NOTE}`,
  },
  {
    id: 'status',
    test: /\b(maintenance|maintainence|under\s+training|offline|broken|not\s+working|not\s+replying|not\s+answering)\b|\bwhy\s+(are|aren'?t|is|isn'?t|can'?t|cant)\s+(you|u|dax)\b|\bare\s+you\s+(working|ok|okay|down|alive|online|available|free|back|ready)\b|\bwhen\s+(will|are)\s+you\b/,
    reply: () => STATUS,
  },
  {
    id: 'identity',
    test: /\bwho\s+(are|r)\s+(you|u)\b|\bwhat\s+(are|r)\s+(you|u)\b|\b(your|ur)\s+name\b|\bwhat\s+is\s+dax\b|\bintroduce\s+your\s?self\b|\btell\s+me\s+about\s+your\s?self\b/,
    reply: () => `${IDENTITY}\n\n${STATUS_NOTE}`,
  },
  {
    id: 'wellbeing',
    test: /\bhow\s+(are|r)\s+(you|u)\b|\bhow'?s\s+it\s+going\b|\bhow\s+have\s+you\s+been\b/,
    reply: () => `I'm well, thanks for asking.\n\n${STATUS_NOTE}`,
  },
  {
    id: 'thanks',
    test: /\b(thanks|thank\s*you|thx|ty|nandri)\b/,
    reply: () => `Anytime.\n\n${STATUS_NOTE}`,
  },
  {
    id: 'farewell',
    test: /\b(bye|goodbye|see\s+you|see\s+ya|good\s?night|cya)\b/,
    reply: () => "See you soon — I'll be sharper when you're back.",
  },
  // ── App knowledge ─────────────────────────────────────────────────────────
  // Above the greeting so "hi, explain the career section" is treated as the
  // question it is; the greeting pattern is unanchored at the end and would
  // otherwise swallow it.
  //
  // Order within this group is load-bearing, and was wrong at first:
  //   account  before contact, so "verify my email" is answered rather than
  //            swept up by the word "email";
  //   contact  before personal-data, so "my payment didn't activate" reaches a
  //            human instead of being told where the Plans page is;
  //   personal-data before topic, so "what are my tasks" is answered honestly
  //            rather than with a description of the Life section — a page
  //            blurb in reply to "what do I have due" reads as a dodge.
  {
    id: 'account',
    // Built by hand rather than joined from the aliases: students write "reset
    // MY password", and a contiguous "reset password" never matched it.
    test: /\bpassword\b|\b(log|sign)\s?(in|out)\b|\bsign\s?up\b|\bverify\s+(my\s+)?email\b|\bdelete\s+my\s+account\b/,
    reply: () => ACCOUNT_HELP.blurb,
  },
  {
    id: 'contact',
    test: /\b(contact|reach\s+(you|someone|a\s+human)|report\s+a?\s?bug|complain|refund|not\s+activated|didn'?t\s+activate|help\s?desk|customer\s+(care|support))\b/,
    reply: () => CONTACT,
  },
  {
    id: 'personal-data',
    resolve: (query) => {
      const hit = findPersonalData(query);
      return hit ? personalDataAnswer(hit) : null;
    },
  },
  {
    id: 'admin',
    test: /\badmin\b|\badmin\s+(panel|console|dashboard)\b|\bstaff\s+only\b/,
    reply: () => ADMIN_NOTE,
  },
  {
    id: 'app-overview',
    test: /\b(what|which)\s+(sections?|parts?|areas?|modules?|tabs?|pages?)\b|\bsections?\s+(does|are|in)\b|\b(tour|overview|walk\s?through)\b|\b(tell|explain)\b.*\b(the\s+)?(app|portal|platform|datad|website|site)\b|\bwhat\s+is\s+datad\b|\bhow\s+is\s+(the\s+)?(app|portal|datad)\s+(organised|organized|structured|laid\s+out)\b/,
    reply: () => `${OVERVIEW}\n\n${STATUS_NOTE}`,
  },
  {
    id: 'payment',
    test: /\b(pay|paying|payment|payments|upi|gpay|paytm|card|netbanking|checkout|refund|invoice|activate|activation)\b/,
    reply: () => PAYMENT,
  },
  {
    id: 'plan-advice',
    // "worth it" only counts when a plan is named alongside it. Unqualified, it
    // is far more often "is the degree worth it" — a Finance/ROI question that
    // was being answered with a price list.
    test: /\b(which|what)\s+(plan|tier|pack|pass|subscription)\b|\b(recommend|suggest|should\s+i\s+(get|buy|choose|take|pick|upgrade))\b|\b(pro|plan|pass|subscription|upgrade|premium)\b[\w\s]{0,20}\bworth\s+(it|paying)\b|\bwhich\s+one\s+(should|do)\b/,
    reply: (query) => planAdviceAnswer(query),
  },
  {
    id: 'plan-detail',
    // Only fires when a plan is actually named alongside a pricing word, so
    // "free" in "are you free to talk" cannot trigger a sales pitch.
    resolve: (query) =>
      (/\b(plan|plans|pricing|price|cost|costs|plan\s+details|plans?\s+include|tier|subscription|upgrade|pass)\b/.test(query)
        ? namedPlanAnswer(query)
        : null),
  },
  {
    id: 'plans-list',
    test: /\b(plans?|pricing|price|prices|cost|costs|how\s+much|subscription|tiers?|upgrade|premium|paid)\b/,
    reply: () => PLAN_COMPARISON,
  },
  {
    id: 'topic',
    // The catch-all for "explain X", "what is X", "where do I do X" — anything
    // that names a section, a sub-page, or one of the standalone pages.
    resolve: (query) => {
      const topic = findTopic(query);
      return topic ? `${topicAnswer(topic)}\n\n${STATUS_NOTE}` : null;
    },
  },
  {
    id: 'greeting',
    test: /^(hi+|hey+|hello+|yo|hola|sup|namaste|vanakkam|good\s+(morning|afternoon|evening)|what'?s\s+up|wassup)\b/,
    reply: () => `${GREETING}\n\n${STATUS_NOTE}`,
  },
];

const FALLBACK = [
  "I can't answer that one yet — I'm under maintenance and training, so I'm working from set answers for now.",
  '',
  'What I can still do properly: explain any section or page in DATAD (**study**, **career**, **growth**, **community**, **life**, **finance**, **wellbeing**, and everything inside them), walk you through the plans, and tell you which one fits what you need. Try **explain the career section** or **which plan should I choose**.',
].join('\n');

const ATTACHMENT_REPLY =
  "I can see you've attached something, but I can't read files while I'm under maintenance and training. Bring it back once I'm fully trained and I'll go through it properly.";

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'?]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pick the canned reply for a message. Pure and synchronous — no network, no
 * model, no state.
 *
 * @param {string} text          what the student typed
 * @param {Array}  [attachments] files on the message, if any
 * @returns {string} markdown reply
 */
export function maintenanceReply(text, attachments = []) {
  const query = normalise(text);
  if (!query) return attachments.length ? ATTACHMENT_REPLY : FALLBACK;

  for (const intent of INTENTS) {
    // `resolve` intents decide for themselves whether they apply — returning
    // null falls through to the next intent rather than ending the search.
    if (intent.resolve) {
      const answer = intent.resolve(query);
      if (answer) return answer;
      continue;
    }
    if (intent.test.test(query)) return intent.reply(query);
  }
  return attachments.length ? ATTACHMENT_REPLY : FALLBACK;
}

/**
 * Same reply with the markup stripped.
 *
 * No app surface needs this any more: the workspace panel and the dashboard's
 * Ask Dax box — the two it was written for — both render markdown now, via
 * components/chat/ChatMarkdown.jsx. Stripping was always the workaround, not
 * the goal; formatting a reply and then deleting the formatting only ever made
 * sense while nothing could display it.
 *
 * Kept because scripts/dax-ask.mjs --plain uses it to read answers as plain
 * prose in a terminal, and because any future non-markdown surface (a plain
 * notification, an email) would want exactly this.
 */
export function maintenanceReplyPlain(text, attachments = []) {
  // Backticks as well as bold: the app-knowledge answers quote routes as code
  // spans, which would otherwise render as literal `/career` on these surfaces.
  return maintenanceReply(text, attachments).replace(/\*\*/g, '').replace(/`/g, '');
}
