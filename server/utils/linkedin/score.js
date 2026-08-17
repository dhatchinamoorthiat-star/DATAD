/**
 * LinkedIn Profile Strength Score — 0–100, deterministic and explainable.
 *
 * Modelled on utils/resumeQuality.js: a flat list of weighted checks, each of
 * which either passes or does not, each carrying the sentence shown to the
 * student when it fails. Same input plus same RULES_VERSION always produces
 * the same number — no model is involved in scoring, so a score never drifts
 * because a provider was swapped or a temperature changed.
 *
 * The score exists to be argued with. Every check returns `why` (what was
 * observed) and `fix` (what to do), so the UI can render the reason next to the
 * number and never has to show a bare "67/100".
 *
 * Checks are scored against the *target role*, not against a universal ideal.
 * A profile that is excellent for a design role and scores badly for a data
 * role is the system working correctly.
 */

const { DIMENSIONS, T, roleProfile } = require('./knowledge');
const { deriveSignals } = require('./signals');

/**
 * Every check: which dimension it belongs to, what it is worth, and how it is
 * evaluated. `met` returns true/false; `partial` (optional) returns a fraction
 * for checks where "some" is genuinely better than "none" — keyword coverage
 * is a proportion, not a yes/no, and rounding it to a boolean would make the
 * score jump for a one-word edit.
 *
 * A check may return `null` from `met` to mean "cannot be assessed" — the
 * photo/banner questions when the student never answered them. Those checks
 * are removed from the denominator rather than failed, so an unanswered
 * question can never cost points.
 */
const CHECKS = [
  // ── Positioning (20) ────────────────────────────────────────────────────
  {
    key: 'headline_present',
    dimension: 'positioning',
    weight: 5,
    label: 'Headline states a professional identity',
    met: (s) => s.headline.present && !s.headline.isDefaultLike,
    why: (s) => (s.headline.present
      ? 'Your headline is short enough that it reads as a job title rather than a positioning statement.'
      : 'Your headline is empty, so LinkedIn shows your most recent job title instead.'),
    fix: 'Write a headline that names what you do and what you want to be found for.',
  },
  {
    key: 'headline_target_role',
    dimension: 'positioning',
    weight: 7,
    label: 'Headline aligns with your target role',
    met: (s) => s.headline.mentionsTargetRole,
    why: (s) => (s.headline.educationOnly
      ? 'Your headline identifies your education but not the role you want.'
      : 'None of the terminology recruiters use for your target role appears in your headline.'),
    fix: 'Lead with the role you are targeting, then your strongest relevant skill.',
  },
  {
    key: 'headline_not_stuffed',
    dimension: 'positioning',
    weight: 3,
    label: 'Headline reads as a sentence, not a keyword list',
    // Skipped when there is no headline. A check that asks "is this overdone"
    // cannot be passed by having nothing there — awarding the points would let
    // an empty profile bank credit for restraint it never exercised.
    met: (s) => (s.headline.present ? s.headline.separators < T.HEADLINE_KEYWORD_MAX && !s.headline.tooLong : null),
    why: (s) => `Your headline is split by ${s.headline.separators} separators, which reads as a keyword list.`,
    fix: 'Keep to two or three ideas separated by a single divider.',
  },
  {
    key: 'about_direction',
    dimension: 'positioning',
    weight: 5,
    label: 'About section states where you are heading',
    met: (s) => s.about.present && !s.about.tooShort,
    why: (s) => (s.about.present
      ? 'Your About section is too short to establish direction — it reads as a caption.'
      : 'You have no About section, so the only story a recruiter gets is your job titles.'),
    fix: 'Use About to say what you work on, what you have proven, and what you want next.',
  },

  // ── Searchability (20) ──────────────────────────────────────────────────
  {
    key: 'keyword_coverage',
    dimension: 'searchability',
    weight: 10,
    label: 'Profile carries the terminology for your target role',
    // Coverage is null when the target role is not in the taxonomy — there is
    // nothing to measure against, so the check is skipped rather than failed.
    met: (s, ctx) => (ctx.keywords.coverage === null ? null : ctx.keywords.coverage >= 70),
    partial: (s, ctx) => (ctx.keywords.coverage === null ? null : ctx.keywords.coverage / 100),
    why: (s, ctx) => `You carry ${ctx.keywords.coverage}% of the high-value terms for this role. Missing: ${ctx.keywords.missingHigh.slice(0, 5).join(', ') || 'none'}.`,
    fix: 'Add the missing terms where they are true, in Skills and in the experience that demonstrates them.',
  },
  {
    key: 'skills_populated',
    dimension: 'searchability',
    weight: 5,
    label: 'Skills section is populated',
    met: (s) => s.skills.count >= T.SKILLS_MIN,
    why: (s) => `You list ${s.skills.count} skills. Recruiters filter on this field, so a sparse list removes you from searches you would pass.`,
    fix: `List at least ${T.SKILLS_MIN} skills you can actually defend in an interview.`,
  },
  {
    key: 'no_stuffing',
    dimension: 'searchability',
    weight: 5,
    label: 'No keyword stuffing',
    // As with headline_not_stuffed: nothing to over-optimise means nothing to
    // assess, not a pass.
    met: (s, ctx) => (s.headline.present || s.about.present ? !ctx.keywords.stuffing.detected : null),
    why: (s, ctx) => (ctx.keywords.stuffing.headlineIsKeywordList
      ? 'Your headline is a list of terms rather than a statement.'
      : `These words repeat unusually often in your About: ${ctx.keywords.stuffing.overusedTerms.join(', ')}.`),
    fix: 'Say each thing once, in the section where it is backed by evidence.',
  },

  // ── Credibility (20) ────────────────────────────────────────────────────
  {
    key: 'experience_described',
    dimension: 'credibility',
    weight: 6,
    label: 'Experience entries have descriptions',
    met: (s) => s.experience.total > 0 && s.experience.empty === 0,
    partial: (s) => (s.experience.total ? s.experience.withDescription / s.experience.total : 0),
    why: (s) => (s.experience.total
      ? `${s.experience.empty} of your ${s.experience.total} experience entries have no description — a title alone tells a recruiter nothing about what you did.`
      : 'You have no experience entries, so there is nothing for a recruiter to assess.'),
    fix: 'Describe what you did, how, and what came of it.',
  },
  {
    key: 'quantified_impact',
    dimension: 'credibility',
    weight: 7,
    label: 'Experience shows measurable outcomes',
    met: (s) => s.experience.quantifiedBullets >= 2,
    partial: (s) => Math.min(s.experience.quantifiedBullets / 2, 1),
    why: (s) => `${s.experience.quantifiedBullets} of your ${s.experience.totalBullets} experience lines report a result. The rest describe activity.`,
    fix: 'For your strongest work, add the number that shows it mattered — only where you genuinely know it.',
  },
  {
    key: 'proof_of_work',
    dimension: 'credibility',
    weight: 4,
    label: 'Profile links to proof of work',
    met: (s) => s.evidence.hasProof,
    why: () => 'Nothing on your profile can be opened and inspected — no Featured items, no portfolio or repository link.',
    fix: 'Feature one thing a recruiter can look at: a project, a repository, a case study, a published piece.',
  },
  {
    key: 'social_proof',
    dimension: 'credibility',
    weight: 3,
    label: 'Has recommendations',
    met: (s) => s.recommendations.count >= 1,
    partial: (s) => Math.min(s.recommendations.count / T.RECOMMENDATIONS_STRONG, 1),
    why: (s) => `You have ${s.recommendations.count} recommendations. Nobody else on your profile vouches for the work you describe.`,
    fix: 'Ask one person who supervised your best work to write about that specific piece of work.',
  },

  // ── Completeness (15) ───────────────────────────────────────────────────
  { key: 'has_about', dimension: 'completeness', weight: 3, label: 'About section present',
    met: (s) => s.about.present,
    why: () => 'Your About section is empty.',
    fix: 'Write three short paragraphs: what you do, what you have proven, what you want next.' },
  { key: 'has_experience', dimension: 'completeness', weight: 4, label: 'At least one experience entry',
    met: (s) => s.experience.total > 0,
    why: () => 'You have no experience entries. Internships, freelance work, campus roles and substantial projects all belong here.',
    fix: 'Add every role where you produced something, paid or not.' },
  { key: 'has_education', dimension: 'completeness', weight: 2, label: 'Education present',
    met: (s) => s.education.present,
    why: () => 'Your education section is empty — it is how campus recruiters filter.',
    fix: 'Add your degree, institution and graduation year.' },
  { key: 'has_skills', dimension: 'completeness', weight: 2, label: 'Skills listed',
    met: (s) => s.skills.count > 0,
    why: () => 'You have listed no skills.',
    fix: 'Add the skills you would be comfortable being asked about.' },
  { key: 'has_evidence_section', dimension: 'completeness', weight: 2, label: 'Featured, projects or certifications present',
    met: (s) => s.evidence.featuredCount + s.evidence.projectCount + s.evidence.certificationCount > 0,
    why: () => 'You have no Featured items, projects or certifications.',
    fix: 'Add the strongest project you have finished.' },
  { key: 'has_location', dimension: 'completeness', weight: 1, label: 'Location set',
    met: (s) => s.presentation.hasLocation,
    why: () => 'No location is set, so you are excluded from every location-filtered search.',
    fix: 'Set the city you want to work in.' },
  { key: 'has_photo', dimension: 'completeness', weight: 1, label: 'Profile photo present',
    // null when unanswered — dropped from the denominator, never failed.
    met: (s) => s.presentation.hasPhoto,
    why: () => 'Your profile has no photo. A profile without one reads as abandoned.',
    fix: 'Add a clear, well-lit photo where your face fills most of the frame.' },

  // ── Narrative (15) ──────────────────────────────────────────────────────
  {
    key: 'about_substance',
    dimension: 'narrative',
    weight: 5,
    label: 'About has enough substance to be worth reading',
    met: (s) => s.about.substantial && !s.about.tooLong,
    partial: (s) => (s.about.present ? Math.min(s.about.length / T.ABOUT_STRONG, 1) : 0),
    why: (s) => (s.about.tooLong
      ? 'Your About runs long enough that most readers will stop before the end.'
      : `Your About is ${s.about.length} characters — too brief to carry a story.`),
    fix: 'Aim for three or four short paragraphs with a specific example in each.',
  },
  {
    key: 'specific_opening',
    dimension: 'narrative',
    weight: 4,
    label: 'Opening line is specific to you',
    met: (s) => s.about.present && !s.about.genericOpening,
    why: (s) => `Your opening line ("${(s.about.firstSentence || '').slice(0, 80)}…") could belong to thousands of profiles, and it is the only part shown before "see more".`,
    fix: 'Open with something only you could write — a specific thing you built, found or changed.',
  },
  {
    key: 'low_buzzword_density',
    dimension: 'narrative',
    weight: 3,
    label: 'Language is concrete rather than promotional',
    met: (s) => s.about.buzzwordDensity <= T.BUZZWORD_DENSITY_FLAG,
    why: (s) => `Your About leans on ${s.about.buzzwords.count} promotional words (${s.about.buzzwords.hits.slice(0, 3).join(', ')}). None of them can be verified.`,
    fix: 'Replace each with the thing that would make a reader conclude it themselves.',
  },
  {
    key: 'strong_verbs',
    dimension: 'narrative',
    weight: 3,
    label: 'Experience describes contribution, not attendance',
    met: (s) => s.experience.totalBullets > 0 && s.experience.weakBulletCount === 0,
    partial: (s) => (s.experience.totalBullets
      ? 1 - Math.min(s.experience.weakBulletCount / s.experience.totalBullets, 1)
      : 0),
    why: (s) => `${s.experience.weakBulletCount} experience lines start with phrases like "worked on" or "responsible for", which describe presence rather than contribution.`,
    fix: 'Rewrite as Action → Method → Outcome.',
  },

  // ── Conversion (10) ─────────────────────────────────────────────────────
  {
    key: 'contactable',
    dimension: 'conversion',
    weight: 4,
    label: 'A reader can act on your profile',
    met: (s) => s.about.hasCta || s.evidence.externalLinks.length > 0,
    why: () => 'Your profile gives an interested reader nowhere to go — no closing line inviting contact, no external link.',
    fix: 'End your About with one line saying what you are open to, and add your portfolio or repository link.',
  },
  {
    key: 'featured_proof',
    dimension: 'conversion',
    weight: 3,
    label: 'Featured section carries your strongest work',
    met: (s) => s.evidence.featuredCount > 0,
    why: () => 'Your Featured section is empty — it is the only place a recruiter sees work without leaving your profile.',
    fix: 'Feature two or three items that support the role you are targeting.',
  },
  {
    key: 'value_proposition',
    dimension: 'conversion',
    weight: 3,
    label: 'Clear reason to start a conversation',
    met: (s) => s.headline.mentionsTargetRole && (s.evidence.hasProof || s.experience.quantifiedBullets > 0),
    why: () => 'Your profile does not connect what you want to what you have proven, so there is no obvious reason to reach out.',
    fix: 'Make the headline name the role and the Featured section prove you can do it.',
  },
];

/**
 * Score a normalised profile against a target.
 *
 * @param {object} profile  normalised profile (utils/linkedin/parse.js)
 * @param {object} target   { role, secondaryRole, industry, seniority }
 * @param {object} keywords output of analyzeKeywords()
 * @returns {{score:number, dimensions:object, checks:Array, signals:object}}
 */
function scoreProfile(profile = {}, target = {}, keywords) {
  const role = roleProfile(target.role);
  const signals = deriveSignals(profile, role.titles);
  const ctx = { keywords: keywords || { coverage: null, missingHigh: [], stuffing: { detected: false, overusedTerms: [] } }, target, role };

  const dimensions = {};
  for (const [key, def] of Object.entries(DIMENSIONS)) {
    dimensions[key] = { ...def, earned: 0, available: 0, score: 0, checks: [] };
  }

  const checks = [];

  for (const check of CHECKS) {
    const raw = check.met(signals, ctx);

    // null = not assessable. Drop from the denominator entirely so the
    // remaining checks are rescaled rather than the student being penalised
    // for a question we never asked.
    if (raw === null || raw === undefined) {
      checks.push({ key: check.key, dimension: check.dimension, label: check.label, status: 'skipped', weight: 0 });
      continue;
    }

    const passed = raw === true;
    const fraction = passed ? 1 : clamp01(check.partial ? check.partial(signals, ctx) ?? 0 : 0);
    const earned = round2(check.weight * fraction);

    const dim = dimensions[check.dimension];
    dim.available += check.weight;
    dim.earned += earned;

    const entry = {
      key: check.key,
      dimension: check.dimension,
      label: check.label,
      weight: check.weight,
      earned,
      status: passed ? 'pass' : fraction > 0 ? 'partial' : 'fail',
      // Reasons are only meaningful for something that did not fully pass, and
      // a passing check's `why` reads as an accusation ("0 of your lines…").
      why: passed ? null : safe(check.why, signals, ctx),
      fix: passed ? null : check.fix,
    };
    checks.push(entry);
    dim.checks.push(entry);
  }

  let earned = 0;
  let available = 0;
  for (const dim of Object.values(dimensions)) {
    earned += dim.earned;
    available += dim.available;
    // Rescale each dimension onto its own maximum so a skipped check inside a
    // dimension does not silently shrink that dimension's contribution.
    dim.score = dim.available ? Math.round((dim.earned / dim.available) * dim.max) : 0;
    dim.earned = round2(dim.earned);
  }

  return {
    score: available ? Math.round((earned / available) * 100) : 0,
    dimensions,
    checks,
    signals,
    // Guards against a rules edit that leaves the weights not summing to 100.
    _weightTotal: Object.values(DIMENSIONS).reduce((s, d) => s + d.max, 0),
  };
}

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0);
const round2 = (n) => Math.round(n * 100) / 100;

/** A reason string must never be the thing that fails an analysis. */
function safe(fn, signals, ctx) {
  try {
    return fn(signals, ctx);
  } catch {
    return null;
  }
}

module.exports = { scoreProfile, CHECKS };
