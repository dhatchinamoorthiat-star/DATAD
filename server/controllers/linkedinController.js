const linkedinService = require('../services/linkedinService');
const LinkedInAnalysis = require('../models/LinkedInAnalysis');
const LinkedInProfile = require('../models/LinkedInProfile');
const { MAX_RAW } = require('../utils/linkedin/parse');
const logger = require('../utils/logger');

/**
 * LinkedIn Enhancer endpoints.
 *
 * Thin by design — every decision lives in services/linkedinService.js and
 * utils/linkedin/. What the controller owns is the HTTP contract: request
 * shape, size limits, and the fact that every query is scoped to
 * `req.user.userId` and never to an id from the request body.
 */

const JD_MAX = 20000;

/** Service-level input failures carry `status`; anything else is a real error. */
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message, code: err.code || null });
    }
    next(err);
  }
};

/** GET /api/linkedin — profile, target, latest analysis, and what to do next. */
exports.getState = handle(async (req, res) => {
  res.json(await linkedinService.getState(req.user.userId));
});

/**
 * PUT /api/linkedin/profile — import or replace the stored profile.
 *
 * Accepts pasted text, a manually entered profile, or a draft seeded from the
 * student's DATAD resume. There is no URL-fetch path and no credential field:
 * DATAD does not log into LinkedIn on anyone's behalf and does not scrape it,
 * so the only profile data that reaches this endpoint is data the student
 * chose to hand over.
 */
exports.saveProfile = handle(async (req, res) => {
  const { source, rawText, profile, hints, target } = req.body || {};

  if (typeof rawText === 'string' && rawText.length > MAX_RAW) {
    return res.status(413).json({ message: `That paste is larger than the ${Math.round(MAX_RAW / 1000)}k character limit. Paste the profile itself rather than the whole page.` });
  }

  const result = await linkedinService.importProfile(req.user.userId, { source, rawText, profile, hints, target });

  res.json({
    profile: result.profile.profile,
    source: result.profile.source,
    target: result.profile.target,
    suggestedTarget: result.target.role ? result.target : null,
    // The wizard's next step: a profile with no target cannot be analysed, and
    // saying so here saves a round trip that would only fail.
    needsTarget: !result.profile.target?.role,
  });
});

/**
 * POST /api/linkedin/profile/pdf — import LinkedIn's own PDF export.
 *
 * The response carries `unknownSections`, and that field is the point of this
 * endpoint being separate from the paste path. The export does not contain
 * Recommendations, Featured or Projects, and lists only three skills — so the
 * client tells the student what the file could not carry, and the scorer skips
 * those checks rather than marking them down for it.
 */
exports.uploadPdf = handle(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ message: 'Attach your LinkedIn PDF export.' });
  }

  // Sent as form fields alongside the file, so they arrive as strings.
  const hints = {
    name: req.body?.name,
    headline: req.body?.headline,
    location: req.body?.location,
  };

  const result = await linkedinService.importProfile(req.user.userId, {
    source: 'pdf',
    buffer: req.file.buffer,
    hints,
  });

  logger.info('LinkedIn PDF imported', {
    userId: String(req.user.userId),
    bytes: req.file.size,
    experienceEntries: result.profile.profile?.experience?.length ?? 0,
  });

  res.json({
    profile: result.profile.profile,
    source: result.profile.source,
    target: result.profile.target,
    unknownSections: result.profile.unknownSections,
    suggestedTarget: result.target.role ? result.target : null,
    needsTarget: !result.profile.target?.role,
  });
});

/** PUT /api/linkedin/target — set or confirm the career target. */
exports.setTarget = handle(async (req, res) => {
  res.json(await linkedinService.setTarget(req.user.userId, req.body || {}));
});

/**
 * POST /api/linkedin/analyze — score the profile and build the plan.
 *
 * Rate limited alongside the other model-backed routes: this runs a full
 * deterministic pass plus one LLM call, and is the most expensive endpoint in
 * the feature.
 */
exports.analyze = handle(async (req, res) => {
  const { jobDescription, jobLabel, target } = req.body || {};

  if (typeof jobDescription === 'string' && jobDescription.length > JD_MAX) {
    return res.status(413).json({ message: 'That job description is too long. Paste the requirements and responsibilities sections.' });
  }

  const analysis = await linkedinService.analyze(req.user.userId, { jobDescription, jobLabel, target });

  logger.info('LinkedIn profile analysed', {
    userId: String(req.user.userId),
    score: analysis.score,
    rulesVersion: analysis.rulesVersion,
    withJobDescription: Boolean(jobDescription),
    llmSkipped: analysis.meta?.llmSkipped ?? null,
  });

  res.json(analysis);
});

/**
 * POST /api/linkedin/job-match — match against one job description.
 *
 * Runs the same pipeline with a JD attached rather than a separate one, so the
 * score and the match always come from the same rules and the same profile
 * snapshot.
 */
exports.jobMatch = handle(async (req, res) => {
  const { jobDescription, jobLabel } = req.body || {};

  if (!String(jobDescription || '').trim()) {
    return res.status(400).json({ message: 'Paste the job description you want to match against.' });
  }
  if (jobDescription.length > JD_MAX) {
    return res.status(413).json({ message: 'That job description is too long. Paste the requirements and responsibilities sections.' });
  }

  const analysis = await linkedinService.analyze(req.user.userId, { jobDescription, jobLabel });
  res.json(analysis);
});

/** GET /api/linkedin/analyses — score history, newest first. */
exports.listAnalyses = handle(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 25);
  res.json(await linkedinService.listAnalyses(req.user.userId, limit));
});

/** GET /api/linkedin/analyses/:id — one stored analysis. */
exports.getAnalysis = handle(async (req, res) => {
  // Scoped by user in the query itself, so another user's id is a 404 rather
  // than a document this endpoint then has to remember to check.
  const analysis = await LinkedInAnalysis.findOne({ _id: req.params.id, user: req.user.userId }).lean();
  if (!analysis) return res.status(404).json({ message: 'Analysis not found' });
  res.json(analysis);
});

/**
 * DELETE /api/linkedin — remove the stored profile and every analysis.
 *
 * This is professional data the student handed over voluntarily, so removing
 * it has to be as easy as adding it, and it has to be complete: the profile
 * and its whole analysis history go together.
 */
exports.remove = handle(async (req, res) => {
  const [profile, analyses] = await Promise.all([
    LinkedInProfile.deleteOne({ user: req.user.userId }),
    LinkedInAnalysis.deleteMany({ user: req.user.userId }),
  ]);

  logger.info('LinkedIn data deleted', {
    userId: String(req.user.userId),
    profiles: profile.deletedCount,
    analyses: analyses.deletedCount,
  });

  res.json({ deleted: true, analyses: analyses.deletedCount });
});
