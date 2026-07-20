const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const getTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    logger.warn('Mailer disabled: GMAIL_USER or GMAIL_APP_PASSWORD not set');
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
    },
  });
};

const send = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  if (!transporter) return;

  const toAddresses = to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));

  await transporter.sendMail({
    from: `"DATAD" <${process.env.GMAIL_USER}>`,
    to: toAddresses.join(', '),
    subject,
    html,
  });
};

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

exports.sendAnnouncementEmail = async (recipients, announcement) => {
  const transporter = getTransporter();
  if (!transporter) return;

  const subject = `📢 ${announcement.title}`;
  const html = wrap(announcement.title, `<p>${announcement.body.replace(/\n/g, '<br/>')}</p>`);

  for (const user of recipients) {
    try {
      await send({
        to: [{ email: user.email, name: user.name }],
        subject,
        html,
      });
    } catch (err) {
      logger.error('Announcement email failed for ' + user.email, { error: err.message });
    }
  }
};
