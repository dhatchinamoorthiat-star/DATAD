/**
 * The approval loop that runs entirely out of an inbox.
 *
 * A student confirms their address -> the admin gets a mail with their details
 * and an Approve button -> clicking it admits them and mails them back. The
 * admin never opens the dashboard, which is the whole point, and which is also
 * why the link is a capability worth pinning down:
 *
 *   - it must not be forgeable from an account id alone;
 *   - fetching it must not approve anybody, because mail scanners fetch every
 *     link in an inbound message before a human sees it;
 *   - it must stop working once used, so a forwarded mail cannot re-approve a
 *     rejected-and-re-registered person.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Same guard as registrationApproval.test.js: .env carries live Brevo
// credentials and this suite exercises code paths that send mail. Cleared
// before the mailer is required, because mailTransport caches its transport.
for (const key of [
  'BREVO_API_KEY', 'BREVO_SMTP_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM',
]) delete process.env[key];

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-approval-links';

const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');
const { mintApprovalToken, approvalTokenMatches } = require('../utils/approvalToken');

const HAS_DB = Boolean(process.env.MONGODB_URI || process.env.MONGODB_TEST_URI);
const d = HAS_DB ? describe : describe.skip;

describe('the signed approve link', () => {
  const user = { _id: '652f1a2b3c4d5e6f70819200', createdAt: new Date('2026-08-01T00:00:00Z') };

  it('accepts the token it minted', () => {
    expect(approvalTokenMatches(user, mintApprovalToken(user))).toBe(true);
  });

  it('rejects a token minted for a different account', () => {
    const other = { _id: '652f1a2b3c4d5e6f70819201', createdAt: user.createdAt };
    expect(approvalTokenMatches(user, mintApprovalToken(other))).toBe(false);
  });

  // Rejecting a signup deletes the document, so the same person can register
  // again and be handed the same id only by coincidence — but createdAt moves.
  it('rejects a token minted before the account was recreated', () => {
    const recreated = { _id: user._id, createdAt: new Date('2026-08-02T00:00:00Z') };
    expect(approvalTokenMatches(recreated, mintApprovalToken(user))).toBe(false);
  });

  it('rejects garbage without throwing on length', () => {
    expect(approvalTokenMatches(user, '')).toBe(false);
    expect(approvalTokenMatches(user, 'x')).toBe(false);
    expect(approvalTokenMatches(user, null)).toBe(false);
  });

  it('does not sign links when there is no secret to sign them with', () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => mintApprovalToken(user)).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = saved;
  });
});

// BASE_URL is set from `fromService: property: host` in render.yaml, which
// substitutes a bare hostname. Nothing else in the app builds a server-side
// link, so this is the only place that would notice.
describe('the origin the approve link points at', () => {
  const { serverLinkBase } = require('../utils/clientUrl');
  const env = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = env.NODE_ENV;
    if (env.BASE_URL === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = env.BASE_URL;
  });

  it('adds the scheme Render leaves off', () => {
    process.env.NODE_ENV = 'production';
    process.env.BASE_URL = 'datad.onrender.com';
    expect(serverLinkBase()).toBe('https://datad.onrender.com');
  });

  it('leaves a full custom-domain origin alone, trailing slash aside', () => {
    process.env.NODE_ENV = 'production';
    process.env.BASE_URL = 'https://api.datad.app/';
    expect(serverLinkBase()).toBe('https://api.datad.app');
  });

  // Emitting a localhost link into a production inbox is worse than emitting
  // none: mailer omits the button entirely when this is empty.
  it('gives nothing rather than a guess when unset in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BASE_URL;
    expect(serverLinkBase()).toBe('');
  });

  it('falls back to the local server outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.BASE_URL;
    expect(serverLinkBase()).toMatch(/^http:\/\/localhost:\d+$/);
  });
});

d('approving from the email', () => {
  let User, approvalLanding, approveFromEmail;
  const created = [];

  const makeRes = () => ({
    statusCode: 200,
    body: '',
    contentType: '',
    status(c) { this.statusCode = c; return this; },
    type(t) { this.contentType = t; return this; },
    send(b) { this.body = b; return this; },
    json(b) { this.body = b; return this; },
  });

  const call = async (handler, id, token) => {
    const res = makeRes();
    await handler({ params: { id: String(id), token }, ip: '127.0.0.1' }, res, (err) => { throw err; });
    return res;
  };

  const pendingUser = async (name = 'Pending Student') => {
    const email = `${name.toLowerCase().replace(/\W+/g, '-')}@approval-email.test`;
    const user = await User.create({
      name, email, password: 'x', status: 'pending',
      // Unique per run: referralCode is uniquely indexed, so a suite that died
      // before afterAll would otherwise poison every later run.
      referralCode: `T${Date.now().toString(36).toUpperCase()}${created.length}`,
      program: { id: 'general', label: 'General', type: 'preset' },
    });
    created.push(email);
    return user;
  };

  beforeAll(async () => {
    await connectTestDb();
    User = require('../models/User');
    ({ approvalLanding, approveFromEmail } = require('../controllers/authController'));
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: created } });
    await disconnectTestDb();
  });

  it('shows a confirmation page without approving anybody', async () => {
    const user = await pendingUser('Scanner Bait');
    const res = await call(approvalLanding, user._id, mintApprovalToken(user));

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Approve this account?');
    expect(res.body).toContain('Scanner Bait');
    expect((await User.findById(user._id)).status).toBe('pending');
  });

  it('turns down a forged token', async () => {
    const user = await pendingUser('Forged Link');
    const res = await call(approveFromEmail, user._id, 'not-the-real-token');

    expect(res.statusCode).toBe(400);
    expect((await User.findById(user._id)).status).toBe('pending');
  });

  it('admits the student when the form is submitted', async () => {
    const user = await pendingUser('Real Approval');
    const res = await call(approveFromEmail, user._id, mintApprovalToken(user));

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Approved');
    expect((await User.findById(user._id)).status).toBe('approved');
  });

  // The link carries no expiry of its own; "already approved" is what retires
  // it, so a forwarded copy of the mail cannot be replayed.
  it('does nothing the second time the same link is used', async () => {
    const user = await pendingUser('Replayed Link');
    const token = mintApprovalToken(user);
    await call(approveFromEmail, user._id, token);
    const res = await call(approveFromEmail, user._id, token);

    expect(res.body).toContain('Already handled');
  });
});
