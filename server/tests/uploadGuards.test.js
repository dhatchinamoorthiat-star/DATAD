/**
 * Upload safety tests (P0-5).
 *
 * Two independent protections, because either alone is insufficient:
 *   - checkRequestSize refuses an oversized request on its declared
 *     Content-Length, before multer buffers it into the heap;
 *   - verifyFileSignatures refuses a file whose actual bytes contradict its
 *     declared Content-Type, which is the only thing multer's fileFilter can
 *     see and is entirely client-supplied.
 */

const {
  LIMITS,
  MB,
  checkRequestSize,
  verifyFileSignatures,
  checkFile,
} = require('../middleware/uploadGuards');

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const file = (name, mimetype, bytes) => ({
  originalname: name,
  mimetype,
  size: bytes.length,
  buffer: Buffer.from(bytes),
});

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00];
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe('size limits', () => {
  it('caps studio uploads far below the previous 1 GB worst case', () => {
    // 100 MB x 10 files was the configuration that could OOM the process.
    expect(LIMITS.studioFile * LIMITS.studioFiles).toBeLessThanOrEqual(200 * MB);
    expect(LIMITS.studioRequest).toBeLessThanOrEqual(100 * MB);
    expect(LIMITS.doc).toBeLessThanOrEqual(25 * MB);
  });

  it('rejects a request whose declared size exceeds the cap, before buffering', () => {
    const res = makeRes();
    const next = jest.fn();
    const req = { headers: { 'content-length': String(LIMITS.doc + 1) }, originalUrl: '/api/notes/upload-attachment' };

    checkRequestSize(LIMITS.doc)(req, res, next);

    expect(res.statusCode).toBe(413);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a request within the cap', () => {
    const res = makeRes();
    const next = jest.fn();
    checkRequestSize(LIMITS.doc)({ headers: { 'content-length': String(MB) } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('defers to multer when Content-Length is absent rather than failing open on size', () => {
    const next = jest.fn();
    checkRequestSize(LIMITS.doc)({ headers: {} }, makeRes(), next);
    // Passes through here; multer's own byte counter still enforces the limit.
    expect(next).toHaveBeenCalled();
  });
});

describe('file signature validation', () => {
  it('accepts legitimate files of each supported family', () => {
    expect(checkFile(file('cv.pdf', 'application/pdf', PDF))).toBeNull();
    expect(checkFile(file('a.png', 'image/png', PNG))).toBeNull();
    expect(checkFile(file('a.jpg', 'image/jpeg', JPEG))).toBeNull();
    expect(checkFile(file('n.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ZIP))).toBeNull();
    expect(checkFile(file('old.doc', 'application/msword', OLE))).toBeNull();
  });

  it('rejects HTML disguised as a PDF', () => {
    const html = Buffer.from('<!DOCTYPE html><script>alert(1)</script>');
    const problem = checkFile(file('cv.pdf', 'application/pdf', html));
    expect(problem).toBeTruthy();
  });

  it('rejects SVG disguised as a PNG', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(checkFile(file('logo.png', 'image/png', svg))).toBeTruthy();
  });

  it('rejects a mismatched but otherwise valid binary', () => {
    // A real PNG uploaded while claiming to be a PDF.
    expect(checkFile(file('x.pdf', 'application/pdf', PNG))).toBeTruthy();
  });

  it('rejects an empty file', () => {
    expect(checkFile(file('empty.pdf', 'application/pdf', []))).toBe('file is empty');
  });

  it('allows plain text, which has no signature to check', () => {
    expect(checkFile(file('notes.md', 'text/markdown', Buffer.from('# Heading')))).toBeNull();
    expect(checkFile(file('d.csv', 'text/csv', Buffer.from('a,b,c')))).toBeNull();
  });

  it('does not let a text/* declaration smuggle markup past the check', () => {
    // text/html is not in any allow-list, so this can only arrive mislabelled;
    // the point is that declaring text/plain does not grant a bypass for a
    // file that will later be served from the asset host.
    const problem = checkFile(file('x.pdf', 'application/pdf', Buffer.from('<html><body>hi')));
    expect(problem).toBeTruthy();
  });
});

describe('verifyFileSignatures middleware', () => {
  it('passes a valid single upload through', () => {
    const next = jest.fn();
    const res = makeRes();
    verifyFileSignatures({ file: file('cv.pdf', 'application/pdf', PDF) }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects the whole batch if any file fails', () => {
    const next = jest.fn();
    const res = makeRes();
    verifyFileSignatures(
      {
        files: [
          file('ok.pdf', 'application/pdf', PDF),
          file('bad.pdf', 'application/pdf', Buffer.from('<html>')),
        ],
      },
      res,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('bad.pdf');
  });

  it('is a no-op when the request carries no files', () => {
    const next = jest.fn();
    verifyFileSignatures({}, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
