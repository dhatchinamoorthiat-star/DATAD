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

const PAGE_MARGIN = 54; // ~19mm, close to the on-screen A4 print margin
const INK = '#111827';
const MUTED = '#4b5563';
const RULE = '#9ca3af';

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
function renderResumePdf(resume = {}, { compress = true } = {}) {
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

    // Header
    const fullName = p.fullName || 'Your Name';
    doc
      .font(fontFor(fullName, 'bold'))
      .fontSize(22)
      .fillColor(INK)
      // Tamil has no case, and uppercasing is a Latin-only convention; applying
      // it to Tamil is a no-op, so this stays safe for mixed names.
      .text(fullName.toUpperCase(), { align: 'center', characterSpacing: 1.5 });

    const contactLine = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean).join('   |   ');
    if (contactLine) {
      doc.moveDown(0.3);
      doc.font(fontFor(contactLine)).fontSize(9.5).fillColor(MUTED).text(contactLine, { align: 'center' });
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

module.exports = { renderResumePdf };
