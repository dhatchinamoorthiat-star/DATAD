/**
 * LinkedIn "Save to PDF" export import.
 *
 * This is the best of the three import paths on provenance: the student
 * downloads their own data through LinkedIn's own feature, so there is no
 * scraping, no login, and nothing to copy on a phone screen.
 *
 * It is also the lossiest, and that is the thing this module exists to handle
 * honestly. The export carries Contact, About, Experience, Education,
 * Certifications, Honors and Publications — but only the *top three* skills,
 * and it omits Recommendations, Featured, Projects, Volunteering and activity
 * entirely.
 *
 * Score that naively and DATAD tells a student their skills list is sparse and
 * they have no recommendations, when in fact they may have twenty skills and
 * four recommendations that the export simply did not include. That is the
 * worst failure this feature could have: a confident, wrong, actionable
 * recommendation. So a PDF import records what the format cannot carry in
 * `unknownSections`, and the scorer skips those checks instead of failing them
 * (see score.js — unknown data can only cause a skip, never a deduction).
 *
 * The layout also differs from the web page in one way that silently corrupts
 * everything downstream if missed: the PDF prints the *company* as the block
 * heading with the job title beneath it, the reverse of the web UI. Hence
 * `orgFirst` on the shared experience parser.
 */

const {
  stripNoise, splitSections, neutralise,
  parseSkills, parseSimpleList, DATE_RANGE,
} = require('./parse');

// A LinkedIn export is a handful of pages of text. Well above any real one,
// well below anything that would tie up the event loop.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 30;

/**
 * Sections the PDF export cannot represent. Recorded on every PDF import so
 * the analysis can distinguish "you have none" from "we could not see any".
 *
 * `skills` is qualified rather than absolute: the export prints "Top Skills"
 * with three entries, so we do get skills, just never the full list — which
 * means a low count is an artefact of the format, not a finding about the
 * student.
 */
const PDF_UNKNOWN_SECTIONS = ['skills', 'recommendations', 'featured', 'projects', 'volunteer', 'activity'];

/**
 * Extract text from a PDF buffer.
 *
 * pdf-parse v2 exposes a class rather than v1's callable module, and holds
 * native resources until `destroy()` — so the call is wrapped here once and
 * every caller gets a plain string.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, pages: number, links: string[]}>}
 */
async function extractPdfText(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw badPdf('That file is empty.');
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw badPdf('That PDF is larger than 10 MB — a LinkedIn export is a few hundred kilobytes, so this is probably a different file.');
  }
  // Magic bytes. multer's fileFilter trusts the browser's Content-Type, which
  // the browser in turn takes from the file extension.
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw badPdf('That file is not a PDF.');
  }

  const { PDFParse } = require('pdf-parse');
  let parser;
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();

    if ((result.total || 0) > MAX_PDF_PAGES) {
      throw badPdf(`That PDF has ${result.total} pages. A LinkedIn export is usually two to five.`);
    }

    return {
      text: String(result.text || ''),
      pages: result.total || 0,
      // The export embeds real hyperlinks behind its display text, so the
      // portfolio and GitHub links can be read exactly rather than guessed at
      // by regex over text that may have been wrapped mid-URL.
      links: await extractEmbeddedLinks(parser),
    };
  } finally {
    // Not conditional on success: a parser left undestroyed on the error path
    // holds its worker until the process exits.
    await parser?.destroy?.().catch(() => {});
  }
}

async function extractEmbeddedLinks(parser) {
  try {
    const raw = await parser.getHyperlinks?.();
    const items = Array.isArray(raw) ? raw : raw?.hyperlinks || raw?.links || [];
    return [...new Set(
      items
        .map((l) => (typeof l === 'string' ? l : l?.url || l?.href))
        .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
        .map((u) => u.slice(0, 300))
    )].slice(0, 30);
  } catch {
    // Links are a bonus; the text extraction is the feature.
    return [];
  }
}

// Furniture the export prints on every page, plus pdf-parse's own page
// separators. Left in, "Page 2 of 4" lands mid-About and gets scored as the
// student's writing.
const PDF_NOISE = [
  /^page \d+ of \d+$/i,
  /^--\s*\d+ of \d+\s*--$/,
  /^\s*\d+\s*$/,
  // The export footers every page with the profile URL.
  /^\s*(www\.)?linkedin\.com\/in\/[\w-]+\s*$/i,
];

function stripPdfNoise(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !l || !PDF_NOISE.some((re) => re.test(l)))
    // LinkedIn prints a total under any company where you held several roles
    // ("2 years 10 months"). It is a rendering of the dates, not a field — and
    // on its own line it was being read as an employer name.
    .filter((l) => !AGGREGATE_DURATION.test(l))
    .join('\n')
    // A heading and its content can end up on different pages; collapsing the
    // gap left by a removed page break keeps the section together.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const AGGREGATE_DURATION = /^\d+\s*(years?|yrs?|months?|mos?)(\s+\d+\s*(months?|mos?))?$/i;

/**
 * Rejoin values the PDF wrapped across lines.
 *
 * This is the single most important step, and the one a synthetic fixture
 * cannot teach you: a real export wraps every long value at the column width,
 * so one field arrives as two or three lines. Every downstream parser then
 * reads the wrong thing — the tail of a job title becomes the title and its
 * head becomes the employer; a two-line certification becomes two
 * certifications; a two-line headline loses half of itself.
 *
 * There is no position data to lean on (pdf-parse's getText returns text
 * only), so the join is driven by signals in the text itself. Each is
 * conservative on its own; a line is only joined when one of them fires:
 *
 *   • an unclosed "(" — "…Lead (promoted from Operations" / "Manager…)"
 *   • a trailing conjunction or separator — ends with , & - / : ·
 *   • a continuation-shaped next line — starts lowercase, or with ")"
 *
 * Blank lines and date lines always break a join, since those are real record
 * boundaries.
 */
function reflow(text) {
  const lines = String(text).split('\n');
  const out = [];

  for (const raw of lines) {
    const line = raw.trim();
    const prev = out.length ? out[out.length - 1] : null;

    if (!line || prev === null || prev === '' || DATE_RANGE.test(line) || DATE_RANGE.test(prev)) {
      out.push(line);
      continue;
    }

    // A heading is a record boundary, never the start of a wrapped value.
    // Without this, "Contact" swallowed the email beneath it (lowercase start
    // reads as a continuation) and the Contact section stopped existing, which
    // is why a real import came back with no links at all.
    if (isHeadingLine(prev)) {
      out.push(line);
      continue;
    }

    const unclosedParen = (prev.match(/\(/g) || []).length > (prev.match(/\)/g) || []).length;
    // "@" belongs here too: a headline that reads "…Ex-Operations Head @" /
    // "CABPIL | B.Sc. Psychology…" breaks straight after the at-sign, and the
    // continuation starts with a capital letter, so no other signal fires.
    const danglingJoiner = /[,&\-/:·@]$/.test(prev);
    // Leading as well as trailing joiners. A real headline wrapped as
    // "…Behavioural Science, Finance" / "& Systems | Building Toward…", where
    // the break falls *before* the conjunction — so testing only the end of the
    // previous line missed it, and the orphaned second half was then read as
    // the headline while the first half became the person's name. The same rule
    // reattaches a company's bracketed acronym: "…India Limited" / "(CABPIL)".
    const leadingJoiner = /^[&|(/,]/.test(line);
    const continuationShaped = /^[a-z)]/.test(line) || leadingJoiner;

    if (unclosedParen || danglingJoiner || continuationShaped) {
      out[out.length - 1] = `${prev} ${line}`.replace(/\s+/g, ' ');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Rejoin wrapped entries inside a narrow sidebar list.
 *
 * The signals above do not fire on the sidebar's own wrapping, because it
 * breaks mid-phrase between two capitalised words: "Postive Psychiatry and
 * Mental" / "Health" is one certification, and nothing in the punctuation says
 * so. What does distinguish it is shape — a wrapped tail is almost always a
 * single word, while a genuine new entry in these lists reads as a phrase.
 *
 * Scoped to list sections only (certifications, awards, courses, languages).
 * It is never applied to experience descriptions, where a one-word line is
 * ordinary prose.
 */
function joinWrappedListEntries(lines) {
  const out = [];

  for (const line of lines) {
    const prev = out.length ? out[out.length - 1] : null;
    const isTail = prev
      && !/\s/.test(line)                 // a single word
      && /\s/.test(prev)                  // following a phrase
      && !/[.!?)]$/.test(prev);           // that did not look finished

    if (isTail) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }

  return out;
}

/**
 * Parse a LinkedIn PDF export into the normalised profile shape.
 *
 * @param {Buffer} buffer
 * @param {object} [hints] name/headline/location typed by the student
 * @returns {Promise<{profile: object, unknownSections: string[], meta: object}>}
 */
async function parseProfilePdf(buffer, hints = {}) {
  const { text, pages, links } = await extractPdfText(buffer);
  // reflow() before splitSections(): a wrapped heading would not match its
  // section name, and a wrapped value must be whole before anything parses it.
  const cleaned = reflow(stripPdfNoise(stripNoise(text)));
  // Identity is read first, then its lines are removed: they sit between the
  // last sidebar heading and "Summary", so they would otherwise be filed under
  // whichever sidebar section came last.
  const lines = cleaned.split('\n');
  const anchorIdx = lines.findIndex((l) => /^\s*(summary|experience)\s*$/i.test(l));
  const identity = readIdentity(lines, anchorIdx);

  // Cut the identity lines out by index rather than by matching their text:
  // they sit between the last sidebar heading and "Summary", so left in place
  // they are filed under whichever sidebar section came last — a real export
  // put the student's own name among their certifications. Matching by text
  // instead would also delete a headline phrase that legitimately recurs as a
  // job title further down.
  const body = anchorIdx > 0 && identity.count
    ? [...lines.slice(0, Math.max(anchorIdx - identity.count, 0)), ...lines.slice(anchorIdx)]
    : lines;

  const sections = splitSections(body.join('\n'));

  const profile = {
    name: str(hints.name, 120) || identity.name,
    headline: neutralise(str(hints.headline, 300) || identity.headline),
    location: str(hints.location, 120) || identity.location,
    about: neutralise(trim(sections.about, 6000)),
    experience: parseExperienceEntries(sections.experience)
      .map((e) => ({ ...e, description: neutralise(e.description) })),
    education: parseEducationEntries(sections.education),
    skills: parseSkills(sections.skills),
    certifications: pdfList(sections.certifications, 30),
    awards: pdfList(sections.awards, 15),
    publications: pdfList(sections.publications, 10),
    organizations: pdfList(sections.organizations, 10),
    courses: pdfList(sections.courses, 20, 160).map((c) => c.title),
    languages: pdfList(sections.languages, 10).map((l) => l.title),
    links: dedupeLinks([...links, ...contactLinks(sections.contact)]),

    // Absent from the export. Empty arrays here would be indistinguishable
    // from "the student has none", which is precisely the confusion
    // unknownSections exists to prevent.
    projects: [],
    featured: [],
    recommendations: [],
    volunteer: [],

    hasPhoto: null,
    hasBanner: null,
    hasActivity: null,
    openToWork: null,
  };

  return {
    profile,
    unknownSections: PDF_UNKNOWN_SECTIONS,
    meta: { pages, embeddedLinks: links.length },
  };
}

/**
 * Education entries.
 *
 * The export writes each as an institution followed by a combined line:
 *
 *   PSG Institute of Management
 *   Master of Business Administration · (August 2026 - August 2028)
 *
 * The shared parser looks for the first line carrying a date and files the
 * whole thing under `year`, so a real profile came back with the degree buried
 * inside the year field and truncated at its length cap — and with two schools
 * collapsed into one entry, the second school sitting in `degree`.
 *
 * Here the institution is whatever line has no dates, and a degree line is
 * split on the "·" the export puts between the degree and its dates.
 */
function parseEducationEntries(section) {
  if (!section) return [];

  const lines = String(section).split('\n').map((l) => l.trim()).filter(Boolean);
  const entries = [];

  for (const line of lines) {
    const dated = DATE_RANGE.test(line);

    if (!dated) {
      // A line with no dates starts a new school — unless the entry we are
      // building has not been given a degree yet, in which case this is it.
      const current = entries[entries.length - 1];
      if (current && !current.degree && !current.year) current.degree = str(line, 200);
      else entries.push({ institution: str(line, 200), degree: '', year: '', detail: '' });
      continue;
    }

    const current = entries[entries.length - 1] || (entries.push({ institution: '', degree: '', year: '', detail: '' }), entries[0]);
    const [degree, dates] = line.split('·').map((s) => s.trim());

    if (dates) {
      if (!current.degree) current.degree = str(degree, 200);
      current.year = str(dates.replace(/^\(|\)$/g, ''), 60);
    } else {
      // Dates only, no separator.
      current.year = str(line.replace(/^\(|\)$/g, ''), 60);
    }
  }

  return entries.filter((e) => e.institution || e.degree).slice(0, 12);
}

/**
 * List sections (certifications, awards, languages, courses).
 *
 * Same blank-line problem as experience, in a smaller form: the paste parser
 * groups these into blank-line-separated blocks so a certification can carry
 * its issuer on a second line. Where extraction loses the blank lines, that
 * turns "English / Tamil" into one entry titled English with Tamil as its
 * detail — the second language silently disappears.
 *
 * So the separator is chosen from the text itself: if the section contains a
 * blank line, entries really are blocks and multi-line entries are preserved;
 * if it does not, every line is its own entry.
 */
function pdfList(section, limit, max = 300) {
  if (!section) return [];
  if (/\n\s*\n/.test(section)) return parseSimpleList(section, limit, max);

  const lines = String(section).split('\n').map((l) => l.trim()).filter(Boolean);

  return joinWrappedListEntries(lines)
    .slice(0, limit)
    .map((title) => ({ title: str(title, max), detail: '' }));
}

/**
 * Experience entries, anchored on dates rather than on blank lines.
 *
 * The paste parser splits entries on blank lines, which is right for a web
 * copy. It is wrong here for two reasons, both observed rather than assumed:
 *
 *  1. Blank lines do not reliably survive PDF text extraction. Where they are
 *     lost, a blank-line split returns the entire Experience section as one
 *     entry with every other job buried in its description.
 *  2. The export nests promotions under a single company heading, so even with
 *     blank lines intact one block can hold several roles.
 *
 * The date line is the reliable landmark: every entry has exactly one. So each
 * date anchors an entry, the line above it is the job title, and the line above
 * that is the employer — unless it reads like prose, in which case this is a
 * second role at the employer already established, and that employer carries
 * forward.
 */
function parseExperienceEntries(section) {
  if (!section) return [];

  const lines = String(section).split('\n').map((l) => l.trim()).filter(Boolean);
  const dateAt = lines.map((l, i) => (DATE_RANGE.test(l) ? i : -1)).filter((i) => i > 0);
  if (!dateAt.length) return [];

  const entries = [];
  let carriedOrg = '';

  dateAt.forEach((d, n) => {
    const role = lines[d - 1] || '';

    // A line is an employer name if it is short and does not read as a
    // sentence. A description line ("Rebuilt the onboarding funnel report…")
    // fails both tests, which is what tells us a promotion is being nested.
    const above = d >= 2 ? lines[d - 2] : '';
    const isOrg = above && above.length <= 70 && !/[.;]$/.test(above) && above.split(/\s+/).length <= 8;
    const organization = isOrg ? above : carriedOrg;
    if (organization) carriedOrg = organization;

    // The body runs to the line before the next entry's first header line.
    const nextDate = dateAt[n + 1];
    const end = nextDate === undefined
      ? lines.length
      : Math.max(nextDate - (looksLikeOrg(lines[nextDate - 2]) ? 2 : 1), d + 1);

    const body = lines.slice(d + 1, end);
    // The first body line is often the office location, not a description.
    const location = body.length && isLocation(body[0]) ? body.shift() : '';

    entries.push({
      role: str(role, 200),
      organization: str(organization, 200),
      // "(3 months)" repeats what the dates already say.
      duration: str(String(lines[d]).replace(/\([^)]*\)\s*$/, '').replace(/·.*$/, '').trim(), 80),
      location: str(location, 120),
      employmentType: (String(role).match(/\b(internship|intern|part-time|full-time|contract|freelance)\b/i) || [''])[0],
      description: str(body.join('\n'), 4000),
    });
  });

  return entries.filter((e) => e.role || e.organization).slice(0, 25);
}

const looksLikeOrg = (line) => Boolean(line) && line.length <= 70 && !/[.;]$/.test(line) && line.split(/\s+/).length <= 8;

/**
 * A location line.
 *
 * "Chennai, Tamil Nadu, India" has commas — but LinkedIn also writes metro
 * areas with none at all ("Greater Coimbatore Area"), and requiring a comma is
 * what made a real profile come back with no location and the wrong name. So a
 * comma is one way to qualify, and the metro-area wording is another.
 */
const LOCATION_WORDS = /\b(area|region|district|india|remote|metropolitan)\b/i;

const isLocation = (line) =>
  Boolean(line)
  && line.length <= 80
  && !/[.;:|•]/.test(line)
  && (/,/.test(line) || LOCATION_WORDS.test(line));

/**
 * Name, headline and location.
 *
 * In the export these sit together immediately above "Summary" (or above
 * "Experience" for a profile with no About). Reading them positionally from
 * there is far more reliable than reading the top of the extracted text, which
 * is the Contact sidebar.
 */
function readIdentity(lines, anchorIdx) {
  const before = (anchorIdx > 0 ? lines.slice(0, anchorIdx) : lines)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !SIDEBAR_HEADINGS.has(l.toLowerCase()));

  // Walk backwards from the anchor. LinkedIn prints name, then headline, then
  // location, and reflow() has already rejoined a headline that wrapped — so
  // the structure is fixed once read from the bottom up.
  //
  // Blank lines cannot be used to delimit this block: PDF extraction does not
  // preserve them reliably, which an earlier paragraph-based version learned
  // the hard way by returning a certification as the student's name.
  const reversed = [...before].reverse();
  if (!reversed.length) return { name: '', headline: '', location: '', count: 0 };

  const hasLocation = isLocation(reversed[0]);
  const location = hasLocation ? reversed[0] : '';
  const rest = hasLocation ? reversed.slice(1) : reversed;

  const headline = rest[0] || '';
  const name = rest[1] || '';

  return {
    name: str(name, 120),
    headline: str(headline, 300),
    location: str(location, 120),
    // How many trailing lines the identity claimed, so the caller can cut them
    // out before sections are split.
    count: (hasLocation ? 1 : 0) + (headline ? 1 : 0) + (name ? 1 : 0),
  };
}

/** Section headings, used by reflow() to refuse a join across a boundary. */
const MAIN_HEADINGS = new Set(['summary', 'about', 'experience', 'education', 'skills', 'interests', 'projects']);
const isHeadingLine = (line) => {
  const l = String(line).trim().toLowerCase();
  return SIDEBAR_HEADINGS.has(l) || MAIN_HEADINGS.has(l);
};

// Sidebar block headings, which sit above the identity lines in the extracted
// text and must never be mistaken for them.
const SIDEBAR_HEADINGS = new Set(['contact', 'top skills', 'languages', 'certifications', 'honors-awards', 'publications']);

/** Email, phone and links out of the Contact sidebar. */
function contactLinks(block) {
  if (!block) return [];
  return (String(block).match(/\bhttps?:\/\/[^\s)]+|\b(?:www\.)[^\s)]+/gi) || [])
    .map((u) => u.replace(/[.,;)]+$/, ''))
    .slice(0, 15);
}

const LINK_KIND = [
  [/github\.com/i, 'github'],
  [/gitlab\.com/i, 'gitlab'],
  [/kaggle\.com/i, 'kaggle'],
  [/behance\.net|dribbble\.com/i, 'design portfolio'],
  [/medium\.com|substack\.com|hashnode/i, 'writing'],
  [/leetcode\.com|codeforces\.com|hackerrank\.com/i, 'competitive programming'],
  [/linkedin\.com/i, 'linkedin'],
  [/drive\.google\.com|docs\.google\.com|notion\.(so|site)/i, 'document'],
];

function dedupeLinks(urls) {
  const seen = new Map();
  for (const raw of urls) {
    const url = String(raw || '').replace(/[.,;)]+$/, '').slice(0, 300);
    if (!url || seen.has(url)) continue;
    seen.set(url, { url, kind: LINK_KIND.find(([re]) => re.test(url))?.[1] || 'other' });
    if (seen.size >= 20) break;
  }
  return [...seen.values()];
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const trim = (v, max) => str(v, max);

/** Carries a 400 so the controller can surface the reason to the student. */
function badPdf(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

module.exports = {
  parseProfilePdf,
  extractPdfText,
  stripPdfNoise,
  reflow,
  readIdentity,
  parseEducationEntries,
  parseExperienceEntries,
  PDF_UNKNOWN_SECTIONS,
  MAX_PDF_BYTES,
};
