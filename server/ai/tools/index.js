/**
 * Dax tool layer — read-only slice.
 *
 * Until this existed the chat path had no way to reach the student's own data
 * mid-conversation: everything the model knew arrived as a fixed profile string
 * assembled before the request, so Dax could not answer "what did my note say
 * about WACC?" even though the embeddings to do it were already indexed.
 *
 * Every tool here only reads, and every executor is scoped by userId at the
 * query level, so a tool call cannot reach another student's data even if the
 * model is talked into asking for it. Writes are deliberately absent from this
 * slice — a write needs a confirmation surface in the UI, which does not exist
 * yet, and shipping writes without one would let a hallucinated tool call
 * mutate real student records.
 */

const { search } = require('../embeddings/semanticSearch');
const Task = require('../../models/Task');
const Note = require('../../models/Note');
const Resume = require('../../models/Resume');
const Company = require('../../models/Company');
const { TASK_TYPES } = require('./writes');

// Bounds every tool result, because tool output is fed straight back into the
// prompt — an unbounded result set would blow the context window of the 8B
// default model long before it produced a better answer.
const MAX_ITEMS = 5;
const MAX_SNIPPET = 600;

/**
 * Tolerant boolean coercion for model-supplied arguments. Providers hand back
 * whatever the model emitted, and small models are inconsistent about JSON
 * types — "false", "no", and 0 all mean false and must not read as true.
 */
function asBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['true', '1', 'yes'].includes(v.trim().toLowerCase());
  return false;
}

function snippet(text, len = MAX_SNIPPET) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > len ? `${clean.slice(0, len)}…` : clean;
}

/** OpenAI-compatible tool schemas, sent verbatim to the provider. */
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_my_notes',
      description:
        "Semantic search over the student's own study notes. Use whenever they refer to something they wrote down, studied, or saved — or ask what a note said. Do not use for general knowledge you already have.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to look for, in natural language.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_tasks',
      description:
        "List the student's pending tasks and deadlines, soonest first. Use when they ask what is due, what to work on, or to plan their time.",
      parameters: {
        type: 'object',
        properties: {
          onlyOverdue: {
            // Accepts boolean or string: some models (observed on Groq's
            // strict schema validation) send "true"/"false" as a string and
            // get the whole tool call rejected before it ever reaches our
            // asBool() coercion below. Widening the schema lets those calls
            // through; asBool() still normalizes the value either way.
            type: ['boolean', 'string'],
            description: 'Return only tasks already past their due date. true or false.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_resume',
      description:
        "Fetch the student's resume — skills, experience, education, projects. Use before giving resume, application, or interview advice so it is grounded in what they actually have.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'look_up_company',
      description:
        'Look up a recruiter in the placement database: sector, selection rounds, what they look for, salary range. Use when the student names a company.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Company name to look up.' },
        },
        required: ['name'],
      },
    },
  },
];

// ── Executors ───────────────────────────────────────────────────────────────
// Each returns a plain object that is JSON-stringified into a `tool` message.
// They never throw: a tool failure is reported to the model as data so it can
// tell the student it could not look something up, rather than collapsing the
// whole turn into a 500.

const EXECUTORS = {
  async search_my_notes({ query }, userId) {
    if (!query?.trim()) return { error: 'query is required' };
    const results = await search({ query, collections: ['notes'], k: MAX_ITEMS, userId });
    const notes = results.notes || [];
    if (!notes.length) return { found: 0, notes: [], hint: 'No matching notes. Say so rather than inventing content.' };
    return {
      found: notes.length,
      notes: notes.map((n) => ({ title: n.title, subject: n.subject, excerpt: snippet(n.content) })),
    };
  },

  async list_my_tasks({ onlyOverdue } = {}, userId) {
    const filter = {
      $or: [{ assignee: userId }, { createdBy: userId }],
      status: { $ne: 'done' },
    };
    // Small models routinely send booleans as the strings "false"/"true", and
    // the string "false" is truthy — taking it at face value silently flipped
    // this to overdue-only and hid every upcoming task. Observed live on
    // llama-3.1-8b-instruct, not hypothetical.
    if (asBool(onlyOverdue)) filter.dueDate = { $lt: new Date() };

    const tasks = await Task.find(filter)
      .sort({ dueDate: 1 })
      .limit(MAX_ITEMS)
      .select('title dueDate type priority status')
      .lean();

    if (!tasks.length) return { found: 0, tasks: [] };
    const now = Date.now();
    return {
      found: tasks.length,
      tasks: tasks.map((t) => ({
        title: t.title,
        due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : 'no due date',
        overdue: Boolean(t.dueDate && t.dueDate.getTime() < now),
        type: t.type,
        priority: t.priority,
      })),
    };
  },

  async get_my_resume(_args, userId) {
    const resume = await Resume.findOne({ user: userId })
      .select('summary skills experience education projects achievements')
      .lean();
    if (!resume) return { hasResume: false, hint: 'No resume on file — suggest building one.' };
    return {
      hasResume: true,
      summary: snippet(resume.summary, 300),
      skills: (resume.skills || []).slice(0, 15),
      experience: (resume.experience || []).slice(0, 5).map((e) => `${e.role} at ${e.organization} (${e.duration || 'n/a'})`),
      education: (resume.education || []).slice(0, 3).map((e) => `${e.degree} — ${e.institution}`),
      projects: (resume.projects || []).slice(0, 5).map((p) => p.title),
      achievements: (resume.achievements || []).slice(0, 5),
    };
  },

  async look_up_company({ name }) {
    if (!name?.trim()) return { error: 'name is required' };
    // Anchored, escaped regex: company names are user-supplied and go straight
    // into a query, so unescaped input could inject regex metacharacters.
    const safe = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const company = await Company.findOne({ name: new RegExp(safe, 'i') })
      .select('name sector overview whatTheyLookFor salaryRange roles rounds')
      .lean();
    if (!company) return { found: false, hint: `No entry for "${name}". Answer from general knowledge and say it is not in the placement database.` };
    return {
      found: true,
      name: company.name,
      sector: company.sector,
      overview: snippet(company.overview, 400),
      whatTheyLookFor: snippet(company.whatTheyLookFor, 300),
      salaryRange: company.salaryRange,
      roles: (company.roles || []).slice(0, 8),
      rounds: (company.rounds || []).slice(0, 8),
    };
  },
};

/**
 * Runs one tool call. Always resolves — see the note above on why failures are
 * returned as data rather than thrown.
 *
 * @param {{name: string, arguments: string}} call  raw call from the provider
 * @param {string} userId  scopes every query; never taken from model output
 */
async function executeTool(call, userId) {
  const executor = EXECUTORS[call.name];
  if (!executor) return { error: `Unknown tool: ${call.name}` };

  let args = {};
  try {
    args = call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    // Small models emit malformed JSON arguments fairly often; tell the model
    // what went wrong so it can retry, instead of failing the turn.
    return { error: 'Could not parse tool arguments as JSON. Retry with valid JSON.' };
  }

  try {
    return await executor(args, userId);
  } catch (err) {
    console.warn(`[tools] ${call.name} failed: ${err.message}`);
    return { error: `Tool "${call.name}" failed. Continue without it.` };
  }
}

// ── Write tools ─────────────────────────────────────────────────────────────
// These do not perform writes. Calling one records a ProposedAction and returns
// "awaiting confirmation"; the student must click Confirm before anything is
// mutated. See models/ProposedAction.js.

const WRITE_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description:
        'Propose adding a task to the student\'s planner. Requires confirmation before it is created, so propose freely when they describe something they need to do.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short task title.' },
          dueDate: { type: 'string', description: 'Calendar date as YYYY-MM-DD. Work it out from today\'s date; do not write "next Thursday".' },
          type: { type: 'string', enum: TASK_TYPES, description: 'Task category.' },
          description: { type: 'string', description: 'Optional detail.' },
        },
        required: ['title', 'dueDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_task',
      description: 'Propose moving an existing task to a new date. Requires confirmation.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the existing task, as shown by list_my_tasks.' },
          dueDate: { type: 'string', description: 'New date as YYYY-MM-DD.' },
        },
        required: ['title', 'dueDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Propose marking an existing task as done. Requires confirmation.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the existing task, as shown by list_my_tasks.' },
        },
        required: ['title'],
      },
    },
  },
];

const WRITE_TOOL_NAMES = new Set(WRITE_TOOL_DEFINITIONS.map((t) => t.function.name));

function isWriteTool(name) {
  return WRITE_TOOL_NAMES.has(name);
}

/**
 * Whether a model is trusted with write tools.
 *
 * Write proposals are only as useful as the arguments behind them: the 8B
 * default has been observed sending booleans as strings and duplicating calls,
 * and while the proposal layer stops that becoming a bad write, it still
 * produces a confusing card. Models below the reasoning bar get read-only
 * tools, so writes appear on capable models rather than degrading everywhere.
 */
const MIN_WRITE_REASONING = Number(process.env.DAX_WRITE_TOOLS_MIN_REASONING || 78);

function supportsWriteTools(modelName) {
  if (!modelName) return false;
  try {
    const { getModel } = require('../runtime-v2/modelRegistry');
    const meta = getModel(modelName);
    if (!meta) return false;
    return meta.supportsToolCalling !== false && (meta.reasoningScore || 0) >= MIN_WRITE_REASONING;
  } catch {
    return false;
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  WRITE_TOOL_DEFINITIONS,
  executeTool,
  isWriteTool,
  supportsWriteTools,
  MIN_WRITE_REASONING,
  EXECUTORS,
};
