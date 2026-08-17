const logger = require('../utils/logger');
const mailTransport = require('./mailTransport');
const { primaryClientUrl } = require('../utils/clientUrl');

/**
 * Send one message. Provider selection, connection reuse and retries live in
 * ./mailTransport; this file stays responsible for content only.
 *
 * Returns the transport's delivery result rather than undefined, so a caller
 * that must not fail silently — registration, above all — can check it.
 */
const send = async ({ to, subject, html, kind = 'transactional', attachments, replyTo }) => {
  const toAddresses = to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));
  return mailTransport.deliver({ toAddresses, subject, html, kind, attachments, replyTo });
};

exports.send = send;
exports.isConfigured = mailTransport.isConfigured;

/**
 * The DATAD mark, for email.
 *
 * Three constraints shape this, and they are why it does not match the way the
 * logo is done in the app:
 *
 *  - SVG is stripped by Gmail and Outlook, so the mark ships as a PNG served
 *    from the client host. It is drawn at 96px and displayed at 48 so it stays
 *    sharp on retina, with width/height set as attributes because Outlook
 *    ignores CSS sizing on images.
 *  - Most clients block remote images until the reader allows them, so the
 *    wordmark stays live text beside the image rather than being baked into
 *    it. With images off the mail still says DATAD; the alt text carries the
 *    mark's slot.
 *  - Flexbox does not exist in Outlook, so the lockup is a table.
 *
 * The 1/3-of-the-mark gap from the brand spec is the 16px cell between them.
 *
 * The mark is served from a CDN rather than from the client host, because the
 * client host is not a valid image source for mail: in development CLIENT_URL is
 * http://localhost:5173, which resolves to the *reader's* machine and renders as
 * a broken image in every inbox. Any absolute, publicly reachable URL works —
 * MAIL_LOGO_URL overrides, and the fallback is the copy uploaded to Cloudinary.
 */
const CLOUDINARY_MARK_URL =
  'https://res.cloudinary.com/dmtsr85ly/image/upload/brand/datad-mark-email.png';

const markUrl = () => process.env.MAIL_LOGO_URL || CLOUDINARY_MARK_URL;

const wrap = (heading, body) => `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px">
      <tr>
        <td style="vertical-align:middle;padding:0">
          <img src="${markUrl()}" alt="DATAD" width="48" height="48"
               style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none" />
        </td>
        <td style="vertical-align:middle;padding:0 0 0 16px">
          <p style="font-size:22px;font-weight:800;letter-spacing:0.02em;margin:0 0 2px;color:#080B14">DATAD</p>
          <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin:0">
            Technology · Psychology · Impact
          </p>
        </td>
      </tr>
    </table>
    <h2 style="font-size:18px;margin:0 0 12px">${heading}</h2>
    <div style="font-size:14px;line-height:1.6;color:#374151">${body}</div>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px">
      You're receiving this because you have an account on DATAD.
    </p>
  </div>`;

// Exported so every mail-sending module shares one header rather than
// hand-rolling its own — see automation/reminders/calendarEventReminder.
exports.wrap = wrap;

exports.sendWelcomeEmail = (user) =>
  send({
    to: [{ email: user.email, name: user.name }],
    subject: 'Welcome to DATAD 🎓',
    html: wrap(
      `Welcome aboard, ${user.name}!`,
      `<p>Your account is ready. Here's what you can do right away:</p>
       <ul>
         <li><strong>Notes</strong> — share and read study notes by subject</li>
         <li><strong>Photos</strong> — relive batch memories in shared albums</li>
         <li><strong>Planner</strong> — track deadlines, case studies and exams</li>
         <li><strong>Finance</strong> — private expense tracker and calculators</li>
         <li><strong>Resume</strong> — build an ATS-friendly resume and export PDF</li>
       </ul>
       <p>See you inside! 🚀</p>`
    ),
  }).catch((err) => logger.error('Welcome email failed:', { error: err.message }));

exports.sendAccountApprovedEmail = (user) =>
  send({
    to: [{ email: user.email, name: user.name }],
    subject: 'Your DATAD account is approved ✅',
    html: wrap(
      `You're in, ${user.name}!`,
      `<p>An admin has approved your account — you can now log in and explore everything DATAD offers.</p>
       <p>Your personal referral code is <strong>${user.referralCode}</strong>. It works exactly once —
       share it with one batchmate and they'll skip the approval queue.</p>`
    ),
  }).catch((err) => logger.error('Approval email failed:', { error: err.message }));

// Sent immediately at signup. Until this link is clicked the account cannot
// log in and never reaches the admin queue, so a bot with a fake address
// costs the admin nothing.
exports.sendVerificationEmail = (user, link) =>
  send({
    to: [{ email: user.email, name: user.name }],
    subject: 'Confirm your email — DATAD',
    html: wrap(
      'Confirm your email',
      `<p>Hi ${user.name},</p>
       <p>Confirm this address to finish creating your DATAD account.</p>
       <p><a href="${link}"
         style="display:inline-block;background:#4D7CFF;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
         Confirm email
       </a></p>
       <p style="color:#6b7280">This link expires in 24 hours. If you didn't sign up for DATAD, ignore this email — no account is created without confirming.</p>`
    ),
  });

// Sent only after a program's data sync finishes cleanly — see
// programSyncService. Reaching a student before their content exists is worse
// than reaching them a minute later.
exports.sendProgramReadyEmail = (user, programLabel) =>
  send({
    to: [{ email: user.email, name: user.name }],
    subject: `Your ${programLabel} workspace is ready 🎓`,
    html: wrap(
      `Your ${programLabel} workspace is ready`,
      `<p>Hi ${user.name},</p>
       <p>An admin approved <strong>${programLabel}</strong> and we've finished setting
       everything up for it.</p>
       <p>News, companies, career paths, study resources and your community feed are all
       scoped to your program now — you'll only see what's relevant to you.</p>
       <p><a href="${process.env.CLIENT_URL || 'https://datad.app'}/dashboard"
         style="display:inline-block;background:#4D7CFF;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
         Open DATAD
       </a></p>`
    ),
  });

exports.sendPasswordResetEmail = (user, link) =>
  send({
    to: [{ email: user.email, name: user.name }],
    subject: 'Reset your DATAD password',
    html: wrap(
      'Password reset requested',
      `<p>We received a request to reset your password. This link is valid for <strong>30 minutes</strong>:</p>
       <p><a href="${link}" style="display:inline-block;background:#4D7CFF;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
       <p>If the button doesn't work, copy this URL into your browser:<br/>
       <span style="color:#6b7280;word-break:break-all">${link}</span></p>
       <p>If you didn't request this, you can safely ignore this email.</p>`
    ),
  }).catch((err) => logger.error('Reset email failed:', { error: err.message }));

/** Escape user-supplied text before it goes into an HTML mail body. */
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

exports.esc = esc;

/**
 * Confirmation that a resume was submitted, with the completeness score, the
 * specific gaps still worth closing, and — when one could be rendered — the
 * finished resume attached as a PDF. Returns the delivery result (rather than
 * swallowing it) so the controller can tell the student whether it went out.
 *
 * @param {{filename:string, content:Buffer}} [pdf]  omitted if rendering failed;
 *   a broken PDF renderer must not cost the student their confirmation mail.
 */
exports.sendResumeSubmittedEmail = (user, completeness = {}, pdf = null) => {
  const { score = 0, missing = [], ready = false } = completeness;
  const resumeUrl = `${primaryClientUrl()}/career/resume/preview`;

  // A full bar reads as "done" even at 60% on a narrow phone screen, so the
  // number is stated in text as well.
  const bar = `
    <div style="background:#e5e7eb;border-radius:999px;height:10px;margin:6px 0 4px">
      <div style="background:${ready ? '#059669' : '#f59e0b'};width:${Math.max(score, 4)}%;height:10px;border-radius:999px"></div>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">${score}% complete</p>`;

  const gaps = missing.length
    ? `<p style="margin-top:16px"><strong>To strengthen it further:</strong></p>
       <ul>${missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
    : `<p style="margin-top:16px">Every section is filled in — this resume is ready to send to a recruiter.</p>`;

  const attachmentNote = pdf
    ? `<p style="font-size:13px;color:#6b7280">Your resume is attached to this email as <strong>${esc(pdf.filename)}</strong> — a clean, ATS-friendly PDF you can send to a recruiter as-is.</p>`
    : `<p style="font-size:13px;color:#6b7280">From the preview you can export a clean, ATS-friendly PDF.</p>`;

  return send({
    to: [{ email: user.email, name: user.name }],
    subject: ready
      ? `Your resume is ready — ${score}% complete`
      : `Resume saved — ${score}% complete`,
    attachments: pdf ? [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }] : undefined,
    html: wrap(
      `Resume submitted, ${esc(user.name)}`,
      `<p>We've saved your resume and scored it against what recruiters screen for.</p>
       ${bar}
       ${gaps}
       <p style="margin-top:20px"><a href="${resumeUrl}"
         style="display:inline-block;background:#4D7CFF;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
         View your resume
       </a></p>
       ${attachmentNote}`
    ),
  }).catch((err) => {
    logger.error('Resume submission email failed:', { error: err.message });
    return { delivered: false, error: err.message };
  });
};

/**
 * A copy of the resume PDF sent to an address the student typed in — a
 * recruiter, a mentor, a personal address away from the college domain.
 *
 * Every visible line here is fixed copy. Only the sender's name and the
 * attachment filename vary, both escaped, and the resume text itself travels
 * as the PDF rather than as HTML in the body. That is deliberate: this is the
 * one send where the recipient never opted in, so the message must not be a
 * surface for the sender to author arbitrary content into a stranger's inbox.
 * The account address goes in Reply-To so a recruiter can answer the student
 * directly, and it is named in the body so the recipient can see who sent it.
 *
 * @param {string} to  validated recipient; the caller enforces the daily cap.
 * @param {{filename:string, content:Buffer}} pdf  required — a copy with no
 *   attachment would be a bare unsolicited email, which is not worth sending.
 */
exports.sendResumeCopyEmail = (to, sender, pdf) =>
  send({
    to: [{ email: to }],
    subject: `Resume from ${sender.name}`,
    replyTo: sender.email ? { email: sender.email, name: sender.name } : undefined,
    attachments: [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }],
    html: wrap(
      `Resume from ${esc(sender.name)}`,
      `<p>${esc(sender.name)} has shared their resume with you from DATAD.</p>
       <p>It is attached as <strong>${esc(pdf.filename)}</strong>.</p>
       <p style="font-size:13px;color:#6b7280;margin-top:20px">
         You can reply to this email to reach ${esc(sender.name)} directly.
         This message was sent because they entered your address on their resume
         page — DATAD will not email you again unless they send another copy.
       </p>`
    ),
  }).catch((err) => {
    logger.error('Resume copy email failed:', { error: err.message });
    return { delivered: false, error: err.message };
  });

/**
 * Bulk fan-out. Marked `kind: 'bulk'` so an unconfigured mailer logs at warn
 * rather than error — a missing newsletter is not the same class of incident as
 * a missing verification link — and so bulk volume is distinguishable from
 * transactional volume in the logs.
 *
 * Still one message per recipient (never a shared To/Bcc header, which would
 * disclose every student's address to every other student). The transport pools
 * its connections, so this is no longer one handshake per message.
 */
exports.sendAnnouncementEmail = async (recipients, announcement) => {
  if (!mailTransport.isConfigured()) {
    logger.warn('Announcement skipped — no mail transport configured', {
      recipients: recipients.length,
    });
    return { sent: 0, failed: 0, skipped: recipients.length };
  }

  const subject = `📢 ${announcement.title}`;
  const html = wrap(announcement.title, `<p>${announcement.body.replace(/\n/g, '<br/>')}</p>`);

  let sent = 0;
  let failed = 0;
  for (const user of recipients) {
    const result = await send({
      to: [{ email: user.email, name: user.name }],
      subject,
      html,
      kind: 'bulk',
    });
    if (result?.delivered) sent += 1;
    else failed += 1;
  }

  logger.info('Announcement fan-out complete', { subject, sent, failed });
  return { sent, failed, skipped: 0 };
};
