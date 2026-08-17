/**
 * Red flags and authenticity analysis.
 *
 * Two rules govern everything in this file.
 *
 * First: nothing here accuses anyone of dishonesty. A date that does not parse
 * is a date that does not parse — it is far more often a formatting quirk than
 * a lie, and phrasing it as the latter is both wrong and insulting. Every
 * finding is written as an observation plus what a reader might conclude, and
 * carries a severity the UI uses to decide how prominently to show it.
 *
 * Second: this is not an AI-content detector. No reliable one exists, and
 * claiming otherwise would be a false accusation dressed as a feature. What is
 * measurable is *specificity* — whether the writing contains details that only
 * this person could have supplied. Low specificity is worth fixing whoever
 * wrote it, which is why the output is called authenticity & specificity.
 */

const { TEMPLATE_OPENERS, GENERIC_PHRASES, BUZZWORDS, T } = require('./knowledge');
const { isQuantified, lexiconHits } = require('./signals');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Parse "Jun 2024", "2024", "Present" into a comparable month index. */
function parsePoint(token) {
  const t = String(token || '').toLowerCase().trim();
  if (/present|current/.test(t)) return { value: Number.MAX_SAFE_INTEGER, present: true };
  const year = t.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  const y = parseInt(year[0], 10);
  const m = MONTHS.findIndex((mo) => t.startsWith(mo) || t.includes(` ${mo}`));
  return { value: y * 12 + (m >= 0 ? m : 0), year: y, present: false };
}

function parseRange(duration) {
  const parts = String(duration || '').split(/[-–—]|\bto\b/i);
  if (parts.length < 2) return null;
  const from = parsePoint(parts[0]);
  const to = parsePoint(parts[1]);
  return from && to ? { from, to } : null;
}

/**
 * @param {object} profile normalised profile
 * @param {object} signals output of deriveSignals()
 * @param {object} [datadContext] the student's DATAD resume, for cross-checking
 * @returns {{flags: Array, authenticity: object}}
 */
function detectRedFlags(profile = {}, signals = {}, datadContext = null) {
  const flags = [];
  const add = (severity, key, issue, note) => flags.push({ key, severity, issue, note });

  // ── Dates ────────────────────────────────────────────────────────────────
  const ranges = [];
  for (const e of profile.experience || []) {
    const range = parseRange(e.duration);
    if (!range) {
      if (e.duration) {
        add('low', `date_unparsed_${ranges.length}`,
          `The dates on "${e.role || e.organization}" are in a format that is hard to read at a glance.`,
          'Use LinkedIn\'s month + year picker so the duration renders consistently.');
      }
      continue;
    }
    if (range.to.value < range.from.value) {
      add('medium', `date_reversed_${ranges.length}`,
        `"${e.role || e.organization}" appears to end before it starts.`,
        'Almost always a typo in the year. Worth correcting — a recruiter who notices it stops reading.');
    }
    if (!range.to.present && range.to.value - range.from.value > 12 * 15) {
      add('low', `date_long_${ranges.length}`,
        `"${e.role || e.organization}" spans an unusually long period.`,
        'Check the start year is right.');
    }
    ranges.push({ ...range, entry: e });
  }

  // Gaps. Only flagged over a year and only for a student who has finished
  // studying — a gap during a degree is study, and calling it a gap is noise.
  const sorted = ranges.filter((r) => !r.to.present).sort((a, b) => a.from.value - b.from.value);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].from.value - sorted[i - 1].to.value;
    if (gap >= 14) {
      add('low', `gap_${i}`,
        `There is roughly a ${Math.round(gap / 12)}-year gap between "${sorted[i - 1].entry.role}" and "${sorted[i].entry.role}".`,
        'A gap needs no justification, but a one-line note about what you were doing stops a reader guessing.');
    }
  }

  // ── Empty and thin entries ───────────────────────────────────────────────
  const empty = (profile.experience || []).filter((e) => !String(e.description || '').trim());
  if (empty.length) {
    add(empty.length > 1 ? 'medium' : 'low', 'empty_experience',
      `${empty.length} experience ${empty.length === 1 ? 'entry has' : 'entries have'} no description.`,
      'An entry with only a title reads as filler and dilutes the entries you did write.');
  }

  // ── Unsupported claims ───────────────────────────────────────────────────
  const aboutClaims = /\b(expert|expertise|mastery|extensive experience|years of experience|proven track record|industry[- ]leading|award[- ]winning)\b/i;
  if (aboutClaims.test(profile.about || '') && !isQuantified(profile.about)) {
    add('medium', 'unsupported_claim',
      'Your About claims a level of expertise but does not show the work behind it.',
      'A claim without evidence next to it is discounted. Follow each claim with the specific thing that demonstrates it.');
  }

  // A student profile claiming senior seniority is usually a mis-set field
  // rather than an inflated claim, so it is phrased as a question.
  const seniorTitles = (profile.experience || []).filter((e) => /\b(senior|lead|head of|director|vp|chief)\b/i.test(e.role || ''));
  const graduating = (profile.education || []).some((e) => /202[5-9]|203\d/.test(e.year || ''));
  if (seniorTitles.length && graduating) {
    add('low', 'seniority_mismatch',
      `Your profile carries a senior-sounding title (${seniorTitles[0].role}) alongside an in-progress degree.`,
      'If the title is accurate, add a line of context. If it was a student-body or club role, say so — the context makes it more impressive, not less.');
  }

  // ── Keyword stuffing ─────────────────────────────────────────────────────
  if ((signals.headline?.separators || 0) >= T.HEADLINE_KEYWORD_MAX) {
    add('medium', 'headline_stuffed',
      'Your headline is a list of terms rather than a statement.',
      'Search ranking does not reward density, and a human reader skips it.');
  }

  // ── Cross-check against DATAD's own record ───────────────────────────────
  // Only surfaced as a prompt to reconcile. DATAD's resume is not authoritative
  // over LinkedIn — a student may have updated one and not the other, in either
  // direction — so the flag asks which is current rather than asserting one.
  if (datadContext) {
    const liSkills = new Set((profile.skills || []).map((s) => s.name.toLowerCase()));
    const missing = (datadContext.skills || []).filter((s) => !liSkills.has(String(s).toLowerCase()));
    if (missing.length >= 3) {
      add('low', 'skills_out_of_sync',
        `${missing.length} skills on your DATAD resume are absent from LinkedIn (${missing.slice(0, 4).join(', ')}).`,
        'Recruiters filter LinkedIn on skills. If these are still true, they are worth adding.');
    }

    const liOrgs = new Set((profile.experience || []).map((e) => (e.organization || '').toLowerCase()).filter(Boolean));
    const missingRoles = (datadContext.experience || [])
      .filter((e) => e.organization && !liOrgs.has(e.organization.toLowerCase()));
    if (missingRoles.length) {
      add('low', 'experience_out_of_sync',
        `Your DATAD resume lists ${missingRoles.length} ${missingRoles.length === 1 ? 'role' : 'roles'} that do not appear on LinkedIn (${missingRoles.slice(0, 2).map((r) => r.organization).join(', ')}).`,
        'Whichever is current, the two should agree — a recruiter comparing them will notice.');
    }
  }

  return { flags: flags.slice(0, 20), authenticity: analyzeAuthenticity(profile) };
}

/**
 * Authenticity & Specificity Analysis.
 *
 * Measures how much of the writing could only have been written by this
 * person. The score is a *specificity* score, not a probability that a model
 * wrote it, and the copy in the UI says so.
 */
function analyzeAuthenticity(profile) {
  const about = String(profile.about || '');
  const experienceText = (profile.experience || []).map((e) => e.description).join('\n');
  const combined = `${about}\n${experienceText}`;
  const wordCount = combined.split(/\s+/).filter(Boolean).length;

  if (wordCount < 40) {
    return {
      assessable: false,
      note: 'There is not enough written content to assess specificity.',
      observations: [],
      specificity: null,
    };
  }

  const observations = [];

  const templates = lexiconHits(combined, TEMPLATE_OPENERS);
  if (templates.count) {
    observations.push({
      kind: 'template_phrasing',
      detail: `Phrasing that appears in a great many profiles: ${templates.hits.join('; ')}.`,
    });
  }

  const generic = lexiconHits(combined, GENERIC_PHRASES);
  if (generic.count >= 2) {
    observations.push({
      kind: 'generic_language',
      detail: `${generic.count} stock phrases (${generic.hits.slice(0, 3).join('; ')}) that describe no particular person.`,
    });
  }

  const buzz = lexiconHits(combined, BUZZWORDS);
  if (wordCount && buzz.count / wordCount > T.BUZZWORD_DENSITY_FLAG) {
    observations.push({
      kind: 'buzzword_density',
      detail: `${buzz.count} promotional adjectives in ${wordCount} words — a reader cannot verify any of them.`,
    });
  }

  // Proper nouns, tools and numbers are what make writing specific. Their
  // absence is the signal; their presence is what a rewrite should preserve.
  const properNouns = new Set((combined.match(/\b[A-Z][a-z]{2,}\b/g) || []).filter((w) => !SENTENCE_STARTERS.has(w)));
  const numbers = (combined.match(/\b\d[\d,.]*\b/g) || []).length;

  if (properNouns.size < 3) {
    observations.push({
      kind: 'few_specifics',
      detail: 'Almost no named tools, organisations or products appear, so nothing anchors the writing to real work.',
    });
  }
  if (!numbers) {
    observations.push({
      kind: 'no_numbers',
      detail: 'No figures anywhere — scale, duration and result are all left to the reader\'s imagination.',
    });
  }

  // Repeated sentence openings — three or more identical first words is the
  // rhythm of a template rather than of someone writing.
  const openings = combined.split(/(?<=[.!?])\s+/).map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
  const openingCounts = openings.reduce((m, w) => m.set(w, (m.get(w) || 0) + 1), new Map());
  const repeated = [...openingCounts.entries()].filter(([, n]) => n >= 4);
  if (repeated.length) {
    observations.push({
      kind: 'repetitive_structure',
      detail: `${repeated.length === 1 ? 'A sentence opening repeats' : 'Sentence openings repeat'} throughout (${repeated.map(([w]) => `"${w}…"`).join(', ')}), which flattens the writing.`,
    });
  }

  // Specificity, not authorship: what fraction of the available specificity
  // markers this writing actually carries.
  const markers = [
    properNouns.size >= 3,
    numbers > 0,
    !templates.count,
    generic.count < 2,
    wordCount ? buzz.count / wordCount <= T.BUZZWORD_DENSITY_FLAG : true,
    !repeated.length,
  ];
  const specificity = Math.round((markers.filter(Boolean).length / markers.length) * 100);

  return {
    assessable: true,
    specificity,
    observations,
    note: 'This measures how specific and personal the writing is. It does not, and cannot, determine who or what wrote it.',
  };
}

// Common sentence-initial words that the proper-noun heuristic would otherwise
// count as named entities.
const SENTENCE_STARTERS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'My', 'Our', 'Their', 'His', 'Her',
  'After', 'Before', 'During', 'While', 'When', 'Currently', 'Recently', 'Today',
  'With', 'Without', 'Through', 'Across', 'From', 'Since', 'Over', 'Working',
  'Building', 'Passionate', 'Experienced', 'Skilled', 'Motivated', 'Looking',
]);

module.exports = { detectRedFlags, analyzeAuthenticity, parseRange };
