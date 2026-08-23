/**
 * Text extraction (stage A of studio analysis, and now Dax attachments).
 *
 * This suite exists because every branch of this module failed silently. The
 * extractor is best-effort by design — it catches and returns empty text so a
 * bad file never aborts a publish — and that same handler was swallowing a
 * total failure: pdf-parse v2 exports a PDFParse class, this module still
 * called it the v1 way (`pdfParse(buffer)`), and the resulting TypeError came
 * back as `{ text: '' }`. A PDF that could not be parsed at all was
 * indistinguishable from a PDF with no text in it, so nothing reported it.
 *
 * pdf-parse is mocked here rather than driven for real. Not for speed: its
 * pdf.js build pulls in @napi-rs/canvas, whose native binding does not load
 * inside jest's VM, so a "real" PDF test would assert on the sandbox rather
 * than on this module. The mock is shaped like the actual v2 export, which
 * makes it a precise guard for the bug that occurred — a v1-style call cannot
 * pass it. End-to-end PDF reading is covered by exercising the live
 * /api/dax/attachments/extract endpoint against a generated PDF.
 */

// jest.mock is hoisted above these declarations, so the factory may only close
// over names beginning with `mock` — hence the prefixes.
const mockGetText = jest.fn();
const mockDestroy = jest.fn().mockResolvedValue(undefined);
const mockCtorArgs = [];

jest.mock('pdf-parse', () => ({
  PDFParse: class {
    constructor(opts) { mockCtorArgs.push(opts); }
    getText(...a) { return mockGetText(...a); }
    destroy() { return mockDestroy(); }
  },
}));

const { extract } = require('../services/publishing/extractors');

beforeEach(() => {
  mockGetText.mockReset();
  mockDestroy.mockClear();
  mockCtorArgs.length = 0;
});

describe('extract: pdf', () => {
  test('constructs PDFParse with the buffer and reads via getText', async () => {
    mockGetText.mockResolvedValue({
      text: 'Unit 1: Greedy algorithms and the exchange argument.',
      total: 3,
    });
    const buffer = Buffer.from('%PDF-1.7');

    const result = await extract('pdf', buffer);

    // The v2 contract: a constructor taking { data }, not a callable.
    expect(mockCtorArgs).toHaveLength(1);
    expect(mockCtorArgs[0].data).toBe(buffer);
    expect(result.text).toContain('Greedy algorithms');
    expect(result.pageCount).toBe(3);
    expect(result.extractionError).toBeUndefined();
  });

  test('releases the pdf.js worker even when parsing throws', async () => {
    mockGetText.mockRejectedValue(new Error('bad xref table'));
    const result = await extract('pdf', Buffer.from('junk'));

    expect(result.text).toBe('');
    expect(result.extractionError).toBe('bad xref table');
    expect(result.unsupported).toBe(false);
    // Without this the worker stays open and the process will not exit.
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  test('almost no text per page reads as scanned rather than as empty', async () => {
    mockGetText.mockResolvedValue({ text: 'x', total: 4 });
    expect((await extract('pdf', Buffer.from('%PDF'))).handwritten).toBe(true);

    mockGetText.mockResolvedValue({ text: 'y'.repeat(400), total: 4 });
    expect((await extract('pdf', Buffer.from('%PDF'))).handwritten).toBe(false);
  });

  test('falls back to the page array when total is absent', async () => {
    mockGetText.mockResolvedValue({ text: 'hello', pages: [{}, {}] });
    expect((await extract('pdf', Buffer.from('%PDF'))).pageCount).toBe(2);
  });
});

describe('extract: everything else', () => {
  test('plain text and markdown need no dependency at all', async () => {
    const body = 'Attendance policy: 75% minimum.';
    expect((await extract('text', Buffer.from(body))).text).toBe(body);
    expect((await extract('markdown', Buffer.from('# Title'))).text).toBe('# Title');
  });

  test('an unknown type is empty but is not an error', async () => {
    const result = await extract('image', Buffer.from('notanimage'));
    expect(result.text).toBe('');
    expect(result.extractionError).toBeUndefined();
  });

  test('a format whose dependency is absent says so instead of looking empty', async () => {
    // mammoth, xlsx and adm-zip are not in package.json, so these branches have
    // never run in this deployment. The distinction matters to callers: "this
    // format is not supported here" reads differently to a student than "this
    // file had no text in it".
    for (const type of ['word', 'excel', 'zip']) {
      const result = await extract(type, Buffer.from('PK\x03\x04'));
      expect(result.text).toBe('');
      expect(result.unsupported).toBe(true);
    }
  });
});
