/**
 * Server-side PDF rendering for a resume, so the "your resume is ready" email
 * can carry an actual attachment rather than just a link back to the app.
 *
 * Deliberately mirrors ResumePreviewPage.jsx section-for-section (same order,
 * same ATS-friendly single column, ink-on-white) so the mailed PDF and the
 * in-app "Download PDF" print never disagree about what the resume looks like.
 *
 * pdfkit over a headless-browser renderer (puppeteer et al.) on purpose: this
 * runs in the request path on a memory-capped free-tier dyno (see
 * DEPLOYMENT.md), and pdfkit draws text directly with no Chromium process.
 */

const path = require('path');
const PDFDocument = require('pdfkit');
const logger = require('./logger');

const PAGE_MARGIN = 54; // ~19mm, close to the on-screen A4 print margin
const INK = '#111827';
const MUTED = '#4b5563';
const RULE = '#9ca3af';

// ~27mm square — the passport-photo slot an Indian placement resume expects,
// small enough that the name and contact line still lead the page.
const PHOTO_SIZE = 76;
const PHOTO_GAP = 18;

// The renderer runs in the request path, so a CDN having a slow morning must
// cost the photo and not the resume. The cap is belt-and-braces: the upload
// route stores a 512px JPEG, which is an order of magnitude under this.
const PHOTO_TIMEOUT_MS = 4000;
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

// pdfkit embeds JPEG and PNG and throws "Unknown image format" on anything else.
// Checked here rather than trusted, so a bad byte stream is a resume without a
// photo instead of an exception on the path that mails a recruiter.
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const isEmbeddable = (buf) =>
  [JPEG, PNG].some((sig) => sig.every((b, i) => buf[i] === b));

/**
 * Pull the stored headshot back as bytes so pdfkit can draw it.
 *
 * Returns null — never throws — for every reason a photo might not render: no
 * photo, switched off, an unreachable CDN, a slow one, or bytes pdfkit cannot
 * read. Each of those is a resume that renders without the picture, which is
 * the correct outcome for an optional decoration.
 *
 * The host check is not there because the URL is untrusted in the ordinary
 * sense — it is written only by the upload route, straight from Cloudinary's
 * own response — but because it is a stored string that ends up in a
 * server-side fetch. Pinning it to https on our asset host keeps that from
 * being a way to aim this request somewhere internal if the field is ever
 * reachable by another path.
 */
async function fetchPhoto(photo) {
  if (!photo?.visible || !photo?.url) return null;

  let parsed;
  try {
    parsed = new URL(photo.url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !/(^|\.)cloudinary\.com$/.test(parsed.hostname)) {
    logger.warn('Resume photo skipped — not https on the asset host', {
      protocol: parsed.protocol,
      host: parsed.hostname,
    });
    return null;
  }

  try {
    const res = await fetch(parsed.href, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
    if (!res.ok) {
      logger.warn('Resume photo fetch failed', { status: res.status });
      return null;
    }

    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > PHOTO_MAX_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > PHOTO_MAX_BYTES || !isEmbeddable(buf)) return null;
    return buf;
  } catch (err) {
    logger.warn('Resume photo could not be loaded for the PDF', { error: err.message });
    return null;
  }
}

/**
 * Script handling.
 *
 * pdfkit's built-in Helvetica is a standard PDF font: WinAnsi-encoded, so it
 * cannot represent Tamil at all. Left alone it does not fail loudly — it emits
 * mojibake ("தட்சிணா" became "°KŸ¼Ûš»û£»â") and overruns the page, which is a
 * worse outcome than an error because it looks like a rendering glitch rather
 * than a broken resume.
 *
 * So text that needs it is drawn in an embedded Noto Sans Tamil, which covers
 * Latin *and* Tamil — mixed names like "Priya தட்சிணா" render in one run.
 * Helvetica stays the default for purely Latin text: it keeps the existing look
 * and pdfkit only embeds a font subset for faces actually used, so a resume with
 * no Tamil in it pays nothing for this.
 *
 * Only Latin and Tamil are covered. Another script (Devanagari, Telugu…) needs
 * its own Noto face added to FONT_FILES and selected in fontFor(); until then
 * such text renders as blank .notdef boxes rather than mojibake.
 */
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_FILES = {
  'Noto-Regular': path.join(FONT_DIR, 'NotoSansTamil-Regular.ttf'),
  'Noto-Bold': path.join(FONT_DIR, 'NotoSansTamil-Bold.ttf'),
};

// Anything that is not Latin and not script-neutral (digits, spaces, the
// `·` `—` `|` separators this layout uses) needs the embedded face. Matching on
// script rather than codepoint range matters: an em dash is U+2014 but is
// \p{Common} and renders fine in Helvetica, so it must not trigger a swap.
const NEEDS_EMBEDDED_FONT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

const LATIN = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
// Noto Sans Tamil ships no italic; the regular face stands in rather than
// letting a slanted sub-line silently fall back to mojibake.
const EMBEDDED = { regular: 'Noto-Regular', bold: 'Noto-Bold', italic: 'Noto-Regular' };

/** Pick a face for one run of text. `style` is regular | bold | italic. */
const fontFor = (text, style = 'regular') =>
  (NEEDS_EMBEDDED_FONT.test(String(text ?? '')) ? EMBEDDED : LATIN)[style];

const titleOf = (item) => (typeof item === 'string' ? item : item?.title || '');
const descOf = (item) => (typeof item === 'string' ? '' : item?.description || '');
const bullets = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * pdfkit carries the last-used `x` forward, so anything drawn after an indented
 * bullet inherits that indent. Every block-level helper resets to the margin
 * first rather than relying on whatever ran before it.
 */
const resetX = (doc) => {
  doc.x = doc.page.margins.left;
};

function sectionHeading(doc, label) {
  resetX(doc);
  if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
  doc.moveDown(0.6);
  doc
    .font(LATIN.bold) // headings are fixed ASCII labels
    .fontSize(10.5)
    .fillColor(INK)
    .text(label.toUpperCase(), { characterSpacing: 1.2 });
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor(RULE).lineWidth(0.75).stroke();
  doc.moveDown(0.5);
}

function entryRow(doc, { left, right, sub, subRight }) {
  resetX(doc);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;

  doc.font(fontFor(left, 'bold')).fontSize(10.5).fillColor(INK).text(left || '', { continued: false, width });
  if (right) {
    doc
      .font(fontFor(right))
      .fontSize(9)
      .fillColor(MUTED)
      .text(right, doc.page.margins.left, startY, { width, align: 'right' });
  }

  if (sub || subRight) {
    const subY = doc.y;
    doc.font(fontFor(sub, 'italic')).fontSize(9.5).fillColor(MUTED).text(sub || '', { width });
    if (subRight) {
      doc
        .font(fontFor(subRight))
        .fontSize(9)
        .fillColor(MUTED)
        .text(subRight, doc.page.margins.left, subY, { width, align: 'right' });
    }
  }
  doc.moveDown(0.35);
}

function bulletList(doc, items) {
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - 12;
  doc.fontSize(9.5).fillColor(INK);
  items.forEach((b) => {
    doc.font(fontFor(b)).text(`•  ${b}`, doc.page.margins.left + 12, doc.y, { width });
  });
  resetX(doc);
}

const CONTACT_SEP = '   |   ';

/**
 * Break the contact details into lines that fit, splitting only *between*
 * items.
 *
 * Left to pdfkit's own wrapping this is one long string, and it breaks wherever
 * a space happens to fall — which put the separator at the head of the next
 * line: a second line reading "|   priya.dev". The photo is what surfaced it,
 * since the picture takes ~90pt off the text column, but a student with a long
 * enough email and a portfolio URL could always hit it.
 *
 * Greedy rather than balanced: the first line should be as full as it can be,
 * so the common case stays a single line and the overflow is visibly a
 * remainder.
 *
 * @param {object} doc  a PDFDocument with the intended font and size applied
 * @returns {string[]}  one or more lines, none starting or ending with a separator
 */
function packContact(doc, items, maxWidth) {
  const lines = [];
  let current = '';

  for (const item of items) {
    const candidate = current ? current + CONTACT_SEP + item : item;
    // A single item wider than the column has nowhere better to go — it goes on
    // its own line and pdfkit wraps inside it as a last resort.
    if (current && doc.widthOfString(candidate) > maxWidth) {
      lines.push(current);
      current = item;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** A section that is nothing but bullets — certifications, achievements, leadership. */
function bulletSection(doc, label, lines) {
  sectionHeading(doc, label);
  bulletList(doc, lines);
}

/**
 * @param {object} resume  the normalised resume document (see resumeQuality.js)
 * @param {object} [opts]
 * @param {boolean} [opts.compress=true]  set false so tests can read the text
 *   back out of the content stream; production always compresses.
 * @returns {Promise<Buffer>}
 */
async function renderResumePdf(resume = {}, { compress = true } = {}) {
  // Awaited before the document exists: pdfkit draws synchronously, so the
  // image bytes have to be in hand before the header is laid out.
  const photo = await fetchPhoto(resume.photo);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, compress });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Registering is free — pdfkit only embeds a subset for faces actually
    // drawn with, so a resume with no Tamil in it carries no font data.
    for (const [name, file] of Object.entries(FONT_FILES)) doc.registerFont(name, file);

    const p = resume.personal || {};
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header. Two layouts, chosen by whether there is a photo to place:
    // centred name over a centred contact line when there is not — the original
    // and still the default — and name/contact flushed left beside a square
    // photo on the right when there is. Centring the text under an off-centre
    // picture is the one arrangement that reads as a mistake, so the block
    // moves rather than the photo squeezing into the middle of it.
    const headerTop = doc.y;
    const textWidth = photo ? width - PHOTO_SIZE - PHOTO_GAP : width;
    const headerAlign = photo ? 'left' : 'center';

    const fullName = p.fullName || 'Your Name';
    doc
      .font(fontFor(fullName, 'bold'))
      .fontSize(22)
      .fillColor(INK)
      // Tamil has no case, and uppercasing is a Latin-only convention; applying
      // it to Tamil is a no-op, so this stays safe for mixed names.
      .text(fullName.toUpperCase(), doc.page.margins.left, headerTop, {
        width: textWidth,
        align: headerAlign,
        characterSpacing: 1.5,
      });

    const contactItems = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean);
    if (contactItems.length) {
      doc.moveDown(0.3);
      doc.font(fontFor(contactItems.join(' '))).fontSize(9.5).fillColor(MUTED);
      for (const line of packContact(doc, contactItems, textWidth)) {
        doc.text(line, doc.page.margins.left, doc.y, { width: textWidth, align: headerAlign });
      }
    }

    if (photo) {
      try {
        doc.image(photo, doc.page.width - doc.page.margins.right - PHOTO_SIZE, headerTop, {
          fit: [PHOTO_SIZE, PHOTO_SIZE],
        });
      } catch (err) {
        // fetchPhoto screens the format, so reaching here means pdfkit rejected
        // bytes that looked valid — still not a reason to lose the resume.
        logger.warn('Resume photo could not be drawn', { error: err.message });
      }
      // A short name and no contact line leave the text block above the bottom
      // of the photo; without this the rule and Summary would run across it.
      doc.y = Math.max(doc.y, headerTop + PHOTO_SIZE);
      resetX(doc);
    }

    doc.moveDown(0.5);
    const ruleY = doc.y;
    doc.moveTo(doc.page.margins.left, ruleY).lineTo(doc.page.width - doc.page.margins.right, ruleY).strokeColor(INK).lineWidth(1.5).stroke();
    doc.moveDown(0.6);

    if (resume.summary) {
      sectionHeading(doc, 'Summary');
      doc.font(fontFor(resume.summary)).fontSize(9.5).fillColor(INK).text(resume.summary, { width, align: 'justify' });
    }

    if (resume.education?.length) {
      sectionHeading(doc, 'Education');
      resume.education.forEach((e) =>
        entryRow(doc, { left: e.degree, right: e.year || e.years, sub: e.institution, subRight: e.score })
      );
    }

    if (resume.experience?.length) {
      sectionHeading(doc, 'Experience');
      resume.experience.forEach((e) => {
        entryRow(doc, { left: e.role, right: e.duration, sub: e.organization || e.company });
        bulletList(doc, bullets(e.description));
        doc.moveDown(0.25);
      });
    }

    if (resume.projects?.length) {
      sectionHeading(doc, 'Projects');
      resume.projects.forEach((pr) => {
        entryRow(doc, { left: pr.title, right: pr.link });
        if (pr.description) doc.font(fontFor(pr.description)).fontSize(9.5).fillColor(INK).text(pr.description, { width });
        if (pr.technologies) {
          doc.moveDown(0.1);
          doc.font(fontFor(pr.technologies, 'italic')).fontSize(9).fillColor(MUTED).text(pr.technologies, { width });
        }
        doc.moveDown(0.25);
      });
    }

    if (resume.skills?.length) {
      sectionHeading(doc, 'Skills');
      const skillLine = resume.skills.join('  ·  ');
      doc.font(fontFor(skillLine)).fontSize(9.5).fillColor(INK).text(skillLine, { width });
    }

    if (resume.certifications?.length) {
      bulletSection(
        doc,
        'Certifications',
        resume.certifications.map((c) =>
          [c.name, c.issuer && `— ${c.issuer}`, c.year && `(${c.year})`].filter(Boolean).join(' ')
        )
      );
    }

    const titled = (items) =>
      items.map((it) => [titleOf(it), descOf(it) && `— ${descOf(it)}`].filter(Boolean).join(' '));

    if (resume.achievements?.length) bulletSection(doc, 'Achievements', titled(resume.achievements));
    if (resume.leadership?.length) {
      bulletSection(doc, 'Leadership & Extracurricular', titled(resume.leadership));
    }

    doc.end();
  });
}

// packContact is exported for tests: the bug it fixes — a wrapped contact line
// beginning with a separator — is invisible in the decoded page text, because
// reading that back strips the whitespace the line break lives in.
module.exports = { renderResumePdf, packContact };
