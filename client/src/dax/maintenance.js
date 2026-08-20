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

// The one switch. Flip to false to bring the real Dax back everywhere: the
// /dax page, the workspace panel, and the dashboard's Ask Dax box all read
// this flag, and each falls back to its normal API-backed path when it's off.
export const DAX_MAINTENANCE = true;

export const DAX_MAINTENANCE_BANNER =
  'Dax is under maintenance and training — replies are limited to a few set answers for now.';

// The prompts that have a real answer right now. Surfaces offer these as
// chips instead of their usual suggestions, so nobody is walked into the
// "I can't answer that yet" reply.
export const DAX_MAINTENANCE_PROMPTS = [
  'Hi',
  'Who are you?',
  'Who made you?',
  'What can you do?',
];

// Appended to every reply so the student is never left guessing why Dax sounds
// smaller than usual.
const STATUS_NOTE =
  "Right now I'm under maintenance and training, so I can only answer a handful of set questions. My full self is coming back soon.";

const GREETING =
  "Hi — I'm Dax, your personal assistant.";

const CREATOR =
  'I was created by **Dhatchina Moorthi**, also known as **Digital Don** — an entrepreneur and technology builder from Tamil Nadu, India. He set out to build an AI companion rather than another chatbot: one that understands context, adapts to the person it works with, and helps them think, learn, create, and make better decisions. He is who I answer to.';

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

// Order matters: the first pattern that matches wins, so put the specific
// intents (creator, capabilities) above the loose ones (greeting).
const INTENTS = [
  {
    id: 'creator',
    test: /\b(who|whom)\b.*\b(made|built|created|developed|designed|trained|owns?|founded|boss|owner|founder|creator|father|behind)\b|\b(your|ur)\s+(boss|owner|founder|creator|maker|father|company)\b|\bwho\s+do\s+you\s+work\s+for\b/,
    reply: () => `${CREATOR}\n\n${STATUS_NOTE}`,
  },
  {
    id: 'capabilities',
    test: /\bwhat\s+(can|do)\s+you\s+(do|help)\b|\bhow\s+can\s+you\s+help\b|\b(your|ur)\s+(features?|abilities|capabilities|skills)\b|\bwhat\s+are\s+you\s+for\b/,
    reply: () => `${CAPABILITIES}\n\n${STATUS_NOTE}`,
  },
  {
    id: 'status',
    test: /\b(maintenance|maintainence|under\s+training|offline|broken|not\s+working|not\s+replying|not\s+answering)\b|\bwhy\s+(are|aren'?t|is|isn'?t|can'?t|cant)\s+(you|u|dax)\b|\bare\s+you\s+(working|ok|okay|down|alive|online|available)\b|\bwhen\s+(will|are)\s+you\b/,
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
  {
    id: 'greeting',
    test: /^(hi+|hey+|hello+|yo|hola|sup|namaste|vanakkam|good\s+(morning|afternoon|evening)|what'?s\s+up|wassup)\b/,
    reply: () => `${GREETING}\n\n${STATUS_NOTE}`,
  },
];

const FALLBACK =
  "I can't answer that one yet — I'm under maintenance and training, so I'm only handling a few set questions for now.\n\nTry me with **hi**, **who are you**, **who made you**, or **what can you do** in the meantime.";

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

  const intent = INTENTS.find((i) => i.test.test(query));
  if (intent) return intent.reply();
  return attachments.length ? ATTACHMENT_REPLY : FALLBACK;
}

/**
 * Same reply, for surfaces that render raw text rather than markdown (the
 * workspace panel, the dashboard's Ask Dax box) — otherwise the `**` around
 * the creator's name shows up literally.
 */
export function maintenanceReplyPlain(text, attachments = []) {
  return maintenanceReply(text, attachments).replace(/\*\*/g, '');
}
