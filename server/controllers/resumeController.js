const Resume = require('../models/Resume');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendResumeSubmittedEmail } = require('../config/mailer');
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
 * The mail goes to the *account* address from the database, never to
 * `personal.email` in the request body — otherwise this endpoint would be an
 * authenticated open relay that sends attacker-authored resume content to any
 * address a caller types into the form.
 *
 * Delivery failure does not fail the request: the resume is already saved, and
 * a student who cannot receive mail should not be blocked from submitting.
 */
exports.submitResume = async (req, res, next) => {
  try {
    const resume = await persist(req.user.userId, req.body);
    const completeness = scoreResume(resume);

    const now = Date.now();
    // Throttle against the last email, not the last submit: keying both off one
    // field meant every resubmit slid the window and the mail never went out.
    const lastEmail = resume.lastEmailedAt ? new Date(resume.lastEmailedAt).getTime() : 0;
    const throttled = now - lastEmail < EMAIL_COOLDOWN_MS;

    resume.lastSubmittedAt = new Date(now);

    let emailed = false;
    if (!throttled) {
      const user = await User.findById(req.user.userId).select('name email').lean();
      if (user?.email) {
        // A failed render costs the attachment, not the confirmation itself.
        let pdf = null;
        try {
          pdf = { filename: pdfFilename(resume), content: await renderResumePdf(resume.toObject()) };
        } catch (err) {
          logger.warn('Resume PDF render failed — sending confirmation without attachment', {
            userId: String(req.user.userId),
            error: err.message,
          });
        }

        const result = await sendResumeSubmittedEmail(user, completeness, pdf);
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
    }

    await resume.save();

    res.json({ ...withScore(resume), completeness, emailed, emailThrottled: throttled });
  } catch (err) {
    next(err);
  }
};
