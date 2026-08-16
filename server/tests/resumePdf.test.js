/**
 * The PDF is now the deliverable — it is attached to the submission email and
 * served by GET /resume/pdf — so a renderer that throws costs a student their
 * resume, and one that silently drops a section is worse: nothing errors and the
 * student mails a recruiter a resume with their experience missing.
 *
 * These tests pin down that every populated section reaches the page, that the
 * legacy field spellings (`years`, `company`, bare-string achievements) still
 * render, and that sparse or hostile input produces a valid document instead of
 * throwing.
 */

const { renderResumePdf } = require('../utils/resumePdf');
const sample = require('./fixtures/resume.sample');

/**
 * Assert on the text a reader actually sees rather than on raw bytes.
 *
 * Rendered with `compress: false`, pdfkit emits each run as hex strings inside
 * TJ arrays (`[<50524959> 110 <4120...>] TJ`), so decoding every `<hex>` token
 * and concatenating reconstructs the page text. Whitespace is then stripped,
 * because kerning splits runs at arbitrary points and headings are drawn with
 * letter-spacing — the assertions are about content, not typography.
 *
 * (pdf-parse would read this more directly, but its pdfjs build needs
 * --experimental-vm-modules under Jest.)
 */
const textOf = async (resume) => {
  const buf = await renderResumePdf(resume, { compress: false });
  const raw = buf.toString('latin1');
  const tokens = raw.match(/<([0-9a-fA-F]+)>/g) || [];
  return tokens
    .map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1'))
    .join('')
    .replace(/\s+/g, '');
};

describe('renderResumePdf', () => {
  it('produces a valid PDF', async () => {
    const buf = await renderResumePdf(sample);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('renders every populated section heading', async () => {
    const text = await textOf(sample);
    for (const heading of [
      'SUMMARY',
      'EDUCATION',
      'EXPERIENCE',
      'PROJECTS',
      'SKILLS',
      'CERTIFICATIONS',
      'ACHIEVEMENTS',
      'LEADERSHIP',
    ]) {
      expect(text).toContain(heading);
    }
  });

  it('omits headings for sections the student left empty', async () => {
    const text = await textOf({ personal: { fullName: 'Solo Student' } });
    for (const heading of ['SUMMARY', 'EXPERIENCE', 'PROJECTS', 'CERTIFICATIONS']) {
      expect(text).not.toContain(heading);
    }
  });

  it('renders documents saved before the field rename', async () => {
    // `years` and `company` are the pre-migration spellings; achievements were
    // bare strings. All three must still reach the page.
    const legacy = {
      personal: { fullName: 'Old Record' },
      education: [{ degree: 'B.Com', institution: 'X College', years: '2019 to 2022' }],
      experience: [{ role: 'Analyst', company: 'Acme Corp', description: 'Did the thing.' }],
      achievements: ['Dean list'],
    };
    const text = await textOf(legacy);
    expect(text).toContain('2019to2022');
    expect(text).toContain('AcmeCorp');
    expect(text).toContain('Deanlist');
  });

  it('does not throw on an empty or malformed resume', async () => {
    await expect(renderResumePdf({})).resolves.toBeInstanceOf(Buffer);
    await expect(renderResumePdf()).resolves.toBeInstanceOf(Buffer);
    await expect(
      renderResumePdf({ skills: ['ok'], experience: [{ role: 'R', description: null }] })
    ).resolves.toBeInstanceOf(Buffer);
  });

  /**
   * A Tamil name used to render as mojibake ("தட்சிணா" → "°KŸ¼Ûš»û£»â") and run
   * off the page, because pdfkit's built-in Helvetica is WinAnsi-encoded. It
   * failed silently, which made it look like a rendering glitch rather than a
   * resume the student could not send.
   */
  describe('non-Latin names', () => {
    const tamil = {
      personal: { fullName: 'தட்சிணா மூர்த்தி', location: 'சென்னை' },
      education: [{ degree: 'தகவல் தொழில்நுட்பம் B.Tech', institution: 'அண்ணா பல்கலைக்கழகம்' }],
      achievements: [{ title: 'வென்றவர், Smart India Hackathon' }],
    };

    it('embeds a Unicode face so Tamil renders instead of mojibake', async () => {
      const buf = await renderResumePdf(tamil);
      expect(buf.slice(0, 5).toString()).toBe('%PDF-');
      expect(buf.toString('latin1')).toContain('NotoSansTamil');
    });

    it('handles a name mixing both scripts in one run', async () => {
      const buf = await renderResumePdf({ personal: { fullName: 'Priya தட்சிணா' } });
      expect(buf.toString('latin1')).toContain('NotoSansTamil');
    });

    it('costs a Latin-only resume nothing', async () => {
      // The sample carries em dashes, `·` and `|`. Those are script-neutral and
      // render fine in Helvetica, so they must not drag the font in.
      const buf = await renderResumePdf(sample);
      expect(buf.toString('latin1')).not.toContain('NotoSansTamil');
    });
  });

  describe('download filename', () => {
    const { pdfFilename } = require('../controllers/resumeController');

    it('keeps letters from any script', () => {
      // `\w` is ASCII-only, so this used to erase the name entirely and hand
      // the student a file called `resume-Resume.pdf`.
      expect(pdfFilename({ personal: { fullName: 'தட்சிணா மூர்த்தி' } })).toBe(
        'தட்சிணா-மூர்த்தி-Resume.pdf'
      );
      expect(pdfFilename({ personal: { fullName: 'Priya Sharma' } })).toBe('Priya-Sharma-Resume.pdf');
    });

    it('strips characters that would break the Content-Disposition header', () => {
      const name = pdfFilename({ personal: { fullName: 'a"b/../c\r\nX' } });
      expect(name).not.toMatch(/["/\\\r\n]/);
    });

    it('falls back when a name has no usable characters', () => {
      expect(pdfFilename({ personal: { fullName: '///' } })).toBe('resume-Resume.pdf');
      expect(pdfFilename({})).toBe('resume-Resume.pdf');
    });
  });

  it('paginates rather than truncating a long resume', async () => {
    const long = {
      ...sample,
      experience: Array.from({ length: 25 }, (_, i) => ({
        role: `Role Number ${i}`,
        organization: `Organisation ${i}`,
        duration: '2024',
        description: Array.from({ length: 6 }, (_, j) => `Bullet ${j} for role ${i}.`).join('\n'),
      })),
    };
    const buf = await renderResumePdf(long);
    // /Type /Page (singular, not /Pages) appears once per page.
    const pages = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || [];
    expect(pages.length).toBeGreaterThan(1);
  });
});
