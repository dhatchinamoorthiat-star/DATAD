const Resume = require('../models/Resume');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { sendResumeSubmittedEmail, sendResumeCopyEmail } = require('../config/mailer');
const { normalizeResume, scoreResume } = require('../utils/resumeQuality');
const { renderResumePdf } = require('../utils/resumePdf');

/**
 * `Priya Sharma` → `Priya-Sharma-Resume.pdf`, with anything path-ish stripped.
 *
 * Keeps letters from any script: `\w` is ASCII-only, so it erased a Tamil name
 * outright and handed the student a file called `resume-Resume.pdf`.
 * Separators, quotes and control characters still go, since this value is
 * interpolated into a Content-Disposition header.
 *
 * `\p{M}` matters as much as `\p{L}` here — Tamil vowel signs and the pulli are
 * combining marks, so letters alone turn "தட்சிணா" into "தடசண".
 */
const pdfFilename = (resume) => {
  const base =
    String(resume?.personal?.fullName || '')
      .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'resume';
  return `${base}-Resume.pdf`;
};

// Exported for tests: pure, and the ASCII-only bug it fixes is invisible from
// the route without a database.
exports.pdfFilename = pdfFilename;

// A submission confirmation is useful once; the same one every time the student
// tweaks a bullet point and presses submit is not. Repeat submits still save.
const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;

// Sending to an address the student typed is the only path here that mails
// someone who never signed up, so it is capped per user per rolling day. The
// cap is what keeps a legitimate feature (mail my resume to a recruiter) from
// doubling as a way to push attachments at arbitrary inboxes from our domain.
const EXTERNAL_SENDS_PER_DAY = 5;
const EXTERNAL_WINDOW_MS = 24 * 60 * 60 * 1000;

// Deliberately narrow. Anything exotic-but-valid that this rejects costs a
// student one retype; anything malformed that it accepts is a header the
// transport has to make sense of.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[A-Za-z]{2,}$/;

/**
 * Normalize and validate a student-supplied recipient.
 * @returns {{ email: string } | { error: string }}
 */
const parseRecipient = (raw) => {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email) return { error: 'Enter an email address to send the resume to' };
  if (email.length > 160 || !EMAIL_RE.test(email)) return { error: 'That does not look like a valid email address' };
  return { email };
};

/** Shared response body so the client always has a fresh score to render. */
const withScore = (resume) => ({
  ...(resume.toObject ? resume.toObject() : resume),
  completeness: scoreResume(resume),
});

exports.getMyResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ user: req.user.userId });
    res.json(resume ? withScore(resume) : null);
  } catch (err) {
    next(err);
  }
};

/**
 * Stream the same PDF the confirmation email attaches. Having one renderer
 * behind both means the downloaded file and the mailed file can't drift apart,
 * and the browser's print dialog stops being the only way to get a PDF.
 */
exports.downloadResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ user: req.user.userId }).lean();
    if (!resume) return res.status(404).json({ message: 'No resume yet' });

    const pdf = await renderResumePdf(resume);
    const name = pdfFilename(resume);
    // A non-Latin name cannot travel in a bare `filename="…"` — that field is
    // ASCII-only — so send an ASCII fallback plus the RFC 5987 encoded form
    // that every current browser prefers.
    const asciiName = name.replace(/[^\x20-\x7E]/g, '') || 'resume-Resume.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
};

/**
 * Headshot upload options.
 *
 * `format: 'jpg'` is not cosmetic. pdfkit can embed JPEG and PNG and nothing
 * else, so a phone's HEIC or a designer's WebP would sail through the upload and
 * then fail at render time — with the failure landing on the one path that
 * matters, the PDF mailed to a recruiter. Normalising on arrival means the
 * stored asset is always something the renderer can read.
 *
 * `thumb`+`face` crops to the face rather than the centre of the frame, which is
 * what makes an arbitrary phone photo usable in a square slot at all. 512px is
 * generous for a ~27mm print square and keeps the round trip the PDF renderer
 * makes to fetch it back small.
 */
const PHOTO_UPLOAD = {
  folder: 'datad/resume-photos',
  format: 'jpg',
  transformation: [{ width: 512, height: 512, crop: 'thumb', gravity: 'face', quality: 'auto' }],
};

/**
 * Attach or replace the resume headshot.
 *
 * Upserts, because a student can reasonably add their photo before they have
 * saved a single field, and a 404 there would be a dead end.
 */
exports.uploadResumePhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, PHOTO_UPLOAD);

    const photo = {
      url: result.secure_url,
      publicId: result.public_id,
      // A student who re-uploads after switching the photo off means to see the
      // new one, so a fresh upload always turns it back on.
      visible: true,
      updatedAt: new Date(),
    };

    // The pre-update document, for the public id being replaced. One round trip
    // rather than a read followed by a write: `photo` is fully known here, so
    // there is nothing in the post-image worth going back for.
    const before = await Resume.findOneAndUpdate(
      { user: req.user.userId },
      { $set: { photo } },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    // Deliberately after the update and deliberately not awaited: the student's
    // new photo is already saved, and an orphaned asset on the CDN is a cheaper
    // outcome than failing a successful upload over the cleanup of an old one.
    const replaced = before?.photo?.publicId;
    if (replaced && replaced !== result.public_id) {
      cloudinary.uploader.destroy(replaced).catch((err) =>
        logger.warn('Replaced resume photo left on the CDN', {
          userId: String(req.user.userId),
          publicId: replaced,
          error: err.message,
        })
      );
    }

    res.json({ photo });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove the headshot entirely — the opt-out that actually deletes, as opposed
 * to `photo.visible: false`, which only keeps it off the rendered document.
 */
exports.deleteResumePhoto = async (req, res, next) => {
  try {
    const before = await Resume.findOneAndUpdate(
      { user: req.user.userId },
      { $unset: { photo: '' } }
    );

    // Awaited, unlike the replace above: someone who asked for their photo to be
    // deleted is owed the CDN copy going too. A failure there is logged rather
    // than returned — the reference is already gone, so the request did succeed
    // from the student's side and a retry would have nothing left to unset.
    const publicId = before?.photo?.publicId;
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        logger.warn('Resume photo unlinked but CDN copy not deleted', {
          userId: String(req.user.userId),
          publicId,
          error: err.message,
        });
      }
    }

    res.json({ photo: null });
  } catch (err) {
    next(err);
  }
};

const persist = async (userId, body) => {
  const fields = normalizeResume(body);
  return Resume.findOneAndUpdate(
    { user: userId },
    { $set: fields },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
};

exports.saveResume = async (req, res, next) => {
  try {
    const resume = await persist(req.user.userId, req.body);
    res.json(withScore(resume));
  } catch (err) {
    next(err);
  }
};

/**
 * Save, then confirm by email.
 *
 * Two destinations, chosen by the student at submit time:
 *
 * - `deliverTo: 'account'` (the default) mails the confirmation to the
 *   *account* address read from the database. It is never taken from
 *   `personal.email` in the request body — that would make the default path an
 *   authenticated open relay to any address a caller types into the form.
 *
 * - `deliverTo: 'other'` additionally mails a copy of the PDF to
 *   `recipientEmail`. This one *is* body-supplied and so is fenced in: the
 *   address is validated, the send is capped per user per day, the message body
 *   is fixed copy rather than anything the sender authors, and every recipient
 *   is recorded on the resume document. The account confirmation still goes out
 *   as well, so the student always has their own record of what was sent.
 *
 * Delivery failure does not fail the request: the resume is already saved, and
 * a student who cannot receive mail should not be blocked from submitting.
 */
exports.submitResume = async (req, res, next) => {
  try {
    const wantsCopy = req.body?.deliverTo === 'other';
    // Validate before persisting: a typo'd address should come back as a
    // correctable error, not as a saved resume plus a silent non-delivery.
    let recipient = null;
    if (wantsCopy) {
      const parsed = parseRecipient(req.body.recipientEmail);
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      recipient = parsed.email;
    }

    const resume = await persist(req.user.userId, req.body);
    const completeness = scoreResume(resume);

    const now = Date.now();
    // Throttle against the last email, not the last submit: keying both off one
    // field meant every resubmit slid the window and the mail never went out.
    const lastEmail = resume.lastEmailedAt ? new Date(resume.lastEmailedAt).getTime() : 0;
    const throttled = now - lastEmail < EMAIL_COOLDOWN_MS;

    resume.lastSubmittedAt = new Date(now);

    const user =
      (!throttled || wantsCopy)
        ? await User.findById(req.user.userId).select('name email').lean()
        : null;

    // Rendered at most once and shared by both sends — the PDF is the most
    // expensive thing this request does, and the copy must be byte-identical to
    // the confirmation so the student and the recruiter hold the same file.
    // A failed render costs the attachment, not the confirmation itself.
    let pdf;
    const getPdf = async () => {
      if (pdf !== undefined) return pdf;
      try {
        pdf = { filename: pdfFilename(resume), content: await renderResumePdf(resume.toObject()) };
      } catch (err) {
        pdf = null;
        logger.warn('Resume PDF render failed — sending confirmation without attachment', {
          userId: String(req.user.userId),
          error: err.message,
        });
      }
      return pdf;
    };

    let emailed = false;
    if (!throttled && user?.email) {
      const result = await sendResumeSubmittedEmail(user, completeness, await getPdf());
      emailed = Boolean(result?.delivered);
      // Only a send that got somewhere starts the cooldown. Stamping it on a
      // failure would suppress the retry the student most needs.
      if (emailed) resume.lastEmailedAt = new Date(now);
      else {
        logger.warn('Resume submitted but confirmation email not delivered', {
          userId: String(req.user.userId),
          error: result?.error,
        });
      }
    }

    // `copy` reports the second send back to the client so the UI can name the
    // address that actually received it — or say precisely why it did not.
    let copy = null;
    if (wantsCopy) {
      const recent = (resume.externalSends || []).filter(
        (s) => now - new Date(s.at).getTime() < EXTERNAL_WINDOW_MS
      );

      if (recent.length >= EXTERNAL_SENDS_PER_DAY) {
        copy = { to: recipient, sent: false, reason: 'limit' };
        logger.warn('Resume copy blocked by daily cap', {
          userId: String(req.user.userId),
          sentToday: recent.length,
        });
      } else if (!(await getPdf())) {
        // Without the attachment there is nothing to share, so send nothing —
        // an empty "here is my resume" mail helps no one.
        copy = { to: recipient, sent: false, reason: 'render' };
      } else {
        const result = await sendResumeCopyEmail(
          recipient,
          { name: user?.name || resume.personal?.fullName || 'A DATAD student', email: user?.email },
          pdf
        );
        const sent = Boolean(result?.delivered);
        copy = { to: recipient, sent, reason: sent ? null : 'delivery' };

        // Recorded only on a send that got somewhere, and trimmed to the
        // window's worth of history the cap actually reads.
        if (sent) {
          resume.externalSends = [...recent, { to: recipient, at: new Date(now) }].slice(-EXTERNAL_SENDS_PER_DAY * 2);
          logger.info('Resume copy emailed', { userId: String(req.user.userId), to: recipient });
        } else {
          logger.warn('Resume copy not delivered', {
            userId: String(req.user.userId),
            to: recipient,
            error: result?.error,
          });
        }
      }
    }

    await resume.save();

    res.json({ ...withScore(resume), completeness, emailed, emailThrottled: throttled, copy });
  } catch (err) {
    next(err);
  }
};
