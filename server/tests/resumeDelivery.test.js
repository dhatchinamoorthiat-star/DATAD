/**
 * Submission delivery: where the resume is actually mailed.
 *
 * `POST /resume/submit` used to have exactly one destination — the account
 * address read from the database — and that was a security property, not an
 * implementation detail: mailing whatever address arrives in the request body
 * turns an authenticated endpoint into a relay that pushes attachments at
 * strangers from our domain.
 *
 * Sending to a typed-in address is now a real feature (a student mailing a
 * recruiter), so the property it replaced has to be pinned by tests instead of
 * by the absence of the code path. These cover the fence around it: the address
 * is validated before anything is saved, the account confirmation still goes
 * out alongside the copy, the daily cap actually stops the sixth send, and a
 * blocked or failed send is never recorded as having happened.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');

// Stub the mail layer: these tests are about who we decide to mail, not about
// whether a transport is configured on the machine running them.
jest.mock('../config/mailer', () => ({
  sendResumeSubmittedEmail: jest.fn(async () => ({ delivered: true })),
  sendResumeCopyEmail: jest.fn(async () => ({ delivered: true })),
}));

const mailer = require('../config/mailer');
const Resume = require('../models/Resume');
const User = require('../models/User');
const { submitResume } = require('../controllers/resumeController');

const HAS_DB = Boolean(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI);
const d = HAS_DB ? describe : describe.skip;

const userId = new mongoose.Types.ObjectId();

/** Minimal Express double — the controller only ever calls these three. */
const runSubmit = async (body) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  const next = jest.fn((err) => { throw err; });
  await submitResume({ user: { userId }, body }, res, next);
  return res;
};

const baseResume = { personal: { fullName: 'Priya Sharma' }, summary: 'Analyst' };

d('resume submission delivery', () => {
  beforeAll(async () => {
    await connectTestDb();
    // Clear first rather than assuming the database is clean. The fixture uses
    // a fixed _id and a unique email, so a run that died before afterAll —
    // a timeout, a Ctrl-C — leaves the row behind and every later run fails on
    // a duplicate key, permanently, until someone clears it by hand. The
    // failure also points at this line rather than at the interrupted run,
    // which makes it read like a broken test.
    await Promise.all([
      User.deleteMany({ $or: [{ _id: userId }, { email: 'priya@datad.test' }] }),
      Resume.deleteMany({ user: userId }),
    ]);
    await User.create({
      _id: userId,
      name: 'Priya Sharma',
      email: 'priya@datad.test',
      password: 'x'.repeat(20),
    });
  });

  afterAll(async () => {
    await Promise.all([Resume.deleteMany({ user: userId }), User.deleteMany({ _id: userId })]);
    await disconnectTestDb();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await Resume.deleteMany({ user: userId });
  });

  it('mails the account address, not personal.email from the body', async () => {
    await runSubmit({ ...baseResume, personal: { fullName: 'Priya', email: 'attacker@evil.test' } });

    expect(mailer.sendResumeCopyEmail).not.toHaveBeenCalled();
    expect(mailer.sendResumeSubmittedEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendResumeSubmittedEmail.mock.calls[0][0].email).toBe('priya@datad.test');
  });

  it('rejects a malformed recipient before saving anything', async () => {
    const res = await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: 'not an email' });

    expect(res.statusCode).toBe(400);
    expect(mailer.sendResumeCopyEmail).not.toHaveBeenCalled();
    expect(await Resume.findOne({ user: userId })).toBeNull();
  });

  it('sends the copy and the account confirmation, and records the recipient', async () => {
    const res = await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: '  Recruiter@Firm.TEST ' });

    expect(res.body.copy).toEqual({ to: 'recruiter@firm.test', sent: true, reason: null });
    expect(mailer.sendResumeSubmittedEmail).toHaveBeenCalledTimes(1);

    // Normalized on the way to the transport, so the cap cannot be sidestepped
    // by varying case or padding.
    const [to, sender, pdf] = mailer.sendResumeCopyEmail.mock.calls[0];
    expect(to).toBe('recruiter@firm.test');
    expect(sender.email).toBe('priya@datad.test');
    expect(pdf.content.length).toBeGreaterThan(0);

    const saved = await Resume.findOne({ user: userId });
    expect(saved.externalSends.map((s) => s.to)).toEqual(['recruiter@firm.test']);
  });

  it('renders one PDF and shares it between both emails', async () => {
    await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: 'r@firm.test' });

    const confirmationPdf = mailer.sendResumeSubmittedEmail.mock.calls[0][2];
    const copyPdf = mailer.sendResumeCopyEmail.mock.calls[0][2];
    expect(copyPdf).toBe(confirmationPdf);
  });

  it('stops at the daily cap and does not record the blocked send', async () => {
    const at = new Date();
    await Resume.create({
      user: userId,
      ...baseResume,
      externalSends: Array.from({ length: 5 }, (_, i) => ({ to: `r${i}@firm.test`, at })),
    });

    const res = await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: 'sixth@firm.test' });

    expect(res.body.copy).toEqual({ to: 'sixth@firm.test', sent: false, reason: 'limit' });
    expect(mailer.sendResumeCopyEmail).not.toHaveBeenCalled();

    const saved = await Resume.findOne({ user: userId });
    expect(saved.externalSends).toHaveLength(5);
  });

  it('lets sends older than the window fall out of the cap', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await Resume.create({
      user: userId,
      ...baseResume,
      externalSends: Array.from({ length: 5 }, (_, i) => ({ to: `r${i}@firm.test`, at: stale })),
    });

    const res = await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: 'today@firm.test' });

    expect(res.body.copy.sent).toBe(true);
    // The expired entries are dropped rather than carried forward, so the
    // audit list tracks the window the cap actually reads.
    const saved = await Resume.findOne({ user: userId });
    expect(saved.externalSends.map((s) => s.to)).toEqual(['today@firm.test']);
  });

  it('does not record a send the transport rejected', async () => {
    mailer.sendResumeCopyEmail.mockResolvedValueOnce({ delivered: false, error: 'bounced' });

    const res = await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: 'bad@firm.test' });

    expect(res.body.copy).toEqual({ to: 'bad@firm.test', sent: false, reason: 'delivery' });
    const saved = await Resume.findOne({ user: userId });
    expect(saved.externalSends || []).toHaveLength(0);
  });

  it('still sends the copy when the account confirmation is throttled', async () => {
    await Resume.create({ user: userId, ...baseResume, lastEmailedAt: new Date() });

    const res = await runSubmit({ ...baseResume, deliverTo: 'other', recipientEmail: 'later@firm.test' });

    expect(res.body.emailThrottled).toBe(true);
    expect(mailer.sendResumeSubmittedEmail).not.toHaveBeenCalled();
    expect(res.body.copy.sent).toBe(true);
  });
});
