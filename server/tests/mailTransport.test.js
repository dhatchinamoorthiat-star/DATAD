/**
 * Transport-layer behaviour for transactional email (P0-3).
 *
 * The blocker was not "Gmail is a bad provider" in the abstract — it was that
 * a mail failure produced no signal anywhere, while registration depended on a
 * mail succeeding. So the properties worth pinning down are: does it pick the
 * configured provider, does it reuse the connection, does it retry the right
 * class of error, and does a failure ever look like a success.
 */

const MAIL_ENV = [
  'BREVO_API_KEY', 'BREVO_SMTP_API_KEY', 'BREVO_FROM_EMAIL', 'BREVO_FROM_NAME',
  'BREVO_LOGIN', 'BREVO_SMTP_PORT', 'BREVO_VERIFY_SENDS', 'MAIL_FROM',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS',
  'GMAIL_USER', 'GMAIL_APP_PASSWORD',
];

const nodemailer = require('nodemailer');
const mailTransport = require('../config/mailTransport');

const clearMailEnv = () => MAIL_ENV.forEach((k) => delete process.env[k]);

const msg = () => ({
  toAddresses: ['"Test Student" <student@college.edu>'],
  subject: 'Confirm your email — DATAD',
  html: '<p>hi</p>',
});

let saved;

beforeAll(() => { saved = {}; MAIL_ENV.forEach((k) => { saved[k] = process.env[k]; }); });

beforeEach(() => {
  jest.restoreAllMocks();
  clearMailEnv();
  // Off by default so the rest of the suite does not pay the verification
  // poll delay on every send; the tests that exercise it opt back in.
  process.env.BREVO_VERIFY_SENDS = 'false';
  mailTransport.resetTransport();
});

afterAll(() => {
  clearMailEnv();
  Object.entries(saved).forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; });
  mailTransport.resetTransport();
});

describe('provider initialization', () => {
  it('reports unconfigured when no provider env is present', () => {
    expect(mailTransport.isConfigured()).toBe(false);
  });

  it('selects the Brevo HTTP API when BREVO_API_KEY and BREVO_FROM_EMAIL are set', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: 'brevo-123' }),
    });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(true);
    expect(res.provider).toBe('brevo');
    expect(res.messageId).toBe('brevo-123');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
    // Brevo authenticates with a bare `api-key` header, not Bearer.
    expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('test-key');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('sends Brevo the sender and recipients in its own schema', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    process.env.BREVO_FROM_NAME = 'DATAD';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: 'm' }),
    });

    await mailTransport.deliver(msg());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.sender).toEqual({ email: 'no-reply@datad.app', name: 'DATAD' });
    // RFC-822 recipient strings must be decomposed for Brevo.
    expect(body.to).toEqual([{ email: 'student@college.edu', name: 'Test Student' }]);
    expect(body.htmlContent).toBe('<p>hi</p>'); // not `html`
    expect(body.subject).toBe('Confirm your email — DATAD');
  });

  it('handles a bare recipient address with no display name', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: 'm' }),
    });

    await mailTransport.deliver({ ...msg(), toAddresses: ['plain@college.edu'] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.to).toEqual([{ email: 'plain@college.edu' }]);
  });

  it('refuses Brevo without BREVO_FROM_EMAIL rather than guessing a sender', () => {
    process.env.BREVO_API_KEY = 'test-key';
    expect(mailTransport.isConfigured()).toBe(false);
  });

  it('uses the Brevo SMTP relay when only the SMTP key is provisioned', async () => {
    process.env.BREVO_SMTP_API_KEY = 'xsmtpsib-test';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'relay-1' });
    const createTransport = jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail, close: jest.fn() });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(true);
    expect(res.provider).toBe('brevo-smtp');
    expect(createTransport.mock.calls[0][0].host).toBe('smtp-relay.brevo.com');
    expect(createTransport.mock.calls[0][0].port).toBe(587);
    expect(createTransport.mock.calls[0][0].pool).toBe(true);
  });

  it('prefers the HTTP API over the SMTP relay when both keys are present', async () => {
    process.env.BREVO_API_KEY = 'http-key';
    process.env.BREVO_SMTP_API_KEY = 'smtp-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ messageId: 'm' }) });

    const res = await mailTransport.deliver(msg());

    expect(res.provider).toBe('brevo');
  });

  it('falls back to generic SMTP when Brevo is absent', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-1' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(true);
    expect(res.provider).toBe('smtp');
  });

  it('falls back to Gmail last, and pools the connection', async () => {
    process.env.GMAIL_USER = 'a@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'g-1' });
    const createTransport = jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail, close: jest.fn() });

    await mailTransport.deliver(msg());
    await mailTransport.deliver(msg());

    expect(createTransport).toHaveBeenCalledTimes(1); // reused, not rebuilt per message
    expect(createTransport.mock.calls[0][0].pool).toBe(true);
    // App passwords are shown in spaced groups; the spaces must be stripped.
    expect(createTransport.mock.calls[0][0].auth.pass).toBe('abcdefghijklmnop');
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});

/**
 * The resume submission email carries the generated PDF, and the two providers
 * want it in different shapes: Brevo takes base64 in an `attachment` array,
 * nodemailer takes the Buffer as-is. Getting either wrong silently sends the
 * student a confirmation with no resume attached.
 */
describe('attachments', () => {
  const pdf = () => ({ filename: 'Priya-Sharma-Resume.pdf', content: Buffer.from('%PDF-1.3 fake') });

  it('base64-encodes attachments for the Brevo HTTP API', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: 'm' }),
    });

    const attachment = pdf();
    await mailTransport.deliver({ ...msg(), attachments: [attachment] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.attachment).toHaveLength(1);
    expect(body.attachment[0].name).toBe('Priya-Sharma-Resume.pdf');
    expect(Buffer.from(body.attachment[0].content, 'base64')).toEqual(attachment.content);
  });

  it('omits the Brevo attachment key entirely when there is nothing to attach', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: 'm' }),
    });

    await mailTransport.deliver(msg());

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('attachment');
  });

  it('passes attachments straight through to nodemailer', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-1' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    const attachment = pdf();
    await mailTransport.deliver({ ...msg(), attachments: [attachment] });

    expect(sendMail.mock.calls[0][0].attachments).toEqual([attachment]);
  });
});

/**
 * Brevo answers 201 with a messageId the moment it queues a mail, then rejects
 * it asynchronously if the sender is not verified. That combination shipped a
 * real false positive: a resume confirmation was logged as delivered, the API
 * told the student `emailed: true`, and nothing was ever sent.
 */
describe('Brevo asynchronous rejection', () => {
  const enableBrevo = () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_FROM_EMAIL = 'unverified@example.com';
    process.env.BREVO_VERIFY_SENDS = 'true';
    mailTransport.resetTransport();
  };

  /** First call is the send, subsequent calls are the event-log lookups. */
  const mockBrevo = (events) =>
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<abc@brevo>' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ events }) });

  it('does not report delivery when the event log shows a rejection', async () => {
    enableBrevo();
    mockBrevo([
      { event: 'requests', messageId: '<abc@brevo>' },
      {
        event: 'error',
        messageId: '<abc@brevo>',
        reason: 'Sending has been rejected because the sender you used is not valid',
      },
    ]);

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(false);
    expect(res.error).toMatch(/rejected/i);
    expect(res.error).toMatch(/not valid/i);
  });

  it('treats a rejection as permanent rather than retrying it', async () => {
    enableBrevo();
    const fetchMock = mockBrevo([{ event: 'error', messageId: '<abc@brevo>', reason: 'bad sender' }]);

    await mailTransport.deliver(msg());

    // One send + one lookup. A retried send would push this to four calls.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports delivery when the log records real progress and no rejection', async () => {
    enableBrevo();
    mockBrevo([
      { event: 'requests', messageId: '<abc@brevo>' },
      { event: 'delivered', messageId: '<abc@brevo>' },
    ]);

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(true);
    expect(res.messageId).toBe('<abc@brevo>');
  });

  it('fails open when the event log itself is unavailable', async () => {
    enableBrevo();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<abc@brevo>' }) })
      .mockRejectedValue(new Error('events endpoint down'));

    const res = await mailTransport.deliver(msg());

    // Inventing a failure for a mail that was probably fine is its own bug.
    expect(res.delivered).toBe(true);
  });

  it('logs an error when the background pass finds a rejection the inline one missed', async () => {
    // The real-world shape: Brevo's event log is not queryable within the
    // inline budget, so the response goes out optimistically and only the
    // background pass ever sees the rejection.
    jest.useFakeTimers({ doNotFake: ['performance'] });
    const logger = require('../utils/logger');
    const errorLog = jest.spyOn(logger, 'error').mockImplementation(() => {});
    enableBrevo();

    let events = []; // empty while the inline glance runs
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<abc@brevo>' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ events }) });

    const sent = mailTransport.deliver(msg());
    await jest.advanceTimersByTimeAsync(1000); // inline passes, both inconclusive
    const res = await sent;

    // Optimistic, because nothing had contradicted it yet.
    expect(res.delivered).toBe(true);
    expect(errorLog).not.toHaveBeenCalled();

    // The log catches up; the background pass is what notices.
    events = [{ event: 'error', messageId: '<abc@brevo>', reason: 'sender not valid' }];
    await jest.advanceTimersByTimeAsync(5000);

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('NOT sent'),
      expect.objectContaining({ messageId: '<abc@brevo>', reason: 'sender not valid' })
    );
    jest.useRealTimers();
  });

  it('does not verify bulk mail, which would multiply one fan-out into hundreds of lookups', async () => {
    enableBrevo();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: '<abc@brevo>' }),
    });

    await mailTransport.deliver({ ...msg(), kind: 'bulk' });

    expect(fetchMock).toHaveBeenCalledTimes(1); // the send, and nothing else
  });

  it('skips the lookup entirely when verification is disabled', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    process.env.BREVO_VERIFY_SENDS = 'false';
    mailTransport.resetTransport();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ messageId: '<abc@brevo>' }),
    });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('failure handling', () => {
  it('never reports delivery when no transport is configured', async () => {
    const res = await mailTransport.deliver(msg());
    expect(res.delivered).toBe(false);
    expect(res.error).toBe('mailer_not_configured');
  });

  it('retries a transient failure and can still succeed', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const transient = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockResolvedValue({ messageId: 'ok-after-retry' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(true);
    expect(res.attempts).toBe(2);
  });

  it('does not retry a permanent failure', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const permanent = Object.assign(new Error('550 no such recipient'), { responseCode: 550 });
    const sendMail = jest.fn().mockRejectedValue(permanent);
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(1); // burning retries on a bad address helps nobody
  });

  it('gives up after the retry budget and reports failure', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const transient = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const sendMail = jest.fn().mockRejectedValue(transient);
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(mailTransport.MAX_ATTEMPTS);
    expect(res.error).toContain('timeout');
  });

  it('retries a Brevo 429 (throttling)', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 429, text: async () => 'rate limited',
    });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(false);
    expect(res.attempts).toBe(mailTransport.MAX_ATTEMPTS);
  });

  it('does not retry a Brevo 400 (unverified sender)', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_FROM_EMAIL = 'no-reply@datad.app';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 400, text: async () => 'sender domain not verified',
    });

    const res = await mailTransport.deliver(msg());

    expect(res.delivered).toBe(false);
    expect(res.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies transient vs permanent correctly', () => {
    expect(mailTransport.isTransient({ code: 'ECONNRESET' })).toBe(true);
    expect(mailTransport.isTransient({ status: 503 })).toBe(true);
    expect(mailTransport.isTransient({ responseCode: 421 })).toBe(true);
    expect(mailTransport.isTransient({ responseCode: 550 })).toBe(false);
    expect(mailTransport.isTransient({ status: 401 })).toBe(false);
    expect(mailTransport.isTransient(new Error('nope'))).toBe(false);
  });
});

describe('registration email failure behaviour', () => {
  it('bulk fan-out sends one message per recipient, never a shared header', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'm' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    // Required after the env change so the memoised transport is rebuilt.
    mailTransport.resetTransport();
    const { sendAnnouncementEmail } = require('../config/mailer');
    const recipients = [
      { email: 'a@college.edu', name: 'A' },
      { email: 'b@college.edu', name: 'B' },
      { email: 'c@college.edu', name: 'C' },
    ];

    const result = await sendAnnouncementEmail(recipients, { title: 'Hi', body: 'Body' });

    expect(result).toEqual({ sent: 3, failed: 0, skipped: 0 });
    expect(sendMail).toHaveBeenCalledTimes(3);
    for (const call of sendMail.mock.calls) {
      // One recipient per message: no address is disclosed to another student.
      expect(call[0].to.split(',')).toHaveLength(1);
    }
  });

  it('bulk fan-out reports partial failure instead of swallowing it', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const permanent = Object.assign(new Error('550'), { responseCode: 550 });
    const sendMail = jest
      .fn()
      .mockResolvedValueOnce({ messageId: 'ok' })
      .mockRejectedValueOnce(permanent);
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    mailTransport.resetTransport();
    const { sendAnnouncementEmail } = require('../config/mailer');
    const result = await sendAnnouncementEmail(
      [{ email: 'a@x.edu', name: 'A' }, { email: 'b@x.edu', name: 'B' }],
      { title: 'T', body: 'B' }
    );

    expect(result).toEqual({ sent: 1, failed: 1, skipped: 0 });
  });
});
