/**
 * Mail transport — the layer beneath config/mailer.js.
 *
 * config/mailer.js owns *what* we send (templates, recipients). This owns *how*
 * it leaves the building, and it exists because the previous arrangement had
 * three production-blocking properties:
 *
 *   1. Gmail SMTP only, capped around 500 recipients/day. Registration gates on
 *      a verification email, so hitting that cap stopped signups platform-wide.
 *   2. A brand new SMTP connection per message — createTransport() was called
 *      inside the send path — so a batch of N mails was N handshakes.
 *   3. Silent failure. An unconfigured mailer returned undefined and every call
 *      site was fire-and-forget, so a lost verification mail left no trace.
 *
 * Provider precedence: Brevo HTTP API, Brevo SMTP relay, generic SMTP, then
 * Gmail SMTP. Brevo is the configured production provider (verified sending
 * domain); Gmail is retained only so a developer machine without Brevo
 * credentials still works.
 *
 * Brevo issues two different credentials and they are not interchangeable:
 *   BREVO_API_KEY       "xkeysib-…"  → HTTP API, sent as the `api-key` header
 *   BREVO_SMTP_API_KEY  "xsmtpsib-…" → SMTP relay password on smtp-relay.brevo.com
 * Both are supported so whichever is provisioned works; the HTTP API is
 * preferred because it needs no long-lived socket and reports a message id.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const BREVO_SMTP_HOST = 'smtp-relay.brevo.com';

/** Reused across calls: building a pooled SMTP transport per message was bug #2. */
let cached = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve the active provider from the environment.
 * Returns null when no provider is configured at all.
 */
function resolveTransport() {
  const brevoEmail = process.env.BREVO_FROM_EMAIL;
  const brevoName = process.env.BREVO_FROM_NAME || 'DATAD';
  const from =
    process.env.MAIL_FROM ||
    (brevoEmail ? `"${brevoName}" <${brevoEmail}>` : null) ||
    (process.env.GMAIL_USER ? `"DATAD" <${process.env.GMAIL_USER}>` : null);

  // Brevo rejects a sender that isn't on a verified domain, so the address is
  // required explicitly rather than guessed from the credential.
  const brevoConfigured = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_API_KEY;
  if (brevoConfigured && !brevoEmail) {
    logger.error('Brevo credentials are set but BREVO_FROM_EMAIL is not — refusing to send', {
      hint: 'BREVO_FROM_EMAIL must be an address on a domain verified in Brevo',
    });
    return null;
  }

  if (process.env.BREVO_API_KEY && brevoEmail) {
    return {
      kind: 'brevo',
      from,
      sender: { email: brevoEmail, name: brevoName },
      apiKey: process.env.BREVO_API_KEY,
    };
  }

  if (process.env.BREVO_SMTP_API_KEY && brevoEmail) {
    return {
      kind: 'brevo-smtp',
      from,
      transporter: nodemailer.createTransport({
        host: BREVO_SMTP_HOST,
        port: Number(process.env.BREVO_SMTP_PORT) || 587,
        secure: false, // 587 is STARTTLS; nodemailer upgrades after EHLO
        // Brevo's relay authenticates with the account login, not the sender
        // address, though for most accounts they are the same.
        auth: {
          user: process.env.BREVO_LOGIN || brevoEmail,
          pass: process.env.BREVO_SMTP_API_KEY,
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
      }),
    };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      kind: 'smtp',
      from: from || `"DATAD" <${process.env.SMTP_USER}>`,
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE || '') === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
      }),
    };
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      kind: 'gmail',
      from: from,
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          // App passwords are displayed in spaced groups of four.
          pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
      }),
    };
  }

  return null;
}

function getTransport() {
  if (cached === null) cached = { value: resolveTransport() };
  return cached.value;
}

/** Drop the memoised transport. Used by tests and after an env change. */
function resetTransport() {
  if (cached?.value?.transporter?.close) {
    try { cached.value.transporter.close(); } catch { /* best effort */ }
  }
  cached = null;
}

function isConfigured() {
  return getTransport() !== null;
}

/**
 * Whether a failure is worth retrying. Retrying a rejected recipient or a bad
 * API key just wastes the retry budget and delays the error.
 */
function isTransient(err) {
  const code = err?.code;
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'EDNS', 'EAI_AGAIN'].includes(code)) {
    return true;
  }

  // SMTP and HTTP use opposite conventions for 5xx and must not be conflated.
  // SMTP 4xx is "try again later" and SMTP 5xx is a permanent rejection (550 =
  // no such mailbox — retrying it twice more just delays the error).
  if (typeof err?.responseCode === 'number') {
    return err.responseCode >= 400 && err.responseCode < 500;
  }

  // HTTP: 429 is throttling and 5xx is a server-side fault; both are worth
  // another attempt. 4xx is our own bad request (bad key, unverified sender).
  if (typeof err?.status === 'number') {
    return err.status === 429 || err.status >= 500;
  }

  return false;
}

/**
 * Split an RFC-822 recipient string into Brevo's {email, name} shape.
 * `"Test Student" <a@b.edu>` → { email: 'a@b.edu', name: 'Test Student' }
 */
function parseRecipient(entry) {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(entry);
  if (match) {
    const name = match[1].trim();
    return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
  }
  return { email: String(entry).trim() };
}

async function deliverViaBrevo(cfg, { toAddresses, subject, html }) {
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      // Brevo uses a bare `api-key` header, not Bearer authorization.
      'api-key': cfg.apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: cfg.sender,
      to: toAddresses.map(parseRecipient),
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Brevo responded ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  return json.messageId || null;
}

async function deliverViaSmtp(cfg, { toAddresses, subject, html }) {
  const info = await cfg.transporter.sendMail({
    from: cfg.from,
    to: toAddresses.join(', '),
    subject,
    html,
  });
  return info?.messageId || null;
}

/**
 * Send one message, retrying transient failures with backoff.
 *
 * Always resolves to a result object; it never throws, because a mail failure
 * must not take down the request that triggered it. Callers that care — the
 * registration path especially — inspect `delivered`.
 *
 * @param {object}   msg
 * @param {string[]} msg.toAddresses  RFC-822 recipient strings
 * @param {string}   msg.subject
 * @param {string}   msg.html
 * @param {'transactional'|'bulk'} [msg.kind]  affects log severity only
 * @returns {Promise<{delivered:boolean, provider:string|null, messageId?:string|null,
 *                    attempts:number, error?:string}>}
 */
async function deliver({ toAddresses, subject, html, kind = 'transactional' }) {
  const cfg = getTransport();

  if (!cfg) {
    // Loud, and at error level for transactional mail: this is the failure that
    // silently broke registration before.
    const detail = {
      subject,
      recipients: toAddresses.length,
      hint: 'Set BREVO_API_KEY + BREVO_FROM_EMAIL, or SMTP_HOST/SMTP_USER/SMTP_PASS, or GMAIL_USER/GMAIL_APP_PASSWORD',
    };
    if (kind === 'transactional') logger.error('Mail NOT sent — no transport configured', detail);
    else logger.warn('Bulk mail skipped — no transport configured', detail);
    return { delivered: false, provider: null, attempts: 0, error: 'mailer_not_configured' };
  }

  let lastErr;
  let used = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    used = attempt;
    try {
      const messageId =
        cfg.kind === 'brevo'
          ? await deliverViaBrevo(cfg, { toAddresses, subject, html })
          : await deliverViaSmtp(cfg, { toAddresses, subject, html });

      logger.info('Mail delivered', {
        provider: cfg.kind, kind, subject, recipients: toAddresses.length, messageId, attempts: attempt,
      });
      return { delivered: true, provider: cfg.kind, messageId, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(err)) {
        const wait = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        logger.warn('Mail send failed, retrying', {
          provider: cfg.kind, kind, subject, attempt, waitMs: wait, error: err.message,
        });
        await sleep(wait);
        continue;
      }
      break;
    }
  }

  logger.error('Mail delivery failed', {
    provider: cfg.kind,
    kind,
    subject,
    recipients: toAddresses.length,
    attempts: used,
    error: lastErr?.message,
  });
  return {
    delivered: false,
    provider: cfg.kind,
    attempts: used,
    error: lastErr?.message || 'unknown',
  };
}

module.exports = {
  deliver,
  isConfigured,
  resetTransport,
  isTransient,
  MAX_ATTEMPTS,
};
