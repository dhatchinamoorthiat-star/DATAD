const v1Prompts = require('../prompts');
const { withDaxIdentity } = require('../dax');

const PROMPT_REGISTRY = {};

function registerPrompt(promptId, definition) {
  PROMPT_REGISTRY[promptId] = {
    ...definition,
    promptId,
    registeredAt: new Date().toISOString(),
    versions: definition.versions || [{
      version: '1.0',
      system: definition.system || '',
      user: definition.user || '',
      createdAt: new Date().toISOString(),
      metadata: definition.metadata || {},
    }],
  };
}

function getPrompt(promptId, version) {
  const entry = PROMPT_REGISTRY[promptId];
  if (!entry) return null;

  if (version) {
    const v = entry.versions.find((v) => v.version === version);
    return v ? { ...v, promptId, currentVersion: version } : null;
  }

  const active = entry.versions.find((v) => v.version === entry.activeVersion) || entry.versions[entry.versions.length - 1];
  return {
    ...active,
    promptId,
    currentVersion: active.version,
    metadata: entry.metadata,
  };
}

function getActiveVersion(promptId) {
  const entry = PROMPT_REGISTRY[promptId];
  if (!entry) return null;
  return entry.activeVersion || entry.versions[entry.versions.length - 1]?.version || '1.0';
}

function getAllVersions(promptId) {
  const entry = PROMPT_REGISTRY[promptId];
  if (!entry) return [];
  return entry.versions.map((v) => ({
    version: v.version,
    createdAt: v.createdAt,
    tags: v.tags || [],
  }));
}

function listPrompts(tag) {
  const entries = Object.entries(PROMPT_REGISTRY);
  if (tag) {
    return entries
      .filter(([, e]) => (e.tags || []).includes(tag) || (e.metadata?.tags || []).includes(tag))
      .map(([id, e]) => ({ promptId: id, name: e.name, tags: e.tags || [], activeVersion: e.activeVersion }));
  }
  return entries.map(([id, e]) => ({ promptId: id, name: e.name, tags: e.tags || [], activeVersion: e.activeVersion }));
}

function rollbackPrompt(promptId, version) {
  const entry = PROMPT_REGISTRY[promptId];
  if (!entry) return false;
  const v = entry.versions.find((v) => v.version === version);
  if (!v) return false;
  entry.activeVersion = version;
  return true;
}

function addVersion(promptId, versionData) {
  const entry = PROMPT_REGISTRY[promptId];
  if (!entry) return false;
  entry.versions.push({
    version: versionData.version,
    system: versionData.system || entry.versions[entry.versions.length - 1]?.system || '',
    user: versionData.user || entry.versions[entry.versions.length - 1]?.user || '',
    createdAt: new Date().toISOString(),
    tags: versionData.tags || [],
    metadata: versionData.metadata || {},
  });
  entry.activeVersion = versionData.version;
  return true;
}

const PROMPT_TASK_MAP = {
  'summarise-note':       { promptId: 'summarise-note',       tags: ['summarize', 'notes'] },
  'news-summary':         { promptId: 'news-summary',         tags: ['summarize', 'news'] },
  'moderation':           { promptId: 'moderate-post',        tags: ['moderation', 'administration'] },
  'resume-tip':           { promptId: 'resume-tip',           tags: ['resume', 'tips'] },
  'daily-reflection':     { promptId: 'daily-reflection',     tags: ['reflection', 'daily'] },
  'daily-briefing':       { promptId: 'daily-briefing',       tags: ['briefing', 'daily'] },
  'daily-case':           { promptId: 'daily-case',           tags: ['case', 'education'] },
  'company-enrichment':   { promptId: 'company-enrich',       tags: ['company', 'research'] },
  'interview-questions':  { promptId: 'interview-questions',  tags: ['interview', 'career'] },
  'planner-suggest':      { promptId: 'planner-suggest',      tags: ['planner', 'productivity'] },
  'chat':                 { promptId: 'chat',                 tags: ['chat', 'general'] },
  'review-resume':        { promptId: 'review-resume',        tags: ['resume', 'review'] },
  'career-advice':        { promptId: 'career-advice',        tags: ['career', 'coaching'] },
  'case-framework':       { promptId: 'case-framework',       tags: ['case', 'framework'] },
  'interview-simulator':  { promptId: 'interview-simulator',  tags: ['interview', 'simulation'] },
  'compare-companies':    { promptId: 'compare-companies',    tags: ['compare', 'companies'] },
  'weekly-newsletter':    { promptId: 'weekly-newsletter',    tags: ['newsletter', 'content'] },
  'news-enhance':         { promptId: 'news-enhance',         tags: ['news', 'enhancement'] },
  'fact-verify':          { promptId: 'fact-verify',          tags: ['verification'] },
  'plan':                 { promptId: 'planner-suggest',      tags: ['planner'] },
  'knowledge-graph':      { promptId: 'knowledge-graph',      tags: ['knowledge', 'graph'] },
  'flashcard-generate':   { promptId: 'flashcard-generate',   tags: ['generate', 'flashcard'] },
  'quiz-generate':        { promptId: 'quiz-generate',        tags: ['generate', 'quiz'] },
  // These four previously pointed at another task's promptId (finance-assist
  // -> 'chat', dashboard-insights -> 'daily-briefing', etc.) — each now gets
  // its own registered entry below instead of borrowing generic content.
  'finance-assist':       { promptId: 'finance-assist',       tags: ['finance', 'chat'] },
  'dashboard-insights':   { promptId: 'dashboard-insights',   tags: ['insights', 'dashboard'] },
  'company-research':     { promptId: 'company-research',     tags: ['company', 'research'] },
  'resume-ats':           { promptId: 'resume-ats',           tags: ['resume', 'ats'] },
};

function getPromptForTask(taskName) {
  const mapping = PROMPT_TASK_MAP[taskName];
  if (!mapping) return null;
  return getPrompt(mapping.promptId);
}

const V1_PROMPT_TASK_MAP = {
  'summarise-note':       'summariseNote',
  'news-summary':         null,
  'moderate-post':        null,
  'resume-tip':           'resumeTip',
  'daily-reflection':     'dailyReflection',
  'daily-briefing':       'dailyBriefing',
  'daily-case':           'dailyCase',
  'company-enrich':       'companyEnrich',
  'interview-questions':  'interviewQuestions',
  'planner-suggest':      null,
  chat:                   null,
  'review-resume':        null,
  'career-advice':        null,
  'case-framework':       null,
  'interview-simulator':  null,
  'compare-companies':    null,
  'weekly-newsletter':    'weeklyNewsletter',
  'news-enhance':         'newsEnhance',
  'flashcard-generate':   'flashcardGenerate',
  'quiz-generate':        'quizGenerate',
  'finance-assist':       'financeAssist',
  'dashboard-insights':   'dashboardInsights',
  'company-research':     'companyResearch',
  'resume-ats':           'resumeAts',
};

function getPromptForIntent(intent, taskName) {
  if (taskName) {
    const fromTask = getPromptForTask(taskName);
    if (fromTask) return fromTask;
  }

  const intentPromptMap = {
    explain:      'chat',
    summarize:    'news-summary',
    teach:        'daily-case',
    coach:        'chat',
    review:       'review-resume',
    compare:      'compare-companies',
    research:     'company-enrich',
    generate:     'weekly-newsletter',
    reason:       'fact-verify',
    brainstorm:   'chat',
    career:       'career-advice',
    resume:       'resume-tip',
    interview:    'interview-questions',
    planner:      'planner-suggest',
    reflection:   'daily-reflection',
    motivation:   'chat',
    'knowledge-graph': 'knowledge-graph',
  };

  const fallbackId = intentPromptMap[intent];
  let prompt = null;
  if (fallbackId) prompt = getPrompt(fallbackId);

  if (!prompt) {
    prompt = _resolveV1Prompt(taskName || fallbackId, intent);
  }

  return prompt || getPrompt('chat') || { system: '', user: '', promptId: 'chat', currentVersion: '1.0' };
}

function _resolveV1Prompt(promptId, intent) {
  try {
    const v1Key = V1_PROMPT_TASK_MAP[promptId];
    if (!v1Key || !v1Prompts[v1Key]) return null;

    const promptFn = v1Prompts[v1Key];
    const v1 = promptFn({});
    return {
      system: v1.system,
      user: v1.user,
      promptId: `v1:${promptId}`,
      currentVersion: '1.0',
    };
  } catch {
    return null;
  }
}

function buildTypedPrompt(promptId, variables) {
  const prompt = getPrompt(promptId);
  if (!prompt) return null;

  let system = prompt.system;
  let user = prompt.user;

  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g');
      if (system) system = system.replace(placeholder, value || '');
      if (user) user = user.replace(placeholder, value || '');
    }
  }

  return { system, user, promptId, version: prompt.currentVersion };
}

// Migration Blueprint Phase 2 (P2-1): seed the registry with real content.
//
// registerPrompt() was defined but never called, so PROMPT_REGISTRY was
// always empty — every getPromptForTask() lookup returned null, and
// getPromptForIntent() fell through to _resolveV1Prompt(), which is null
// for roughly half the tasks (see V1_PROMPT_TASK_MAP above) and broken for
// 'summarise-note' specifically (maps to a v1Prompts key that doesn't
// exist). Net effect, confirmed by live trace: several of the most-used
// AIEnhancement actions ran with system:'' — no persona, no Dax identity.
//
// Fix is to seed for real, not patch the fallback further. Each entry below
// is the exact specialisation daxService.js's HANDLERS already use for the
// same task on the Dax-branded path — composed through withDaxIdentity()
// here too, so a request routed through this registry gets the same voice
// and the same identity as the Dax-branded equivalent, not a second,
// unbranded assistant. `user` is left empty deliberately: the runtime-v2
// caller (studentIntelligenceEngine.enhance()) already builds user content
// generically from `data` via buildUserPrompt() when a template is absent —
// that part of the design was already correct; only `system` was missing.
//
// Side effect worth knowing: getPromptForTask() now resolves every
// Dax-branded task listed below via the seeded entries above, so
// _resolveV1Prompt() (the fallback block right above this comment) is
// effectively dead code for those tasks — it only still runs for tasks
// with a null V1_PROMPT_TASK_MAP entry. Left in place rather than removed:
// harmless, and still the correct fallback for non-Dax-branded intents.
[
  ['summarise-note', 'You are helping with study work. Be concise, precise, and practically useful for a student preparing for placements and exams.'],
  ['review-resume', 'You are coaching on career direction, with the judgement of a senior placement counsellor. Be direct, specific, and actionable.'],
  ['case-framework', 'You are coaching a case interview. Write clear, structured frameworks.'],
  ['planner-suggest', 'You are planning the student’s week. Help prioritise tasks and study plans for campus placements.'],
  ['career-advice', 'You are advising on campus recruitment. Give personalised, specific advice grounded in the student profile and company data provided.'],
  ['interview-simulator', 'You are running a realistic mock interview as a senior interviewer at a top campus recruiter would. Be specific and demanding; tailor everything to the student profile provided.'],
  ['compare-companies', 'You are comparing campus recruiters. Be decisive and concrete — the student needs a verdict, not a survey.'],
  ['flashcard-generate', 'You are creating study flashcards. Be precise, factual, and well-structured.'],
  ['quiz-generate', 'You are creating practice quizzes. Questions should test genuine understanding.'],
  ['finance-assist', 'You are a personal finance coach for students. Give practical, India-relevant financial advice.'],
  ['dashboard-insights', 'You are analysing a student’s progress. Give honest, data-driven insights.'],
  ['company-research', 'You are researching companies for placement preparation. Be thorough and accurate.'],
  ['resume-ats', 'You are an ATS expert. Analyse resumes the way ATS software does.'],
  ['chat', 'You are in conversation with the student. Be concise, direct, and practically useful.'],
].forEach(([promptId, specialisation]) => {
  registerPrompt(promptId, { system: withDaxIdentity(specialisation), user: '', tags: (PROMPT_TASK_MAP[promptId]?.tags) || [] });
});

// Initialize registry by loading all v1 prompts
function init() {
  let count = 0;
  let errors = 0;

  Object.entries(V1_PROMPT_TASK_MAP).forEach(([kebabKey, camelKey]) => {
    if (!camelKey) return; // Skip entries with null mappings

    try {
      if (v1Prompts[camelKey]) {
        const promptFn = v1Prompts[camelKey];
        const v1Prompt = promptFn({});

        registerPrompt(kebabKey, {
          name: kebabKey,
          system: v1Prompt.system || '',
          user: v1Prompt.user || '',
          tags: (PROMPT_TASK_MAP[kebabKey]?.tags) || ['v1-imported'],
          metadata: { source: 'v1Prompts', originalKey: camelKey, importedAt: new Date().toISOString() },
        });
        count++;
      }
    } catch (err) {
      console.warn(`[promptRegistry] Failed to load prompt "${camelKey}" for task "${kebabKey}":`, err.message);
      errors++;
    }
  });

  console.log(`[promptRegistry.init()] Loaded ${count} v1 prompts (${errors} errors)`);
  return { count, errors };
}

module.exports = {
  registerPrompt,
  getPrompt,
  getActiveVersion,
  getAllVersions,
  listPrompts,
  rollbackPrompt,
  addVersion,
  PROMPT_REGISTRY,
  PROMPT_TASK_MAP,
  getPromptForTask,
  getPromptForIntent,
  buildTypedPrompt,
  init,
};
