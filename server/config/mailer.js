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
const send = async ({ to, subject, html, kind = 'transactional', attachments }) => {
  const toAddresses = to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));
  return mailTransport.deliver({ toAddresses, subject, html, kind, attachments });
};

exports.send = send;
exports.isConfigured = mailTransport.isConfigured;

const wrap = (heading, body) => `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <p style="font-size:22px;font-weight:800;margin:0 0 4px">
      <span style="color:#4f46e5">DATAD</span>
    </p>
    <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin:0 0 20px">
      Technology · Psychology · Impact
    </p>
    <h2 style="font-size:18px;margin:0 0 12px">${heading}</h2>
    <div style="font-size:14px;line-height:1.6;color:#374151">${body}</div>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px">
      You're receiving this because you have an account on DATAD.
    </p>
  </div>`;

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
         style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
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
         style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
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
       <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
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
         style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
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
