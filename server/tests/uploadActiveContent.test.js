/**
 * Regression tests for the active-content upload bypass.
 *
 * checkFile() screened for markup by testing whether the first 64 bytes *began*
 * with one of <!doctype html, <html, <?xml, <svg or <script. Prefixing the file
 * with an HTML comment moved the real first element past that window, and the
 * check saw only the comment.
 *
 * That mattered specifically for SVG. SVG has no magic number, so the signature
 * table has no entry for image/svg+xml and falls through to "unfingerprintable
 * — allowed"; the prefix test was the only thing standing in front of it. And
 * upload.js accepted anything matching `image/*`, so image/svg+xml was a valid
 * avatar, album photo or resume headshot type. SVG executes script when a CDN
 * serves it as image/svg+xml and the file is opened directly.
 *
 * Two independent fixes, either of which closes it:
 *   1. normalizeHead() strips leading comments before matching, and a second
 *      pass looks for <script/<svg anywhere in the first kilobyte.
 *   2. upload.js rejects the SVG mime types outright.
 *
 * Both are tested here — defence in depth is only defence if each layer works
 * on its own.
 */

const { checkFile } = require('../middleware/uploadGuards');
const upload = require('../middleware/upload');

const file = (mimetype, content, originalname = 'payload') => ({
  mimetype,
  originalname,
  buffer: Buffer.from(content),
  size: Buffer.byteLength(content),
});

const SVG_XSS =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">' +
  '<script>alert(1)</script></svg>';

describe('layer 1 — checkFile sees through comment padding', () => {
  test.each([
    ['a bare SVG', SVG_XSS],
    ['one leading comment', `<!-- harmless -->${SVG_XSS}`],
    ['leading whitespace then a comment', `\n\n   <!--x-->${SVG_XSS}`],
    ['several stacked comments', `<!--a--><!--b--><!--c-->${SVG_XSS}`],
    // Long enough to push the payload past the old 64-byte window entirely.
    ['a comment longer than the old window', `<!--${'x'.repeat(900)}-->${SVG_XSS}`],
    ['an unterminated comment', `<!--${SVG_XSS}`],
  ])('rejects SVG hidden behind %s', (_label, content) => {
    expect(checkFile(file('image/svg+xml', content))).toBeTruthy();
  });

  test('rejects HTML declared as a PNG', () => {
    expect(checkFile(file('image/png', '<!--x--><html><script>alert(1)</script></html>'))).toBeTruthy();
  });

  test('rejects a script element buried in something claiming to be a PDF', () => {
    // Passes the %PDF prefix test but carries markup in the head.
    const content = `%PDF-1.7\n${' '.repeat(50)}<script>alert(1)</script>`;
    expect(checkFile(file('application/pdf', content))).toBeTruthy();
  });
});

describe('layer 1 — genuine files are still accepted', () => {
  const withHeader = (bytes, padding = 200) =>
    Buffer.concat([Buffer.from(bytes), Buffer.alloc(padding)]);

  test('a real PNG passes', () => {
    expect(checkFile({
      mimetype: 'image/png',
      originalname: 'photo.png',
      buffer: withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      size: 208,
    })).toBeNull();
  });

  test('a real PDF passes', () => {
    const buffer = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200)]);
    expect(checkFile({ mimetype: 'application/pdf', originalname: 'cv.pdf', buffer, size: buffer.length })).toBeNull();
  });

  test('a real DOCX passes', () => {
    expect(checkFile({
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalname: 'cv.docx',
      buffer: withHeader([0x50, 0x4b, 0x03, 0x04]),
      size: 204,
    })).toBeNull();
  });

  test('plain text is still unfingerprintable and allowed', () => {
    expect(checkFile(file('text/plain', 'just some notes about WACC'))).toBeNull();
  });
});

describe('layer 2 — the image filter refuses SVG outright', () => {
  const runFilter = (mimetype) =>
    new Promise((resolve) => {
      upload.fileFilter({}, { mimetype, originalname: 'avatar' }, (err, accepted) =>
        resolve(err ? { rejected: true, message: err.message } : { rejected: !accepted })
      );
    });

  test.each(['image/svg+xml', 'image/svg'])('%s is rejected', async (mimetype) => {
    const result = await runFilter(mimetype);
    expect(result.rejected).toBe(true);
  });

  test.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])(
    '%s is still accepted',
    async (mimetype) => {
      expect((await runFilter(mimetype)).rejected).toBe(false);
    }
  );

  test('non-images are still rejected', async () => {
    expect((await runFilter('application/pdf')).rejected).toBe(true);
  });
});
