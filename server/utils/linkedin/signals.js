/**
 * Profile signals — the measurable facts every other layer reasons from.
 *
 * Computed once per analysis and handed to the scorer, the red-flag pass and
 * the LLM prompt alike. Keeping them in one place is what makes the score
 * explainable: every point gained or lost traces back to a named signal here,
 * so "your score is 67" can always be unpacked into the specific observations
 * that produced it.
 *
 * Nothing here is a judgement. `quantifiedBullets: 1` is a fact; whether that
 * is good depends on the target role, and that decision belongs to score.js.
 */

const { BUZZWORDS, WEAK_VERBS, GENERIC_PHRASES, TEMPLATE_OPENERS, STRONG_VERBS, T } = require('./knowledge');

const words = (s) => String(s || '').split(/\s+/).filter(Boolean);
const lower = (s) => String(s || '').toLowerCase();

/** Count of lexicon entries present, and which ones — the UI quotes them back. */
function lexiconHits(text, lexicon) {
  const t = lower(text);
  const hits = lexicon.filter((w) => t.includes(w));
  return { count: hits.length, hits: hits.slice(0, 8) };
}

/**
 * A quantified claim is a number that measures something: a percentage, a
 * money amount, a count of people or items, a multiplier, a time saving.
 *
 * Deliberately excludes bare years and dates — "2024" and "3 months" describe
 * when work happened, not what it achieved, and counting them would let a date
 * range masquerade as impact. That distinction is the whole point of the
 * signal, so it is pinned by a test.
 */
const QUANTIFIED = [
  /\b\d+(\.\d+)?\s?%/,                                    // 40%
  /(?:₹|rs\.?|inr|\$|usd|€)\s?\d/i,                       // ₹2L, $5k
  /\b\d+(\.\d+)?\s?(x|×)\b/i,                             // 3x
  /\b\d[\d,]*\+?\s+(users?|students?|customers?|clients?|people|members?|records?|rows?|downloads?|installs?|orders?|leads?|applications?|responses?|hours?|queries|requests?|transactions?)\b/i,
  /\b(reduced|cut|increased|grew|raised|improved|saved|scaled|boosted|lowered)\b[^.]{0,40}\b\d/i,
  /\b(top|rank(ed)?)\s?\d+\b/i,                           // Rank 1, top 5
  /\b\d+(\.\d+)?\s?(k|l|lakh|cr|crore|m|mn|bn)\b/i,       // 10k, 2 lakh
];

const isQuantified = (text) => QUANTIFIED.some((re) => re.test(String(text || '')));

/** Description lines that read as separate claims — bullets, or real sentences. */
function bulletsOf(description) {
  return String(description || '')
    .split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((l) => l.replace(/^[\s•\-–*·]+/, '').trim())
    .filter((l) => l.length >= 15);
}

function analyseExperience(experience = []) {
  const entries = experience.map((e) => {
    const bullets = bulletsOf(e.description);
    const quantified = bullets.filter(isQuantified);
    const weak = bullets.filter((b) => WEAK_VERBS.some((v) => lower(b).startsWith(v) || lower(b).includes(` ${v} `)));
    const strong = bullets.filter((b) => STRONG_VERBS.some((v) => lower(b).startsWith(v)));

    return {
      role: e.role,
      organization: e.organization,
      duration: e.duration,
      employmentType: e.employmentType,
      hasDescription: String(e.description || '').trim().length >= T.EXPERIENCE_BULLET_MIN,
      bulletCount: bullets.length,
      quantifiedCount: quantified.length,
      weakBullets: weak.slice(0, 5),
      strongBullets: strong.slice(0, 3),
      // The most useful thing to show a student is their own weakest line
      // alongside why it is weak, so keep one verbatim.
      weakestBullet: weak[0] || bullets.find((b) => !isQuantified(b)) || null,
      wordCount: words(e.description).length,
    };
  });

  return {
    entries,
    total: entries.length,
    withDescription: entries.filter((e) => e.hasDescription).length,
    empty: entries.filter((e) => !e.hasDescription).length,
    quantifiedBullets: entries.reduce((s, e) => s + e.quantifiedCount, 0),
    totalBullets: entries.reduce((s, e) => s + e.bulletCount, 0),
    weakBulletCount: entries.reduce((s, e) => s + e.weakBullets.length, 0),
  };
}

/**
 * Does the headline say what this person does, or only where they study?
 *
 * An education-only headline is the single most common student mistake: it is
 * true, it is verifiable, and it tells a recruiter nothing about what role to
 * consider them for. Detecting it needs both halves — education vocabulary
 * present *and* role vocabulary absent — because "CS student building data
 * pipelines | aspiring Data Engineer" is a perfectly good headline.
 */
function analyseHeadline(headline, roleTerms = []) {
  const h = String(headline || '');
  const l = lower(h);
  const educationish = /\b(student|undergraduate|graduate|b\.?tech|b\.?e\b|b\.?sc|b\.?com|bba|mba|m\.?tech|msc|pursuing|final year|\d(st|nd|rd|th)\s+year)\b/i.test(l);
  const roleish = roleTerms.some((t) => l.includes(lower(t)));

  return {
    present: h.length > 0,
    length: h.length,
    tooShort: h.length > 0 && h.length < T.HEADLINE_MIN,
    tooLong: h.length > T.HEADLINE_MAX,
    // LinkedIn defaults the headline to the current job title. That default is
    // not "empty", but it is not a positioning statement either.
    isDefaultLike: h.length > 0 && h.length < 35 && !/[|•·,]/.test(h),
    educationOnly: educationish && !roleish,
    mentionsTargetRole: roleish,
    buzzwords: lexiconHits(h, BUZZWORDS),
    separators: (h.match(/[|•·]/g) || []).length,
  };
}

function analyseAbout(about) {
  const a = String(about || '');
  const wc = words(a).length;
  const firstSentence = a.split(/(?<=[.!?])\s/)[0] || '';

  return {
    present: a.length > 0,
    length: a.length,
    wordCount: wc,
    tooShort: a.length > 0 && a.length < T.ABOUT_MIN,
    substantial: a.length >= T.ABOUT_STRONG,
    tooLong: a.length > T.ABOUT_MAX,
    firstSentence: firstSentence.slice(0, 300),
    // An opening that could belong to anybody wastes the only two lines
    // LinkedIn shows before "see more".
    genericOpening: GENERIC_PHRASES.some((p) => lower(firstSentence).includes(p))
      || TEMPLATE_OPENERS.some((p) => lower(a).startsWith(p)),
    buzzwords: lexiconHits(a, BUZZWORDS),
    genericPhrases: lexiconHits(a, GENERIC_PHRASES),
    templatePhrases: lexiconHits(a, TEMPLATE_OPENERS),
    buzzwordDensity: wc ? lexiconHits(a, BUZZWORDS).count / wc : 0,
    quantified: isQuantified(a),
    // A closing line that tells the reader what to do next. Optional, but its
    // absence is why an otherwise strong About produces no messages.
    hasCta: /\b(reach out|get in touch|connect with me|feel free to|dm me|message me|email me|let'?s talk|open to|contact me)\b/i.test(a),
    firstPerson: /\bI\b|\bmy\b/.test(a),
    paragraphs: a.split(/\n\s*\n/).filter((p) => p.trim()).length,
  };
}

/**
 * Proof the student can point at, as opposed to claims they make. Links,
 * Featured items, certifications, publications and awards all count; a link
 * that goes to a portfolio or a repository counts for more than one that goes
 * to a document, because a recruiter can open it and see work.
 */
function analyseEvidence(profile) {
  const links = profile.links || [];
  const portfolioKinds = new Set(['github', 'gitlab', 'kaggle', 'design portfolio', 'writing', 'competitive programming']);

  return {
    featuredCount: (profile.featured || []).length,
    projectCount: (profile.projects || []).length,
    certificationCount: (profile.certifications || []).length,
    awardCount: (profile.awards || []).length,
    publicationCount: (profile.publications || []).length,
    volunteerCount: (profile.volunteer || []).length,
    portfolioLinks: links.filter((l) => portfolioKinds.has(l.kind)),
    // The profile's own URL is not evidence of anything.
    externalLinks: links.filter((l) => l.kind !== 'linkedin'),
    hasProof: (profile.featured || []).length > 0
      || links.some((l) => portfolioKinds.has(l.kind))
      || (profile.publications || []).length > 0,
  };
}

/**
 * Recommendations as social proof. Quantity matters least; who wrote them and
 * whether they describe specific work matters most, so both are measured.
 */
function analyseRecommendations(recommendations = []) {
  const SUPERVISORY = /\b(manager|supervisor|lead|head|director|founder|ceo|cto|mentor|professor|guide|principal investigator|reported directly)\b/i;

  const detailed = recommendations.filter((r) => String(r.text || '').length >= 250);
  const specific = recommendations.filter((r) => isQuantified(r.text) || String(r.text || '').split(/\s+/).length > 60);
  const senior = recommendations.filter((r) => SUPERVISORY.test(`${r.relationship} ${r.recommender}`));

  return {
    count: recommendations.length,
    detailedCount: detailed.length,
    specificCount: specific.length,
    seniorCount: senior.length,
    // Distinct relationship wording is a proxy for a varied set of
    // recommenders — one manager, one professor, one teammate beats three
    // classmates, and is what the request strategy is built to produce.
    distinctRelationships: new Set(recommendations.map((r) => lower(r.relationship).slice(0, 40)).filter(Boolean)).size,
  };
}

function analyseSkills(skills = []) {
  const endorsed = skills.filter((s) => (s.endorsements || 0) > 0);
  return {
    count: skills.length,
    names: skills.map((s) => s.name),
    endorsedCount: endorsed.length,
    // Near LinkedIn's 50-skill cap, a skills list stops being a signal and
    // becomes a wall — the relevant ones are buried among the rest.
    nearCap: skills.length >= T.SKILLS_MAX - 5,
    sparse: skills.length < T.SKILLS_MIN,
  };
}

/**
 * Everything the analysis needs to know about a profile, in one object.
 *
 * @param {object} profile normalised profile
 * @param {string[]} roleTerms title vocabulary for the target role
 */
function deriveSignals(profile = {}, roleTerms = []) {
  return {
    headline: analyseHeadline(profile.headline, roleTerms),
    about: analyseAbout(profile.about),
    experience: analyseExperience(profile.experience),
    education: {
      count: (profile.education || []).length,
      present: (profile.education || []).length > 0,
      withDetail: (profile.education || []).filter((e) => e.detail).length,
    },
    skills: analyseSkills(profile.skills),
    evidence: analyseEvidence(profile),
    recommendations: analyseRecommendations(profile.recommendations),
    presentation: {
      // null = the student was never asked, which is not a deduction.
      hasPhoto: profile.hasPhoto,
      hasBanner: profile.hasBanner,
      hasLocation: Boolean(profile.location),
      hasActivity: profile.hasActivity,
      openToWork: profile.openToWork,
    },
  };
}

module.exports = {
  deriveSignals,
  isQuantified,
  bulletsOf,
  lexiconHits,
  analyseHeadline,
  analyseAbout,
  analyseExperience,
  analyseEvidence,
  analyseRecommendations,
};
