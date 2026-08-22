/**
 * Upload guards: request-size rejection and file-signature validation.
 *
 * Two problems this addresses.
 *
 * MEMORY. Every upload route uses multer's memoryStorage, so the whole file
 * sits in the heap; three call sites then build a base64 data-URI from it,
 * which costs another ~1.37x while both live. Peak is therefore ~2.4x the file
 * size per concurrent upload. studioUpload previously allowed 100 MB x 10 files
 * in one request — roughly 1 GB of demand on a 512 MB instance, which OOM-kills
 * the process and takes every other in-flight request with it.
 *
 * multer enforces its limit by counting bytes as they arrive, which still means
 * accepting the stream. checkRequestSize rejects on the declared Content-Length
 * first, so an oversized request is refused before any of it is buffered.
 *
 * TYPE. multer's fileFilter can only see the client-supplied Content-Type; the
 * bytes are not available yet. So the filter is a hint, not a check, and a
 * .html file declared as application/pdf passes it. verifyFileSignatures runs
 * after multer, when the buffer exists, and compares the actual leading bytes
 * against the declared type.
 */

const logger = require('../utils/logger');

const MB = 1024 * 1024;

/**
 * Limits, env-overridable so they can be tuned to the instance size without a
 * code change. Defaults assume the documented 2 GB production instance and are
 * still safe on 512 MB: a single 25 MB document peaks around 60 MB.
 */
const LIMITS = {
  image: Number(process.env.UPLOAD_MAX_IMAGE_MB || 10) * MB,
  doc: Number(process.env.UPLOAD_MAX_DOC_MB || 25) * MB,
  studioFile: Number(process.env.UPLOAD_MAX_STUDIO_FILE_MB || 25) * MB,
  studioFiles: Number(process.env.UPLOAD_MAX_STUDIO_FILES || 5),
  studioRequest: Number(process.env.UPLOAD_MAX_STUDIO_REQUEST_MB || 60) * MB,
};

/**
 * Reject a request whose declared body size exceeds `maxBytes`, before multer
 * buffers any of it.
 *
 * A missing or lying Content-Length is not trusted to be safe — it only means
 * this early exit cannot fire, and multer's own per-file limit still applies.
 */
function checkRequestSize(maxBytes) {
  return (req, res, next) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      logger.warn('Upload rejected on declared size', {
        declared,
        maxBytes,
        path: req.originalUrl,
        userId: req.user?.userId ? String(req.user.userId) : undefined,
      });
      return res.status(413).json({
        message: `Upload too large. Maximum ${Math.floor(maxBytes / MB)}MB per request.`,
      });
    }
    next();
  };
}

/**
 * Leading-byte signatures per declared MIME type.
 *
 * Each entry is a list of acceptable prefixes; `offset` shifts where the match
 * is applied (MP4's `ftyp` box starts at byte 4).
 */
const SIGNATURES = {
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF….WEBP
  'video/mp4': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // ftyp
  'video/webm': [{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  // OOXML (docx/xlsx/pptx) and plain archives are all ZIP containers.
  'application/zip': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  'application/x-zip-compressed': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  // Legacy OLE compound documents (.doc/.xls/.ppt).
  'application/msword': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  'application/vnd.ms-excel': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  'application/vnd.ms-powerpoint': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
};

/**
 * Markers that must never appear at the start of a file we are about to hand to
 * a CDN, whatever it claims to be. A document that begins with markup is either
 * mislabelled or an attempt to get active content served from our asset host.
 */
const ACTIVE_CONTENT_PREFIXES = [
  '<!doctype html',
  '<html',
  '<?xml', // covers SVG and XML-wrapped payloads
  '<svg',
  '<script',
];

/**
 * Markers that must not appear anywhere in the opening bytes of a binary file.
 *
 * Narrower than the prefix list on purpose: <?xml and <html legitimately appear
 * inside some container formats, but a script or an svg element in the first
 * kilobyte of something claiming to be a PDF or an image does not happen by
 * accident.
 */
const ACTIVE_CONTENT_ANYWHERE = ['<script', '<svg'];

/**
 * How much of the file to consider "the head" for the markup checks. 64 bytes
 * was too small to survive a padding comment — see normalizeHead.
 */
const HEAD_BYTES = 1024;

/**
 * Lowercased opening bytes with leading whitespace and XML/HTML comments
 * removed.
 *
 * The prefix check used to run on the raw first 64 bytes, so prepending
 * `<!-- anything -->` moved the real first element past the window and defeated
 * it entirely. An SVG dressed that way passed both checks — SVG has no magic
 * number, so the signature table has nothing to say about it — and reached the
 * CDN as an image. SVG is an active-content format: it executes script when
 * served as image/svg+xml and opened directly.
 *
 * Stripping comments before matching means the padding no longer helps. The
 * loop is bounded so a file made entirely of comments cannot spin here.
 */
function normalizeHead(buffer) {
  let head = buffer.subarray(0, HEAD_BYTES).toString('latin1').toLowerCase().trimStart();
  for (let i = 0; i < 16; i++) {
    if (!head.startsWith('<!--')) break;
    const end = head.indexOf('-->');
    if (end === -1) {
      // An unterminated comment swallows the rest of the head; nothing left to
      // inspect, so treat what follows the marker as the content.
      head = head.slice(4).trimStart();
      break;
    }
    head = head.slice(end + 3).trimStart();
  }
  return head;
}

function matchesSignature(buffer, sig) {
  const offset = sig.offset || 0;
  if (buffer.length < offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => buffer[offset + i] === b);
}

/**
 * Validate one file. Returns null when acceptable, or a reason string.
 *
 * Types we cannot fingerprint (text/plain, text/csv, text/markdown) are allowed
 * through the signature check — there is no magic number for plain text — but
 * they still go through the active-content check.
 */
function checkFile(file) {
  if (!file?.buffer || file.buffer.length === 0) return 'file is empty';

  const declared = (file.mimetype || '').toLowerCase();
  const head = normalizeHead(file.buffer);

  // A file that opens with markup while claiming to be anything other than
  // text/html is mislabelled. We never accept text/html in the first place.
  if (!declared.startsWith('text/')) {
    for (const marker of ACTIVE_CONTENT_PREFIXES) {
      if (head.startsWith(marker)) {
        return `content looks like ${marker} but was declared ${declared}`;
      }
    }
    // Backstop for formats we cannot fingerprint. A real PDF, ZIP or JPEG does
    // not contain a script or SVG element in its opening bytes, so finding one
    // anywhere in the head means the file is markup wearing another name.
    for (const marker of ACTIVE_CONTENT_ANYWHERE) {
      if (head.includes(marker)) {
        return `content contains ${marker} but was declared ${declared}`;
      }
    }
  }

  const expected = SIGNATURES[declared];
  if (!expected) return null; // unfingerprintable (text/*) — allowed

  if (!expected.some((sig) => matchesSignature(file.buffer, sig))) {
    return `content does not match declared type ${declared}`;
  }
  return null;
}

/**
 * Post-multer middleware. Validates req.file and/or req.files and rejects the
 * whole request if any file fails — a partially accepted batch is harder to
 * reason about than an outright rejection.
 */
function verifyFileSignatures(req, res, next) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((group) => files.push(...group));
  }

  for (const file of files) {
    const problem = checkFile(file);
    if (problem) {
      logger.warn('Upload rejected on file signature', {
        originalName: file.originalname,
        declared: file.mimetype,
        size: file.size,
        problem,
        userId: req.user?.userId ? String(req.user.userId) : undefined,
      });
      return res.status(400).json({ message: `Rejected "${file.originalname}": ${problem}` });
    }
  }
  next();
}

module.exports = {
  LIMITS,
  MB,
  checkRequestSize,
  verifyFileSignatures,
  // exported for tests
  checkFile,
};
