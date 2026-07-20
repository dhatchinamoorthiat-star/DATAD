const NewsItem = require('../models/NewsItem');
const Company = require('../models/Company');
const ProgramRegistry = require('../models/ProgramRegistry');
const Post = require('../models/Post');
const Resource = require('../models/Resource');
const ProgramApproval = require('../models/ProgramApproval');
const User = require('../models/User');
const { sendProgramReadyEmail } = require('../config/mailer');
const logger = require('../utils/logger');

const CONFIG = require('../config/programs.json');

// Steps run in order; the approval email only fires if every one succeeds.
// Order matters: registerProgram must land first so the module/feature system
// recognises the slug before content starts pointing at it.
const STEPS = ['registry', 'news', 'companies', 'career', 'community', 'study'];

/**
 * Resolve the tagging rules for a program. Preset programs come from
 * programs.json; custom ones fall back to defaults plus keyword matching on
 * the label, which is the only signal we have for a program nobody has
 * curated yet.
 */
function resolveProgramConfig(programId, programLabel) {
  const preset = CONFIG.programs.find((p) => p.id === programId);
  if (preset) return { ...preset, isPreset: true };

  return {
    id: programId,
    label: programLabel,
    isPreset: false,
    newsCategories: CONFIG.defaults.newsCategories,
    companySectors: CONFIG.defaults.companySectors,
    careerPaths: [],
    // Words long enough to be meaningful — "of", "in", "the" would match everything.
    keywords: programLabel
      .split(/[\s\-/,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4),
  };
}

// ── Individual sync steps ───────────────────────────────────────────────────
// Each returns a count of rows it actually touched. Throwing fails the sync.

async function stepRegistry(cfg) {
  await ProgramRegistry.findByIdAndUpdate(
    cfg.id,
    {
      _id: cfg.id,
      label: cfg.label,
      description: cfg.description || `${cfg.label} program`,
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return 1;
}

async function stepNews(cfg) {
  // $addToSet keeps this idempotent — re-running a sync never double-tags.
  const byCategory = await NewsItem.updateMany(
    { category: { $in: cfg.newsCategories }, programs: { $ne: cfg.id } },
    { $addToSet: { programs: cfg.id } }
  );

  let tagged = byCategory.modifiedCount;

  // Custom programs get no curated categories, so also match the label's own
  // words against headlines. Without this a custom program syncs near-zero news.
  if (!cfg.isPreset && cfg.keywords?.length) {
    const re = new RegExp(cfg.keywords.join('|'), 'i');
    const byKeyword = await NewsItem.updateMany(
      { $or: [{ title: re }, { summary: re }], programs: { $ne: cfg.id } },
      { $addToSet: { programs: cfg.id } }
    );
    tagged += byKeyword.modifiedCount;
  }

  return tagged;
}

async function stepCompanies(cfg) {
  const res = await Company.updateMany(
    { sector: { $in: cfg.companySectors }, programs: { $ne: cfg.id } },
    { $addToSet: { programs: cfg.id } }
  );
  return res.modifiedCount;
}

async function stepCareer(cfg) {
  // Career paths have no model of their own — they live on the registry doc
  // so the program is the single source of truth for them.
  if (!cfg.careerPaths?.length) return 0;
  await ProgramRegistry.findByIdAndUpdate(cfg.id, {
    $set: { careerPaths: cfg.careerPaths, updatedAt: new Date() },
  });
  return cfg.careerPaths.length;
}

async function stepCommunity(cfg, approval) {
  // A program's feed filters on `program`, so a brand-new program opens on an
  // empty page. This seeds the one post that makes it not look broken.
  const existing = await Post.findOne({ program: cfg.id, pinned: true });
  if (existing) return 0;

  await Post.create({
    title: `Welcome to the ${cfg.label} community`,
    body:
      `This space is for ${cfg.label} students. Share resources, ask questions, ` +
      `and post wins here — everything you see is scoped to your program.`,
    tag: 'general',
    author: approval.approvedBy || approval.requestedBy,
    program: cfg.id,
    pinned: true,
  });
  return 1;
}

async function stepStudy(cfg) {
  // Resources carry `subject`/`tags`, not a category enum — match the program's
  // specializations and label words against those instead.
  const terms = [...(cfg.specializations || []), ...(cfg.keywords || []), cfg.label]
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return 0;

  const re = new RegExp(terms.join('|'), 'i');
  const res = await Resource.updateMany(
    { $or: [{ subject: re }, { tags: re }], programs: { $ne: cfg.id } },
    { $addToSet: { programs: cfg.id } }
  );
  return res.modifiedCount;
}

const RUNNERS = {
  registry: stepRegistry,
  news: stepNews,
  companies: stepCompanies,
  career: stepCareer,
  community: stepCommunity,
  study: stepStudy,
};

/**
 * Run the full data sync for an approved program, then notify the student.
 *
 * The email is deliberately the last thing that happens and only on a clean
 * run — telling someone their program is ready before the data exists is the
 * exact failure this ordering prevents.
 */
async function runProgramSync(approvalId) {
  const approval = await ProgramApproval.findById(approvalId);
  if (!approval) throw new Error(`ProgramApproval ${approvalId} not found`);

  const cfg = resolveProgramConfig(approval.programId, approval.programLabel);

  approval.syncStatus = 'in_progress';
  approval.syncStartedAt = new Date();
  approval.syncLog = STEPS.map((component) => ({ component, status: 'pending', count: 0 }));
  await approval.save();

  const logFor = (component) => approval.syncLog.find((l) => l.component === component);

  for (const component of STEPS) {
    const entry = logFor(component);
    entry.status = 'in_progress';
    await approval.save();

    try {
      entry.count = await RUNNERS[component](cfg, approval);
      entry.status = 'completed';
      entry.completedAt = new Date();
      await approval.save();
    } catch (err) {
      entry.status = 'failed';
      entry.error = err.message;
      approval.syncStatus = 'failed';
      await approval.save();
      logger.error('Program sync step failed', {
        approvalId: String(approvalId), programId: cfg.id, component, error: err.message,
      });
      throw err;
    }
  }

  approval.syncStatus = 'completed';
  approval.syncCompletedAt = new Date();
  await approval.save();

  // A dead mail service must not roll back a sync that genuinely succeeded —
  // the data is live either way, so this failure is logged, not thrown.
  try {
    const user = await User.findById(approval.requestedBy).select('name email').lean();
    if (user) {
      await sendProgramReadyEmail(user, approval.programLabel);
      approval.emailSent = true;
      approval.emailSentAt = new Date();
      await approval.save();
    }
  } catch (err) {
    logger.error('Program ready email failed', {
      approvalId: String(approvalId), error: err.message,
    });
  }

  logger.info('Program sync completed', {
    approvalId: String(approvalId),
    programId: cfg.id,
    counts: Object.fromEntries(approval.syncLog.map((l) => [l.component, l.count])),
  });

  return approval;
}

module.exports = { runProgramSync, resolveProgramConfig, STEPS };
