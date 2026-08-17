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
const BREVO_EVENTS_ENDPOINT = 'https://api.brevo.com/v3/smtp/statistics/events';
const BREVO_SMTP_HOST = 'smtp-relay.brevo.com';

/**
 * Brevo's HTTP API answers 201 with a messageId as soon as it has *queued* the
 * mail, then rejects it asynchronously moments later if the sender is not a
 * verified address on a verified domain. Reporting that 201 as `delivered` is
 * exactly the silent failure this module was written to eliminate: it hid a
 * resume confirmation that was never sent, and the student was told it was.
 *
 * So after a 2xx we look the messageId up in the event log. Two passes, because
 * a single one cannot be both fast and reliable:
 *
 *   Inline    — a sub-second glance, purely to catch a rejection early enough
 *               to report it in the response. This sits in the request path of
 *               registration, so its budget stays tiny.
 *   Background — the authoritative pass. The event log carries the rejection
 *               timestamped identically to the request, but does not become
 *               *queryable* for some seconds afterwards, so the inline glance
 *               usually sees nothing. (Assuming those two were the same thing
 *               is what made the first version of this check useless.) This
 *               pass keeps looking after the response has gone out and logs
 *               loudly, so a silently-rejected mail still surfaces.
 *
 * A caller therefore cannot treat `delivered` from the HTTP API as proof the
 * mail left Brevo — only that Brevo took it and nothing had rejected it yet.
 */
const BREVO_INLINE_VERIFY_DELAYS_MS = [250, 600];
const BREVO_BACKGROUND_VERIFY_DELAYS_MS = [3000, 10000, 30000];

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
      // Escape hatch for environments where the extra lookup is not wanted
      // (and for tests, which would otherwise pay the poll delay per send).
      verify: process.env.BREVO_VERIFY_SENDS !== 'false',
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

/**
 * One look at Brevo's event log for a message.
 *
 * @returns {Promise<{status:'rejected', reason:string}|{status:'sent'}|{status:'unknown'}>}
 *   `unknown` covers both "the log has not caught up" and "the log could not be
 *   reached" — deliberately indistinguishable to callers, because neither is
 *   evidence of failure and treating them as one would invent errors for mail
 *   that is fine.
 */
async function readBrevoEvents(cfg, messageId) {
  const url = `${BREVO_EVENTS_ENDPOINT}?limit=10&messageId=${encodeURIComponent(messageId)}`;

  let events;
  try {
    const res = await fetch(url, {
      headers: { 'api-key': cfg.apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: 'unknown' };
    ({ events } = await res.json());
  } catch {
    return { status: 'unknown' };
  }

  const rejected = (events || []).find((e) => e.event === 'error');
  if (rejected) return { status: 'rejected', reason: rejected.reason || 'no reason given' };

  // `requests` alone just echoes our own call back at us; anything else means
  // the log has caught up and holds no rejection.
  if (events?.some((e) => e.event !== 'requests')) return { status: 'sent' };
  return { status: 'unknown' };
}

/**
 * The sub-second glance. Only reports a rejection it can actually prove.
 *
 * @throws {Error} with `status` 400 when Brevo rejected the send, so the retry
 *   logic treats it as permanent — re-sending from a rejected sender just gets
 *   rejected twice more.
 */
async function confirmBrevoSend(cfg, messageId) {
  for (const delay of BREVO_INLINE_VERIFY_DELAYS_MS) {
    await sleep(delay);
    const result = await readBrevoEvents(cfg, messageId);
    if (result.status === 'rejected') {
      const err = new Error(`Brevo rejected the message: ${result.reason}`);
      err.status = 400;
      throw err;
    }
    if (result.status === 'sent') return true;
  }
  return false; // inconclusive
}

/**
 * The authoritative pass, run after the response has already gone out.
 *
 * Nothing can act on the result but the logs, and that is the point: without it
 * a rejected mail leaves no trace anywhere, which is the failure mode this
 * whole module exists to prevent.
 */
function scheduleBrevoVerification(cfg, messageId, subject) {
  let i = 0;
  const check = async () => {
    const result = await readBrevoEvents(cfg, messageId);

    if (result.status === 'rejected') {
      logger.error('Mail was accepted by Brevo but then rejected — it was NOT sent', {
        messageId,
        subject,
        reason: result.reason,
        hint: 'Usually an unverified sender or unauthenticated sending domain',
      });
      return;
    }
    if (result.status === 'sent') return;

    if (++i < BREVO_BACKGROUND_VERIFY_DELAYS_MS.length) {
      schedule();
    } else {
      logger.warn('Could not confirm Brevo send; no rejection seen either', { messageId, subject });
    }
  };

  const schedule = () => {
    // unref so a pending check never holds the process (or a test run) open.
    setTimeout(() => { check().catch(() => {}); }, BREVO_BACKGROUND_VERIFY_DELAYS_MS[i]).unref?.();
  };

  schedule();
}

async function deliverViaBrevo(cfg, { toAddresses, subject, html, attachments, kind, replyTo }) {
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
      ...(replyTo && { replyTo }),
      subject,
      htmlContent: html,
      // Brevo wants attachment content as base64, not raw bytes.
      ...(attachments?.length && {
        attachment: attachments.map((a) => ({
          name: a.filename,
          content: a.content.toString('base64'),
        })),
      }),
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
  const messageId = json.messageId || null;

  // A 2xx here means "queued", not "sent" — see the two-pass note above.
  //
  // Transactional only. A bulk fan-out sends one message per recipient through
  // this same path, so verifying those would add the inline delay to every one
  // of them (serially) and fire three background lookups each — turning one
  // announcement into hundreds of extra API calls for no one's benefit.
  if (cfg.verify && messageId && kind === 'transactional') {
    const settled = await confirmBrevoSend(cfg, messageId);
    // Still unproven when the response goes out, so keep watching in the
    // background rather than letting a rejection disappear.
    if (!settled) scheduleBrevoVerification(cfg, messageId, subject);
  }

  return messageId;
}

async function deliverViaSmtp(cfg, { toAddresses, subject, html, attachments, replyTo }) {
  const info = await cfg.transporter.sendMail({
    from: cfg.from,
    to: toAddresses.join(', '),
    ...(replyTo && { replyTo: replyTo.name ? `"${replyTo.name}" <${replyTo.email}>` : replyTo.email }),
    subject,
    html,
    ...(attachments?.length && { attachments }),
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
 * @param {Array<{filename:string, content:Buffer, contentType?:string}>} [msg.attachments]
 * @returns {Promise<{delivered:boolean, provider:string|null, messageId?:string|null,
 *                    attempts:number, error?:string}>}
 */
async function deliver({ toAddresses, subject, html, kind = 'transactional', attachments, replyTo }) {
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
          ? await deliverViaBrevo(cfg, { toAddresses, subject, html, attachments, kind, replyTo })
          : await deliverViaSmtp(cfg, { toAddresses, subject, html, attachments, replyTo });

      logger.info('Mail delivered', {
        provider: cfg.kind, kind, subject, recipients: toAddresses.length, messageId, attempts: attempt,
        attachments: attachments?.length || 0,
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
