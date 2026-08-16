/**
 * Roadmap Service — generates skill roadmaps from student context.
 *
 * Architecture (per the DATAD Constitution):
 * 1. Collect structured context from existing data sources.
 * 2. Apply business logic to compute the skill gap offline.
 * 3. Send ONLY the reasoning task to the LLM.
 * 4. Parse the structured response into roadmap items.
 * 5. Persist to PivotPlan with planType='roadmap'.
 *
 * Input priority (highest → lowest):
 * 1. StudentIdentity (skills, goals, learning style)
 * 2. Existing PivotPlan / Roadmap (if any)
 * 3. HabitLog + study history
 * 4. Intelligence collectors (career, learning)
 * 5. User's requested target role
 * 6. Additional user input (if provided)
 */
const StudentIdentity = require('../models/StudentIdentity');
const PivotPlan = require('../models/PivotPlan');
const HabitLog = require('../models/HabitLog');
const { computeDailyCaseStreak } = require('../utils/streak');
const { run } = require('../ai/runner');
const PROMPTS = require('../ai/prompts');
const careerCollector = require('../ai/intelligence-layer/collectors/careerCollector');

// ── Role skill requirements (business logic, not AI) ──────────────────────
// Common target roles and the skills typically required. This is the hard
// list the AI enriches; the AI never fabricates a role's requirements
// from scratch.
const ROLE_SKILL_MAP = {
  'software engineer':        ['Data Structures', 'Algorithms', 'System Design', 'OOP', 'SQL', 'Git', 'REST APIs'],
  'frontend engineer':        ['JavaScript', 'React/Vue/Angular', 'HTML/CSS', 'TypeScript', 'REST APIs', 'Responsive Design'],
  'backend engineer':         ['Node.js/Python/Java', 'SQL', 'REST APIs', 'System Design', 'Docker', 'CI/CD'],
  'data scientist':           ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualisation', 'Deep Learning'],
  'data analyst':             ['SQL', 'Excel', 'Python/R', 'Data Visualisation', 'Statistics', 'Power BI/Tableau'],
  'ml engineer':              ['Python', 'Machine Learning', 'Deep Learning', 'MLOps', 'TensorFlow/PyTorch', 'SQL'],
  'product manager':          ['Product Strategy', 'User Research', 'Data Analysis', 'Agile/Scrum', 'A/B Testing', 'Roadmapping'],
  'business analyst':         ['Excel', 'SQL', 'Data Analysis', 'Requirements Gathering', 'Stakeholder Management', 'Process Modelling'],
  'consultant':               ['Case Interview', 'Excel', 'Data Analysis', 'Presentation', 'Stakeholder Management', 'Financial Modelling'],
  'investment banker':        ['Financial Modelling', 'Valuation', 'Excel', 'Accounting', 'M&A Knowledge', 'Deal Sourcing'],
  'marketing manager':        ['Digital Marketing', 'Content Strategy', 'SEO/SEM', 'Analytics', 'Brand Management', 'Campaign Management'],
  'devops engineer':          ['Docker', 'Kubernetes', 'CI/CD', 'AWS/GCP/Azure', 'Terraform', 'Linux'],
  'full stack developer':     ['JavaScript', 'React', 'Node.js/Python', 'SQL', 'REST APIs', 'Git', 'HTML/CSS'],
  'data engineer':            ['SQL', 'Python', 'ETL Pipelines', 'Spark', 'Data Warehousing', 'AWS/GCP'],
  'ux designer':              ['User Research', 'Wireframing', 'Prototyping', 'Figma/Sketch', 'Visual Design', 'Usability Testing'],
};

// ── Context collection ────────────────────────────────────────────────────

async function collectStudentIdentity(userId) {
  try {
    const identity = await StudentIdentity.findOne({ user: userId }).lean();
    if (!identity) return null;
    return {
      skills: identity.skills || [],
      dreamRole: identity.dreamRole || '',
      careerInterests: identity.careerInterests || [],
      favouriteSubjects: identity.favouriteSubjects || [],
      difficultSubjects: identity.difficultSubjects || [],
      learningStyle: identity.learningStyle || '',
      goals: identity.goals || [],
      challenges: identity.challenges || [],
      preferredIndustries: identity.preferredIndustries || [],
      specialization: identity.specialization || '',
      targetRoles: identity.targetRoles || [],
      targetCompanies: identity.targetCompanies || [],
    };
  } catch {
    return null;
  }
}

async function collectPivotPlan(userId) {
  try {
    const plan = await PivotPlan.findOne({ user: userId }).lean();
    if (!plan) return null;
    return {
      planType: plan.planType || 'pivot',
      toDomain: plan.toDomain || '',
      toRole: plan.toRole || '',
      skillGaps: (plan.skillGaps || []).map((g) => ({
        skill: g.skill,
        status: g.status,
      })),
      currentSkills: plan.currentSkills || [],
      targetCompanies: plan.targetCompanies || [],
    };
  } catch {
    return null;
  }
}

async function collectLearningContext(userId) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const [logs, streak] = await Promise.all([
      HabitLog.find({ user: userId, date: { $gte: sevenDaysAgo } }).sort({ date: -1 }).lean().catch(() => []),
      computeDailyCaseStreak(userId).catch(() => 0),
    ]);

    const totalStudyMin = logs.reduce((s, l) => s + (l.studyMinutes || 0), 0);
    const daysActive = logs.filter((l) => (l.studyMinutes || 0) > 0).length;

    return {
      studyMinutes: totalStudyMin,
      avgDailyMinutes: logs.length ? Math.round(totalStudyMin / logs.length) : 0,
      streak,
      daysActive,
      consistency: logs.length ? Math.round((daysActive / logs.length) * 100) : 0,
    };
  } catch {
    return null;
  }
}

// ── Business logic ────────────────────────────────────────────────────────

/**
 * Compute the skill gap between current skills and target role requirements.
 * This runs BEFORE the AI prompt — the prompt only enriches, not decides.
 */
function computeSkillGap(currentSkills, targetRole) {
  const skills = currentSkills && Array.isArray(currentSkills) ? currentSkills : [];
  const roleSlug = (targetRole || '').toLowerCase().trim();
  const requiredSkills = ROLE_SKILL_MAP[roleSlug] || [];

  if (!requiredSkills.length) return { gap: [], total: 0, closed: 0, pct: 0 };

  const normalised = skills.map((s) => s.toLowerCase().trim());
  const gap = requiredSkills.filter((s) => !normalised.includes(s.toLowerCase()));
  const closed = requiredSkills.length - gap.length;

  return {
    gap,
    total: requiredSkills.length,
    closed,
    pct: Math.round((closed / requiredSkills.length) * 100),
  };
}

// ── Prompting ─────────────────────────────────────────────────────────────

/**
 * Generate a 3-month skill roadmap for the user.
 *
 * @param {string}  userId
 * @param {object}  [options]
 * @param {string}  [options.targetRole]       - Override for the target role
 * @param {string}  [options.additionalContext] - Extra user input
 * @returns {Promise<{ roadmap: object, gaps: object }>}
 */
async function generateRoadmap(userId, options = {}) {
  const identityContext = await collectStudentIdentity(userId);
  const pivotPlan = await collectPivotPlan(userId);
  const learning = await collectLearningContext(userId);
  const career = await careerCollector.collect(userId).catch(() => null);

  // Resolve target role (priority: request → dreamRole → existing roadmap)
  const targetRole = options.targetRole
    || identityContext?.dreamRole
    || pivotPlan?.toRole
    || '';

  if (!targetRole) {
    throw new Error('A target role is required. Set one in your profile or provide it here.');
  }

  // Resolve current skills (union of StudentIdentity.skills + PivotPlan.currentSkills)
  const currentSkills = [
    ...new Set([
      ...(identityContext?.skills || []),
      ...(pivotPlan?.currentSkills || []),
      ...(career?.skills || []),
    ]),
  ].filter(Boolean);

  // Business logic: compute the gap
  const gaps = computeSkillGap(currentSkills, targetRole);

  // Build structured context for the AI prompt
  const context = {
    student: {
      currentSkills,
      targetRole,
      learningStyle: identityContext?.learningStyle || null,
      favouriteSubjects: identityContext?.favouriteSubjects || [],
      difficultSubjects: identityContext?.difficultSubjects || [],
      goals: identityContext?.goals || [],
      specialization: identityContext?.specialization || null,
      preferredIndustries: identityContext?.preferredIndustries || [],
    },
    gap: {
      identifiedMissing: gaps.gap,
      totalRequired: gaps.total,
      currentMatchPct: gaps.pct,
    },
    existingPlan: pivotPlan ? {
      targetRole: pivotPlan.toRole,
      skillGaps: pivotPlan.skillGaps,
      targetCompanies: pivotPlan.targetCompanies,
    } : null,
    learning: learning ? {
      avgDailyMinutes: learning.avgDailyMinutes,
      streak: learning.streak,
      consistencyPct: learning.consistency,
    } : null,
    career: career ? {
      hasResume: career.hasResume,
      resumeCompletionPct: career.resumeCompletionPct,
      experienceYears: career.experienceYears,
      applications: career.applications,
      offerCount: career.offerCount,
    } : null,
    additionalContext: options.additionalContext || null,
  };

  // Call AI for reasoning only — the hard logic is already done above
  const prompt = PROMPTS.skillRoadmap(context);
  const { result, meta } = await run({
    system: prompt.system,
    user: prompt.user,
    json: true,
    maxTokens: 4096,
  });

  // Merge AI output with computed gap data
  const roadmapItems = (result.items || []).map((item, i) => ({
    skill: item.skill || gaps.gap[i] || 'General',
    status: 'not-started',
    itemType: item.recommendationType || 'other',
    link: item.resourceLink || '',
    notes: item.rationale || item.description || '',
    suggestedOrder: item.suggestedOrder || i,
    sortOrder: i,
  }));

  // Save to PivotPlan
  const roadmap = await PivotPlan.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        planType: 'roadmap',
        toRole: targetRole,
        toDomain: identityContext?.specialization || options.targetRole || '',
        skillGaps: roadmapItems,
        currentSkills: currentSkills,
        targetCompanies: pivotPlan?.targetCompanies || identityContext?.targetCompanies || [],
      },
    },
    { upsert: true, new: true }
  );

  return {
    roadmap: roadmap.toObject(),
    gaps: {
      ...gaps,
      identifiedMissing: gaps.gap,
    },
    meta: {
      provider: meta.provider,
      model: meta.model,
      tokensUsed: meta.tokensUsed,
      contextSources: {
        identity: !!identityContext,
        pivotPlan: !!pivotPlan,
        learning: !!learning,
        career: !!career,
      },
    },
  };
}

/**
 * Compute roadmap progress.
 */
async function getProgress(userId) {
  const plan = await PivotPlan.findOne({ user: userId }).lean();
  if (!plan) {
    return { hasRoadmap: false, progress: 0, completed: 0, inProgress: 0, total: 0, items: [] };
  }

  const gaps = plan.skillGaps || [];
  const completed = gaps.filter((g) => g.status === 'done').length;
  const inProgress = gaps.filter((g) => g.status === 'in-progress').length;
  const total = gaps.length;

  return {
    hasRoadmap: plan.planType === 'roadmap',
    planType: plan.planType,
    progress: total ? Math.round((completed / total) * 100) : 0,
    completed,
    inProgress,
    total,
    items: gaps,
  };
}

module.exports = { generateRoadmap, getProgress, computeSkillGap };
