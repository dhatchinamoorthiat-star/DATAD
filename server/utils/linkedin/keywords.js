/**
 * Recruiter-search keyword analysis.
 *
 * LinkedIn is a search surface before it is a document: a recruiter types a
 * role and a couple of tools, and a profile either contains that vocabulary or
 * it does not. This module answers, per term, three questions — is it present,
 * where is it present, and where *should* it be — using the role taxonomy in
 * knowledge.js plus any job description the student supplied.
 *
 * Entirely deterministic. The LLM is never asked whether a keyword appears; it
 * is only asked to phrase the rewrite that would introduce one naturally.
 */

const { roleProfile, UNIVERSAL_TERMS, T } = require('./knowledge');
const { profileTextBySection } = require('./parse');

/**
 * Whole-term match, case-insensitive, tolerant of the punctuation real
 * terminology carries: "Node.js", "A/B testing", "C++" must all match without
 * the regex engine treating their punctuation as metacharacters, and "SQL"
 * must not match inside "NoSQLite".
 */
function hasTerm(text, term) {
  if (!text || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b fails against a term ending in punctuation ("Node.js", "C++"), so the
  // boundary is expressed as "not adjacent to a word character" instead.
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`, 'i').test(text);
}

/** Sections a term appears in, in the order recruiters weight them. */
const SECTION_ORDER = ['headline', 'about', 'experience', 'skills', 'projects', 'certifications', 'featured', 'education'];

function locate(sections, term) {
  return SECTION_ORDER.filter((k) => hasTerm(sections[k], term));
}

/**
 * Where a term ought to live. Hard skills earn their place in Skills and are
 * proven in Experience or Projects; titles belong in the headline. This is the
 * "keyword placement" half of the advice — telling someone a term is missing
 * without telling them where to put it just invites them to bolt it onto the
 * headline.
 */
function recommendedPlacement(kind) {
  switch (kind) {
    case 'title':  return ['Headline', 'Experience'];
    case 'hard':   return ['Skills', 'Experience or Projects'];
    case 'domain': return ['About', 'Experience'];
    case 'jd':     return ['Skills', 'Experience'];
    default:       return ['About'];
  }
}

const IMPORTANCE = { title: 'high', hard: 'high', jd: 'high', domain: 'medium', universal: 'low' };

/**
 * Terms lifted out of a pasted job description.
 *
 * A JD is prose, so this does not try to understand it — it looks for the
 * vocabulary already known to matter for the target role, plus capitalised
 * multi-word tool names and anything in a "requirements" style list. Terms the
 * taxonomy already covers are skipped so the same keyword is not reported twice
 * under two different origins.
 */
function extractJdTerms(jobDescription, known = []) {
  if (!jobDescription) return [];
  const text = String(jobDescription).slice(0, 20000);
  const knownLower = new Set(known.map((t) => t.toLowerCase()));
  const found = new Map();

  // Tool- and technology-shaped tokens: capitalised, acronyms, dotted names.
  const candidates = text.match(/\b([A-Z][A-Za-z0-9+#.]{1,18}(?:\s[A-Z][A-Za-z0-9+#.]{1,18}){0,2})\b/g) || [];

  for (const raw of candidates) {
    const term = raw.trim();
    const lower = term.toLowerCase();
    if (knownLower.has(lower) || found.has(lower)) continue;
    if (term.length < 2 || STOP_TITLES.has(lower)) continue;
    // Require a second mention: a JD names the actual requirements repeatedly
    // and mentions everything else once, which is a cheap and surprisingly
    // reliable filter against picking up the company's own name or a city.
    const occurrences = (text.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
    if (occurrences < 2) continue;
    found.set(lower, term);
    if (found.size >= 25) break;
  }

  return [...found.values()];
}

// Sentence-initial words and boilerplate that the capitalisation heuristic
// would otherwise mistake for technology names.
const STOP_TITLES = new Set([
  'we', 'you', 'the', 'this', 'our', 'your', 'as', 'in', 'at', 'and', 'or', 'if', 'about',
  'role', 'about the role', 'responsibilities', 'requirements', 'qualifications', 'benefits',
  'what', 'who', 'why', 'how', 'job', 'company', 'team', 'apply', 'please', 'must', 'should',
  'preferred', 'required', 'experience', 'skills', 'bachelor', 'master', 'degree', 'india',
  'work', 'years', 'strong', 'good', 'excellent', 'plus', 'nice',
]);

/**
 * @param {object} profile   normalised profile
 * @param {object} target    { role, secondaryRole, industry }
 * @param {string} [jobDescription]
 * @returns {{terms: Array, missingHigh: string[], stuffing: object, coverage: number}}
 */
function analyzeKeywords(profile, target = {}, jobDescription = '') {
  const sections = profileTextBySection(profile);
  const role = roleProfile(target.role);
  const secondary = target.secondaryRole ? roleProfile(target.secondaryRole) : null;

  const catalogue = [
    ...role.titles.map((t) => ({ term: t, kind: 'title' })),
    ...role.hard.map((t) => ({ term: t, kind: 'hard' })),
    ...role.domain.map((t) => ({ term: t, kind: 'domain' })),
    ...(secondary?.titles || []).slice(0, 2).map((t) => ({ term: t, kind: 'title' })),
    ...(secondary?.hard || []).slice(0, 4).map((t) => ({ term: t, kind: 'hard' })),
    ...UNIVERSAL_TERMS.map((t) => ({ term: t, kind: 'universal' })),
    ...extractJdTerms(jobDescription, role.hard.concat(role.titles, role.domain)).map((t) => ({ term: t, kind: 'jd' })),
  ];

  // De-duplicate, keeping the highest-importance kind for a term that appears
  // in more than one bucket (a JD term that is also a role skill is "high"
  // either way, but a title that also shows up in the JD should stay a title).
  const byTerm = new Map();
  for (const entry of catalogue) {
    const key = entry.term.toLowerCase();
    const existing = byTerm.get(key);
    if (!existing || rank(entry.kind) > rank(existing.kind)) byTerm.set(key, entry);
  }

  const terms = [...byTerm.values()].map(({ term, kind }) => {
    const present = locate(sections, term);
    return {
      term,
      kind,
      importance: IMPORTANCE[kind] || 'low',
      present: present.length > 0,
      // "Weak" = named in Skills but demonstrated nowhere. That is the pattern
      // recruiters discount, and it is the single most actionable keyword
      // finding: the fix is evidence, not another mention.
      weak: present.length === 1 && present[0] === 'skills',
      locations: present,
      recommendedIn: present.length ? [] : recommendedPlacement(kind),
    };
  });

  const high = terms.filter((t) => t.importance === 'high');
  const covered = high.filter((t) => t.present && !t.weak).length;

  return {
    terms,
    missingHigh: high.filter((t) => !t.present).map((t) => t.term),
    weakHigh: high.filter((t) => t.weak).map((t) => t.term),
    coverage: high.length ? Math.round((covered / high.length) * 100) : null,
    stuffing: detectStuffing(profile, sections),
    roleMatched: role.matched,
  };
}

const rank = (kind) => ({ title: 4, hard: 3, jd: 3, domain: 2, universal: 1 }[kind] || 0);

/**
 * Keyword stuffing detection.
 *
 * Two shapes, because they fail differently. A headline that is a pipe-
 * separated list of eleven terms reads as spam to a human even though each
 * term is individually relevant. A single term repeated across every section is
 * gaming, and LinkedIn's own guidance is explicit that repetition does not
 * help.
 */
function detectStuffing(profile, sections) {
  const headline = profile.headline || '';
  const separators = (headline.match(/[|•·]/g) || []).length;
  const headlineListy = separators >= T.HEADLINE_KEYWORD_MAX;

  const about = (sections.about || '').toLowerCase();
  const words = about.split(/\s+/).filter((w) => w.length > 3);
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);

  // >2% of a passage being one word is repetition a reader notices.
  const overused = [...counts.entries()]
    .filter(([, n]) => words.length >= 80 && n / words.length > 0.02)
    .map(([w]) => w)
    .slice(0, 5);

  return {
    headlineIsKeywordList: headlineListy,
    headlineSeparators: separators,
    overusedTerms: overused,
    detected: headlineListy || overused.length > 0,
  };
}

module.exports = { analyzeKeywords, hasTerm, extractJdTerms, detectStuffing };
