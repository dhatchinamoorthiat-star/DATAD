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
  // Cut the trailer first. `/ID [<…> <…>]` is hex too, and it is derived from
  // the creation time — so left in, it decodes to a tail of random bytes and
  // two renders of the same resume never compare equal.
  const raw = buf.toString('latin1').split('/ID')[0];
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

  /**
   * The headshot is the one part of the document whose bytes come from off the
   * box, in the request path, on the render that mails a recruiter. So the
   * contract under test is mostly about what does *not* happen: no reachable
   * CDN, no photo, no odd host and no unreadable file may cost the student the
   * resume itself.
   */
  describe('optional photo', () => {
    const realFetch = global.fetch;
    // A 1x1 JPEG. Only the leading bytes matter to the format screen, and pdfkit
    // reads the SOF0 block for the dimensions.
    const JPEG_1PX = Buffer.from(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      'base64'
    );
    const photoOf = (url) => ({ personal: { fullName: 'With Photo' }, photo: { url, visible: true } });
    const CDN = 'https://res.cloudinary.com/demo/image/upload/x.jpg';

    const stubFetch = (impl) => {
      global.fetch = jest.fn(impl);
    };

    afterEach(() => {
      global.fetch = realFetch;
    });

    it('embeds the photo when the CDN serves it', async () => {
      stubFetch(async () => new Response(JPEG_1PX, { status: 200 }));
      const buf = await renderResumePdf(photoOf(CDN));
      expect(buf.slice(0, 5).toString()).toBe('%PDF-');
      // pdfkit writes an embedded JPEG as an XObject with a DCTDecode filter.
      expect(buf.toString('latin1')).toContain('DCTDecode');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('renders the resume anyway when the fetch fails or is slow', async () => {
      for (const impl of [
        async () => {
          throw new Error('ECONNRESET');
        },
        async () => new Response('nope', { status: 404 }),
      ]) {
        stubFetch(impl);
        const text = await textOf(photoOf(CDN));
        expect(text).toContain('WITHPHOTO');
      }
    });

    it('does not fetch a photo the student switched off', async () => {
      stubFetch(async () => new Response(JPEG_1PX, { status: 200 }));
      await renderResumePdf({ personal: { fullName: 'Hidden' }, photo: { url: CDN, visible: false } });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refuses a url that is not https on the asset host', async () => {
      stubFetch(async () => new Response(JPEG_1PX, { status: 200 }));
      for (const url of [
        'http://res.cloudinary.com/demo/x.jpg', // plain http
        'https://cloudinary.com.evil.test/x.jpg', // suffix that only looks like ours
        'https://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'not a url at all',
      ]) {
        await expect(renderResumePdf(photoOf(url))).resolves.toBeInstanceOf(Buffer);
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects bytes pdfkit could not embed rather than throwing on them', async () => {
      // A WebP: a real image, and one pdfkit has no decoder for. Left to reach
      // doc.image() it raises "Unknown image format" and takes the resume down.
      stubFetch(async () => new Response(Buffer.from('RIFF....WEBPVP8 '), { status: 200 }));
      const text = await textOf(photoOf(CDN));
      expect(text).toContain('WITHPHOTO');
    });

    /**
     * The photo takes ~90pt off the text column, which is what first pushed the
     * contact details onto a second line — and pdfkit, wrapping one long string,
     * broke it wherever a space fell. That produced a line reading "|  priya.dev".
     * The photo only surfaced it: a long enough email plus a portfolio URL could
     * always overflow the full-width column too.
     */
    describe('contact line wrapping', () => {
      const PDFDocument = require('pdfkit');
      const { packContact } = require('../utils/resumePdf');
      const SEP = '   |   ';

      // A document with the same face and size the header uses, so
      // widthOfString measures what actually gets drawn.
      const doc = () => {
        const d = new PDFDocument({ size: 'A4', margin: 54 });
        d.font('Helvetica').fontSize(9.5);
        return d;
      };

      const items = ['priya@example.edu', '+91 98765 43210', 'Chennai, IN', 'linkedin.com/in/priyasharma', 'priya.dev'];

      it('keeps everything on one line when it fits', () => {
        expect(packContact(doc(), items, 600)).toEqual([items.join(SEP)]);
      });

      it('never starts or ends a line with the separator', () => {
        // 400pt is roughly the column left beside a photo.
        for (const width of [200, 300, 400, 500]) {
          const lines = packContact(doc(), items, width);
          expect(lines.length).toBeGreaterThan(0);
          for (const line of lines) {
            expect(line).toBe(line.trim());
            expect(line.startsWith('|')).toBe(false);
            expect(line.endsWith('|')).toBe(false);
          }
        }
      });

      it('keeps every detail, in order, however it splits', () => {
        const lines = packContact(doc(), items, 260);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join(SEP).split(SEP)).toEqual(items);
      });

      it('gives an item wider than the column a line to itself', () => {
        const long = 'a'.repeat(300);
        expect(packContact(doc(), ['short', long], 100)).toEqual(['short', long]);
      });
    });

    it('leaves the centred header alone when there is no photo', async () => {
      // The layout swap is conditional; a resume without a photo must be
      // byte-for-byte what it was before the feature existed.
      const plain = { ...sample, photo: undefined };
      await expect(renderResumePdf(plain)).resolves.toBeInstanceOf(Buffer);
      expect(await textOf(plain)).toBe(await textOf(sample));
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
