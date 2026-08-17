/**
 * Skills intelligence and job-description matching.
 *
 * Both are comparisons, and both are deterministic. The model is never asked
 * "does this profile match this job" — that is a set operation over
 * terminology, and asking a model to do it produces a plausible number that
 * cannot be reproduced or explained. What the model *is* asked, elsewhere, is
 * how to phrase the change once the gap is known.
 *
 * The organising idea in both directions is evidence. A skill named in the
 * Skills section and nowhere else is a claim; the same skill named in an
 * experience description is a demonstrated one, and recruiters treat the two
 * very differently. Every output here distinguishes them.
 */

const { roleProfile } = require('./knowledge');
const { profileTextBySection } = require('./parse');
const { hasTerm, extractJdTerms } = require('./keywords');

/**
 * Where in the profile a skill is actually demonstrated.
 *
 * @returns {'demonstrated'|'claimed'|'absent'}
 *   demonstrated — appears in experience, projects or featured work
 *   claimed      — appears only in the Skills list (or only in About)
 *   absent       — nowhere
 */
function skillSupport(sections, skill) {
  const demonstratedIn = ['experience', 'projects', 'featured', 'certifications'].filter((k) => hasTerm(sections[k], skill));
  if (demonstratedIn.length) return { status: 'demonstrated', locations: demonstratedIn };

  const claimedIn = ['skills', 'about', 'headline'].filter((k) => hasTerm(sections[k], skill));
  if (claimedIn.length) return { status: 'claimed', locations: claimedIn };

  return { status: 'absent', locations: [] };
}

/**
 * Compare the profile's skills against what the target role requires.
 *
 * @param {object} profile normalised profile
 * @param {object} target  { role, secondaryRole }
 */
function analyzeSkills(profile = {}, target = {}) {
  const sections = profileTextBySection(profile);
  const role = roleProfile(target.role);
  // Only hard skills are "required skills". Domain vocabulary ("Retention",
  // "Funnel Analysis") is terminology that belongs in prose, not entries in a
  // Skills list — folding it in here made the match score read as a skills gap
  // when the real finding was a wording gap, which keywords.js already reports.
  const required = [...new Set(role.hard)];
  const domainSignals = role.domain.map((term) => ({ term, ...skillSupport(sections, term) }));

  const listed = (profile.skills || []).map((s) => s.name);
  const listedLower = new Set(listed.map((s) => s.toLowerCase()));

  const assessed = required.map((skill) => {
    const support = skillSupport(sections, skill);
    return {
      skill,
      listed: listedLower.has(skill.toLowerCase()),
      status: support.status,
      locations: support.locations,
      // The most valuable finding in this whole module: proven somewhere in
      // the profile but missing from the field recruiters filter on. It is a
      // one-click fix that changes who finds them.
      provenButUnlisted: support.status === 'demonstrated' && !listedLower.has(skill.toLowerCase()),
    };
  });

  const strong = assessed.filter((s) => s.listed && s.status === 'demonstrated');
  const partial = assessed.filter((s) => s.listed && s.status !== 'demonstrated');
  const missing = assessed.filter((s) => !s.listed && s.status === 'absent');
  const unlisted = assessed.filter((s) => s.provenButUnlisted);

  // Skills the student lists that have nothing to do with the target role and
  // are demonstrated nowhere. Not "bad skills" — just ones that spend a slot
  // on a list recruiters skim.
  const requiredLower = new Set(required.map((r) => r.toLowerCase()));
  const deprioritise = listed
    .filter((s) => !requiredLower.has(s.toLowerCase()))
    .filter((s) => skillSupport(sections, s).status !== 'demonstrated')
    .slice(0, 10);

  // Weighted so that proven-and-listed counts fully, listed-but-unproven
  // counts half. A profile that simply types in every required skill should
  // not score the same as one that has done the work.
  const score = required.length
    ? Math.round(((strong.length + partial.length * 0.5) / required.length) * 100)
    : null;

  return {
    matchScore: score,
    roleMatched: role.matched,
    required,
    // Kept separate so the UI can say "this vocabulary is missing from your
    // writing" rather than "add these to your skills list".
    domainSignals: domainSignals.filter((d) => d.status === 'absent').map((d) => d.term),
    strong: strong.map((s) => s.skill),
    partial: partial.map((s) => ({ skill: s.skill, note: 'Listed, but not demonstrated anywhere in your profile.' })),
    missing: missing.map((s) => s.skill),
    provenButUnlisted: unlisted.map((s) => ({ skill: s.skill, foundIn: s.locations })),
    deprioritise,
    // Where each missing skill should be demonstrated, not just mentioned.
    placement: missing.slice(0, 8).map((s) => ({
      skill: s.skill,
      demonstrateIn: role.evidence[0] || 'a project with a described outcome',
    })),
    assessed,
  };
}

/**
 * Match the profile against a pasted job description.
 *
 * The JD is untrusted text like any other input — it is neutralised before it
 * reaches a prompt, and nothing in it is executed as an instruction. Here it is
 * only mined for terminology.
 *
 * @param {object} profile normalised profile
 * @param {string} jobDescription
 * @param {object} target  { role }
 */
function matchJobDescription(profile = {}, jobDescription = '', target = {}) {
  const sections = profileTextBySection(profile);
  const role = roleProfile(target.role);
  const jdText = String(jobDescription || '').slice(0, 20000);

  const roleTerms = [...new Set([...role.hard, ...role.domain])].filter((t) => hasTerm(jdText, t));
  const jdTerms = extractJdTerms(jdText, roleTerms);
  const terms = [...new Set([...roleTerms, ...jdTerms])];

  const assessed = terms.map((term) => {
    const support = skillSupport(sections, term);
    return { term, status: support.status, locations: support.locations };
  });

  const demonstrated = assessed.filter((t) => t.status === 'demonstrated');
  const claimed = assessed.filter((t) => t.status === 'claimed');
  const absent = assessed.filter((t) => t.status === 'absent');

  // Title alignment is scored separately because it is the first filter a
  // recruiter applies and the cheapest thing to fix.
  const jdTitle = extractTitle(jdText);
  const titleAligned = jdTitle
    ? hasTerm(sections.headline, jdTitle) || hasTerm(sections.experience, jdTitle)
    : null;

  const termScore = terms.length
    ? (demonstrated.length + claimed.length * 0.5) / terms.length
    : 0;

  // 85% terminology, 15% title. The title is worth real points but cannot
  // carry a profile that demonstrates none of the work.
  const overall = terms.length
    ? Math.round((termScore * 0.85 + (titleAligned ? 0.15 : 0)) * 100)
    : null;

  return {
    overall,
    jdTitle,
    titleAligned,
    termCount: terms.length,
    strongMatches: demonstrated.map((t) => ({ term: t.term, foundIn: t.locations })),
    partialMatches: claimed.map((t) => ({ term: t.term, note: 'Mentioned, but not demonstrated in any experience or project.' })),
    missingSignals: absent.map((t) => t.term),
    // Which of your own experiences to lead with for this application.
    emphasise: rankExperienceForJd(profile, terms).slice(0, 3),
    skillsToDevelop: absent.slice(0, 5).map((t) => t.term),
  };
}

/** The first title-shaped line in a JD, used only for alignment checking. */
function extractTitle(jdText) {
  const explicit = jdText.match(/\b(?:job title|role|position)\s*[:\-]\s*(.{3,60})/i);
  if (explicit) return explicit[1].split('\n')[0].trim();

  const firstLine = jdText.split('\n').map((l) => l.trim()).find(Boolean);
  return firstLine && firstLine.length <= 60 ? firstLine : null;
}

/**
 * Rank the student's own experiences by how many of the JD's terms they
 * already contain — the answer to "which of my roles should I lead with".
 */
function rankExperienceForJd(profile, terms) {
  return (profile.experience || [])
    .map((e) => {
      const text = [e.role, e.organization, e.description].filter(Boolean).join(' ');
      const matched = terms.filter((t) => hasTerm(text, t));
      return {
        role: e.role,
        organization: e.organization,
        matchedTerms: matched,
        reason: matched.length
          ? `Already carries ${matched.length} of this role's terms (${matched.slice(0, 3).join(', ')}).`
          : null,
      };
    })
    .filter((e) => e.matchedTerms.length)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length);
}

/**
 * Recommendation-request strategy: who to ask, and for what.
 *
 * Built from the student's own experience entries so the suggestion names a
 * real supervisor relationship rather than a category. Never generates the
 * recommendation itself — a recommendation written by the person it is about
 * is not social proof, and the copy says so.
 */
function recommendationStrategy(profile = {}, signals = {}) {
  const experiences = profile.experience || [];
  const targets = [];

  for (const e of experiences.slice(0, 4)) {
    if (!e.organization) continue;
    const internship = /intern/i.test(`${e.role} ${e.employmentType}`);
    targets.push({
      from: internship ? 'your supervisor' : 'your manager or the person who reviewed your work',
      at: e.organization,
      about: e.role,
      ask: `Ask them to describe one specific thing you did at ${e.organization} and what came of it — a specific recommendation is worth more than three general ones.`,
    });
  }

  if ((profile.education || []).length && targets.length < 3) {
    const edu = profile.education[0];
    targets.push({
      from: 'a professor or project guide',
      at: edu.institution,
      about: edu.degree || 'your coursework',
      ask: 'Ask about a project they supervised, not about your attendance or attitude.',
    });
  }

  return {
    current: signals.recommendations?.count || 0,
    seniorCount: signals.recommendations?.seniorCount || 0,
    targets: targets.slice(0, 4),
    // Stated as a principle, not a warning, because it is genuinely the
    // difference between social proof and decoration.
    principle: 'Ask people who watched you do the work. Never write your own or trade them — a recommendation that does not describe specific work reads as a favour and is discounted accordingly.',
  };
}

module.exports = { analyzeSkills, matchJobDescription, recommendationStrategy, skillSupport };
