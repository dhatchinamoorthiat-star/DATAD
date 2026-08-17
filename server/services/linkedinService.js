/**
 * LinkedIn Enhancer — orchestration.
 *
 * Follows the same shape as services/roadmapService.js, which is the house
 * pattern for AI features here:
 *
 *   1. Collect structured context from what DATAD already knows.
 *   2. Do all the measurable work in plain JavaScript.
 *   3. Send the LLM only the part a rule cannot do — rewriting, positioning,
 *      differentiation — with the computed findings handed in as givens.
 *   4. Validate what comes back against a schema before it is trusted.
 *   5. Persist a versioned analysis.
 *
 * Step 2 before step 3 is the whole design. A model asked "score this profile"
 * will always return a number, and that number will move between runs, between
 * providers, and between prompt edits. The score here is computed by
 * utils/linkedin/score.js and is reproducible for a given profile plus rules
 * version — the model never sees a scoring question.
 */

const LinkedInProfile = require('../models/LinkedInProfile');
const LinkedInAnalysis = require('../models/LinkedInAnalysis');
const StudentIdentity = require('../models/StudentIdentity');
const Resume = require('../models/Resume');
const careerCollector = require('../ai/intelligence-layer/collectors/careerCollector');
const { run } = require('../ai/runner');
const PROMPTS = require('../ai/prompts');
const logger = require('../utils/logger');

const { RULES_VERSION, ANALYSIS_VERSION, roleProfile, DIMENSIONS } = require('../utils/linkedin/knowledge');
const { parseProfileText, normalizeProfile, neutralise } = require('../utils/linkedin/parse');
const { parseProfilePdf } = require('../utils/linkedin/pdf');
const { analyzeKeywords } = require('../utils/linkedin/keywords');
const { scoreProfile } = require('../utils/linkedin/score');
const { detectRedFlags } = require('../utils/linkedin/redFlags');
const { analyzeSkills, matchJobDescription, recommendationStrategy } = require('../utils/linkedin/match');
const { buildRecommendations, buildActionPlan, buildUpgradePlan } = require('../utils/linkedin/actionPlan');
const { isQuantified } = require('../utils/linkedin/signals');

const crypto = require('crypto');

// ── DATAD context ──────────────────────────────────────────────────────────

/**
 * What DATAD already knows about this student.
 *
 * This is the reason the feature belongs inside DATAD rather than being a
 * standalone tool: the resume already holds the projects, internships and
 * quantified achievements the LinkedIn profile is missing, so a recommendation
 * can point at the student's own material instead of asking them to invent
 * something. Every collector fails soft — a missing resume degrades the
 * analysis, it does not break it.
 */
async function collectDatadContext(userId) {
  const [identity, resume, career] = await Promise.all([
    StudentIdentity.findOne({ user: userId }).lean().catch(() => null),
    Resume.findOne({ user: userId }).lean().catch(() => null),
    careerCollector.collect(userId).catch(() => null),
  ]);

  return {
    identity,
    resume,
    career,
    sources: { identity: !!identity, resume: !!resume, career: !!career, jobDescription: false },
  };
}

/** The context block handed to the LLM, in the compact form prompts here use. */
function formatDatadContext({ identity, resume, career }) {
  if (!identity && !resume) return null;

  const lines = [];
  if (identity) {
    if (identity.course || identity.college) lines.push(`- Studying: ${[identity.course, identity.specialization, identity.college].filter(Boolean).join(', ')}`);
    if (identity.graduationYear) lines.push(`- Graduates: ${identity.graduationYear}`);
    if (identity.dreamRole) lines.push(`- Stated dream role: ${identity.dreamRole}`);
    if (identity.targetRoles?.length) lines.push(`- Target roles: ${identity.targetRoles.join(', ')}`);
    if (identity.preferredIndustries?.length) lines.push(`- Preferred industries: ${identity.preferredIndustries.join(', ')}`);
    if (identity.skills?.length) lines.push(`- Skills on file: ${identity.skills.slice(0, 20).join(', ')}`);
  }
  if (resume) {
    // Resume experience and projects are the richest source of real, already-
    // written evidence — this is what lets a rewrite cite something true.
    const exp = (resume.experience || []).filter((e) => e.description).slice(0, 4);
    if (exp.length) {
      lines.push('- Experience on their DATAD resume (use these facts, do not invent others):');
      exp.forEach((e) => lines.push(`  • ${e.role} at ${e.organization} (${e.duration || 'no dates'}): ${String(e.description).slice(0, 400)}`));
    }
    const projects = (resume.projects || []).filter((p) => p.description).slice(0, 4);
    if (projects.length) {
      lines.push('- Projects on their DATAD resume:');
      projects.forEach((p) => lines.push(`  • ${p.title}${p.technologies ? ` (${p.technologies})` : ''}: ${String(p.description).slice(0, 300)}`));
    }
    const achievements = (resume.achievements || []).slice(0, 5).map((a) => a.title).filter(Boolean);
    if (achievements.length) lines.push(`- Achievements: ${achievements.join('; ')}`);
  }
  if (career?.offerCount || career?.applications) {
    lines.push(`- Placement activity: ${career.applications} applications, ${career.interviewCount} interviews, ${career.offerCount} offers`);
  }

  return lines.length ? lines.join('\n') : null;
}

// ── Career intent ──────────────────────────────────────────────────────────

/**
 * Career Intent Engine.
 *
 * The analysis is meaningless without a target — "how strong is this profile"
 * is only answerable as "how strong is this profile *for what*". So a target is
 * resolved before anything is scored, in this order:
 *
 *   1. What the student explicitly set on this feature.
 *   2. Their DATAD profile (dreamRole, then targetRoles, then careerInterests).
 *   3. Nothing — in which case we say so and ask, rather than guessing.
 *
 * A target from source 2 is marked `inferred`. The UI shows it back for
 * confirmation and recommendations derived from it carry lower confidence,
 * because inferring intent and then presenting the result as certain is how a
 * career tool ends up confidently optimising for the wrong job.
 */
function resolveTarget(stored, identity, requested = {}) {
  const explicit = clean(requested.role) || clean(stored?.target?.role);
  if (explicit) {
    return {
      role: explicit,
      secondaryRole: clean(requested.secondaryRole) ?? stored?.target?.secondaryRole ?? '',
      industry: clean(requested.industry) ?? stored?.target?.industry ?? clean(identity?.preferredIndustries?.[0]) ?? '',
      seniority: requested.seniority || stored?.target?.seniority || defaultSeniority(identity),
      location: clean(requested.location) ?? stored?.target?.location ?? '',
      companyType: clean(requested.companyType) ?? stored?.target?.companyType ?? '',
      employmentType: requested.employmentType || stored?.target?.employmentType || '',
      objective: clean(requested.objective) ?? stored?.target?.objective ?? '',
      inferred: requested.role ? false : (stored?.target?.inferred ?? false),
      confident: true,
    };
  }

  const inferred = clean(identity?.dreamRole)
    || clean(identity?.targetRoles?.[0])
    || clean(identity?.careerInterests?.[0]);

  if (!inferred) {
    return { role: '', confident: false, inferred: false, needsInput: true };
  }

  return {
    role: inferred,
    secondaryRole: clean(identity?.targetRoles?.[1]) || '',
    industry: clean(identity?.preferredIndustries?.[0]) || '',
    seniority: defaultSeniority(identity),
    location: '',
    companyType: '',
    employmentType: '',
    objective: '',
    inferred: true,
    confident: false,
  };
}

/**
 * A student who has not graduated is targeting internships or entry-level
 * roles. This is a default, not a determination — the student can override it,
 * and `studentType: 'experienced'` already says otherwise.
 */
function defaultSeniority(identity) {
  if (!identity) return '';
  if (identity.studentType === 'experienced' && (identity.workExYears || 0) >= 3) return 'mid';
  const year = new Date().getFullYear();
  if (identity.graduationYear && identity.graduationYear > year) return 'intern';
  return 'entry';
}

const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : undefined);

// ── Import ─────────────────────────────────────────────────────────────────

/**
 * Import or replace the stored profile.
 *
 * @param {string} userId
 * @param {object} input { source, rawText, profile, hints, target }
 */
async function importProfile(userId, input = {}) {
  const SOURCES = ['manual', 'datad', 'pdf'];
  const source = SOURCES.includes(input.source) ? input.source : 'paste';

  let profile;
  let unknownSections = [];

  if (source === 'pdf') {
    if (!Buffer.isBuffer(input.buffer)) {
      throw badRequest('Attach your LinkedIn PDF export to import it.');
    }
    const parsed = await parseProfilePdf(input.buffer, input.hints || {});
    profile = parsed.profile;
    // What the export format cannot carry — recorded so the analysis says
    // "we could not see this" rather than "you have none of this".
    unknownSections = parsed.unknownSections;
  } else if (source === 'paste') {
    if (!String(input.rawText || '').trim()) {
      throw badRequest('Paste your LinkedIn profile text to import it.');
    }
    profile = parseProfileText(input.rawText, input.hints || {});
  } else if (source === 'datad') {
    profile = await profileFromDatad(userId);
  } else {
    profile = normalizeProfile(input.profile || {});
  }

  // A parse that finds nothing usually means the student pasted the wrong
  // thing (a URL, or their resume). Saying so is more useful than storing an
  // empty profile and scoring it at 4/100.
  const meaningful = profile.headline || profile.about || profile.experience.length || profile.education.length || profile.skills.length;
  if (!meaningful) {
    throw badRequest('Nothing recognisable was found in that text. Open your LinkedIn profile, select the page, copy it, and paste the whole thing here.');
  }

  const existing = await LinkedInProfile.findOne({ user: userId });
  const identity = await StudentIdentity.findOne({ user: userId }).lean().catch(() => null);
  const target = resolveTarget(existing, identity, input.target || {});

  const doc = await LinkedInProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        profile,
        source,
        unknownSections,
        contentHash: hashProfile(profile),
        ...(target.role ? { target: stripTransient(target) } : {}),
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return { profile: doc, target };
}

/**
 * Seed a profile from the student's DATAD resume.
 *
 * For a student who has not yet written a LinkedIn profile, this is a better
 * starting point than an empty form — their resume already holds the same
 * material in a different shape. It is explicitly a draft of what their
 * LinkedIn *could* say, which is why it is stored as source 'datad' and the UI
 * asks them to reconcile it against their real profile before analysing.
 */
async function profileFromDatad(userId) {
  const [resume, identity] = await Promise.all([
    Resume.findOne({ user: userId }).lean(),
    StudentIdentity.findOne({ user: userId }).lean(),
  ]);

  if (!resume && !identity) {
    throw badRequest('There is no DATAD resume or profile to import from yet.');
  }

  return normalizeProfile({
    name: resume?.personal?.fullName || identity?.name || '',
    headline: identity?.bio || '',
    location: resume?.personal?.location || '',
    about: resume?.summary || identity?.bio || '',
    experience: (resume?.experience || []).map((e) => ({
      role: e.role,
      organization: e.organization,
      duration: e.duration,
      description: e.description,
    })),
    education: (resume?.education || []).map((e) => ({
      institution: e.institution,
      degree: e.degree,
      year: e.year,
      detail: e.score ? `Score: ${e.score}` : '',
    })),
    skills: [...new Set([...(resume?.skills || []), ...(identity?.skills || [])])],
    certifications: (resume?.certifications || []).map((c) => ({ title: c.name, detail: [c.issuer, c.year].filter(Boolean).join(', ') })),
    projects: (resume?.projects || []).map((p) => ({ title: p.title, detail: p.description })),
    awards: (resume?.achievements || []).map((a) => ({ title: a.title, detail: a.description })),
    links: [resume?.personal?.linkedin, resume?.personal?.website, identity?.github, identity?.portfolio].filter(Boolean),
  });
}

// ── Analysis ───────────────────────────────────────────────────────────────

/**
 * Run a full analysis and persist it.
 *
 * @param {string} userId
 * @param {object} [options] { jobDescription, jobLabel, target, skipLlm }
 */
async function analyze(userId, options = {}) {
  const started = Date.now();

  const stored = await LinkedInProfile.findOne({ user: userId });
  if (!stored) throw badRequest('Import your LinkedIn profile before running an analysis.');

  const datad = await collectDatadContext(userId);
  const target = resolveTarget(stored, datad.identity, options.target || {});

  // Refusing here rather than scoring against a default is deliberate: a score
  // against the wrong role is worse than no score, because the student will
  // act on it.
  if (!target.role) {
    throw badRequest('Set the role you are targeting first — the analysis measures your profile against a specific role, not a generic ideal.', 'TARGET_REQUIRED');
  }

  const profile = stored.profile?.toObject ? stored.profile.toObject() : stored.profile;
  const jobDescription = options.jobDescription ? neutralise(String(options.jobDescription).slice(0, 20000)) : '';

  // ── Deterministic layer ────────────────────────────────────────────────
  // Sections the import could not see. A PDF export carries no Featured or
  // Recommendations section, so those checks are skipped rather than failed.
  const unknownSections = stored.unknownSections || [];

  const keywords = analyzeKeywords(profile, target, jobDescription);
  const scored = scoreProfile(profile, target, keywords, { unknownSections });
  const skills = analyzeSkills(profile, target);
  const { flags, authenticity } = detectRedFlags(profile, scored.signals, datad.resume);
  const strategy = recommendationStrategy(profile, scored.signals);

  const recCtx = {
    roleMatched: keywords.roleMatched,
    jobDescriptionProvided: Boolean(jobDescription),
    targetRole: target.role,
  };
  const recommendations = buildRecommendations(scored, recCtx);
  const actionPlan = buildActionPlan(recommendations);
  const upgradePlan = buildUpgradePlan(recommendations);

  const jobMatch = jobDescription
    ? { ...matchJobDescription(profile, jobDescription, target), label: String(options.jobLabel || 'Saved job').slice(0, 120) }
    : null;

  // ── LLM layer ──────────────────────────────────────────────────────────
  // Everything above is already a complete, useful analysis. The writing
  // review is an enhancement, so a provider failure degrades the result
  // rather than failing the request.
  let narrative = { unavailable: 'skipped' };
  let meta = { llmSkipped: true };

  if (!options.skipLlm) {
    const outcome = await runNarrative({ profile, target, scored, keywords, skills, authenticity, datad });
    narrative = outcome.narrative;
    meta = outcome.meta;
  }

  const analysis = await LinkedInAnalysis.create({
    user: userId,
    linkedInProfile: stored._id,
    rulesVersion: RULES_VERSION,
    analysisVersion: ANALYSIS_VERSION,
    profileHash: stored.contentHash,
    source: stored.source,
    unknownSections,
    target: {
      role: target.role,
      secondaryRole: target.secondaryRole,
      industry: target.industry,
      seniority: target.seniority,
      location: target.location,
      inferred: target.inferred,
      roleMatched: keywords.roleMatched,
    },
    score: scored.score,
    dimensions: Object.fromEntries(
      Object.entries(scored.dimensions).map(([k, v]) => [k, { score: v.score, max: v.max }])
    ),
    checks: scored.checks,
    keywords: {
      coverage: keywords.coverage,
      roleMatched: keywords.roleMatched,
      missingHigh: keywords.missingHigh,
      weakHigh: keywords.weakHigh,
      terms: keywords.terms,
      stuffing: keywords.stuffing,
    },
    skills: {
      matchScore: skills.matchScore,
      strong: skills.strong,
      partial: skills.partial,
      missing: skills.missing,
      provenButUnlisted: skills.provenButUnlisted,
      deprioritise: skills.deprioritise,
      placement: skills.placement,
    },
    redFlags: flags,
    authenticity,
    recommendations,
    actionPlan,
    upgradePlan,
    narrative,
    recommendationStrategy: strategy,
    jobMatch,
    contextSources: { ...datad.sources, jobDescription: Boolean(jobDescription) },
    meta: { ...meta, latencyMs: Date.now() - started },
  });

  stored.lastAnalyzedAt = new Date();
  if (target.role && !stored.target?.role) stored.target = stripTransient(target);
  await stored.save();

  return analysis;
}

/**
 * Run the writing review and validate what comes back.
 *
 * Returns `{ narrative: { unavailable } }` rather than throwing on failure:
 * the deterministic analysis stands on its own, and losing the rewrite is not
 * a reason to lose the score.
 */
async function runNarrative({ profile, target, scored, keywords, skills, authenticity, datad }) {
  const weakest = Object.entries(scored.dimensions)
    .sort((a, b) => (a[1].score / a[1].max) - (b[1].score / b[1].max))
    .slice(0, 2)
    .map(([, v]) => v.label);

  const findings = {
    score: scored.score,
    weakest,
    missingKeywords: keywords.missingHigh.slice(0, 8),
    unprovenSkills: skills.partial.map((p) => p.skill).slice(0, 6),
    weakBullets: scored.signals.experience.entries.map((e) => e.weakestBullet).filter(Boolean).slice(0, 4),
    authenticity: (authenticity.observations || []).map((o) => o.detail).slice(0, 4),
  };

  const prompt = PROMPTS.linkedinNarrative({
    profile,
    target,
    findings,
    datad: formatDatadContext(datad),
  });

  try {
    const { result, meta } = await run({
      system: prompt.system,
      user: prompt.user,
      json: true,
      maxTokens: 4096,
    });

    return {
      narrative: validateNarrative(result, profile),
      meta: {
        provider: meta.provider,
        model: meta.model,
        tokensUsed: meta.tokensUsed,
        llmSkipped: false,
      },
    };
  } catch (err) {
    logger.warn('LinkedIn narrative generation failed — returning the deterministic analysis only', {
      error: err.message,
    });
    return {
      narrative: { unavailable: 'The writing review could not be generated this time. Everything else on this page is unaffected.' },
      meta: { llmSkipped: true },
    };
  }
}

// ── Output validation ──────────────────────────────────────────────────────

const CONFIDENCES = new Set(['high', 'medium', 'low']);
const conf = (v) => (CONFIDENCES.has(v) ? v : 'medium');
const s = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, limit, max = 300) => (Array.isArray(v) ? v.map((x) => s(x, max)).filter(Boolean).slice(0, limit) : []);

/**
 * Coerce the model's output into the stored shape, and enforce the one rule
 * that matters most: no invented numbers.
 *
 * The prompt tells the model not to fabricate metrics. Prompts are not
 * guarantees. So any rewritten sentence containing a quantified claim is
 * checked against the source profile, and dropped if the number is not there —
 * a rewrite that reads well but attributes a 40% improvement the student never
 * made is the single worst thing this feature could produce. It would go into
 * a real profile, in front of a real recruiter, and the student could not
 * defend it in the interview.
 */
function validateNarrative(raw, profile) {
  if (!raw || typeof raw !== 'object') {
    return { unavailable: 'The writing review came back in an unreadable form and was discarded.' };
  }

  const sourceText = [
    profile.about,
    ...(profile.experience || []).map((e) => e.description),
    ...(profile.projects || []).map((p) => `${p.title} ${p.detail}`),
    ...(profile.awards || []).map((a) => `${a.title} ${a.detail}`),
  ].filter(Boolean).join('\n');

  const sourceNumbers = new Set((sourceText.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, '')));

  /** Strip a rewrite that asserts a figure absent from the student's own text. */
  const guard = (text, bucket) => {
    const value = s(text, 3000);
    if (!value || !isQuantified(value)) return value;

    const numbers = (value.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, ''));
    const invented = numbers.filter((n) => !sourceNumbers.has(n));
    if (!invented.length) return value;

    logger.warn('Dropped a LinkedIn rewrite containing figures absent from the profile', {
      section: bucket,
      invented: invented.slice(0, 5),
    });
    return '';
  };

  const headline = raw.headline || {};
  const about = raw.about || {};
  const differentiator = raw.differentiator || {};

  return {
    headline: {
      problems: list(headline.problems, 5),
      // A headline is short enough that a fabricated number in it is rare, but
      // "Data Analyst | 40% faster pipelines" is exactly the shape it takes.
      recommended: guard(headline.recommended, 'headline'),
      alternatives: list(headline.alternatives, 4).map((a) => guard(a, 'headline-alt')).filter(Boolean),
      keywordsAdded: list(headline.keywordsAdded, 10, 60),
      keywordsRemoved: list(headline.keywordsRemoved, 10, 60),
      explanation: s(headline.explanation, 800),
      confidence: conf(headline.confidence),
    },
    about: {
      problems: list(about.problems, 6),
      structure: list(about.structure, 6, 400),
      rewrite: guard(about.rewrite, 'about'),
      evidenceNeeded: list(about.evidenceNeeded, 6, 400),
      confidence: conf(about.confidence),
    },
    experience: (Array.isArray(raw.experience) ? raw.experience : []).slice(0, 5).map((e) => ({
      section: 'experience',
      target: s(e?.target, 200),
      before: s(e?.before, 1000),
      problem: s(e?.problem, 600),
      after: guard(e?.after, 'experience'),
      why: s(e?.why, 600),
      evidenceNeeded: list(e?.evidenceNeeded, 4, 400),
      confidence: conf(e?.confidence),
    })).filter((e) => e.before || e.after),
    differentiator: {
      statement: s(differentiator.statement, 300),
      reasoning: s(differentiator.reasoning, 800),
      buildOn: list(differentiator.buildOn, 4, 300),
      confidence: conf(differentiator.confidence),
    },
    featured: {
      suggestions: (Array.isArray(raw.featured?.suggestions) ? raw.featured.suggestions : [])
        .slice(0, 6)
        .map((f) => ({ item: s(f?.item, 200), why: s(f?.why, 400) }))
        .filter((f) => f.item),
    },
    unavailable: null,
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

async function getState(userId) {
  const [stored, latest, identity] = await Promise.all([
    LinkedInProfile.findOne({ user: userId }).lean(),
    LinkedInAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }).lean(),
    StudentIdentity.findOne({ user: userId }).lean().catch(() => null),
  ]);

  const suggestedTarget = resolveTarget(stored, identity, {});

  return {
    hasProfile: Boolean(stored),
    profile: stored?.profile || null,
    source: stored?.source || null,
    // Drives the "your PDF export could not include this — add it here" prompt.
    unknownSections: stored?.unknownSections || [],
    target: stored?.target || null,
    suggestedTarget: suggestedTarget.role ? suggestedTarget : null,
    lastAnalyzedAt: stored?.lastAnalyzedAt || null,
    // True when the profile has changed since the last run, so the UI can
    // offer a re-analysis rather than showing a score for text they edited.
    // Compared by hash rather than by timestamp: saving the profile unchanged
    // moves `updatedAt` but does not invalidate the score.
    stale: Boolean(stored && latest && stored.contentHash && stored.contentHash !== latest.profileHash),
    analysis: latest || null,
    rulesVersion: RULES_VERSION,
    analysisVersion: ANALYSIS_VERSION,
    dimensions: DIMENSIONS,
  };
}

async function listAnalyses(userId, limit = 10) {
  return LinkedInAnalysis.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 25))
    .select('score dimensions target rulesVersion createdAt jobMatch.overall jobMatch.label')
    .lean();
}

async function setTarget(userId, requested) {
  const [stored, identity] = await Promise.all([
    LinkedInProfile.findOne({ user: userId }),
    StudentIdentity.findOne({ user: userId }).lean().catch(() => null),
  ]);

  const target = resolveTarget(stored, identity, requested || {});
  if (!target.role) throw badRequest('A target role is required.');

  const doc = await LinkedInProfile.findOneAndUpdate(
    { user: userId },
    { $set: { target: stripTransient(target) } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return { target: doc.target, roleRecognised: Boolean(roleProfile(target.role).matched) };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** `confident` / `needsInput` describe this resolution, not the stored state. */
function stripTransient({ confident, needsInput, ...target }) {
  return target;
}

function hashProfile(profile) {
  return crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 32);
}

/** Carries an HTTP status so the controller does not have to match on message text. */
function badRequest(message, code) {
  const err = new Error(message);
  err.status = 400;
  if (code) err.code = code;
  return err;
}

module.exports = {
  importProfile,
  analyze,
  getState,
  listAnalyses,
  setTarget,
  resolveTarget,
  collectDatadContext,
  validateNarrative,
};
