/**
 * No account, and no confirmation email, without a recorded acceptance.
 *
 * The client has its own gate — a scroll-to-the-end panel and three unticked
 * boxes on the last signup screen — but a gate that only exists in the browser
 * is decoration. These tests pin the server rule, which is the one that decides
 * whether an account can exist:
 *
 *   1. A signup with no consent, a partial consent, or a consent naming a
 *      version we no longer publish is refused, and nothing is written.
 *   2. A signup that is accepted carries the acceptance on the user document,
 *      stamped by the server, naming the versions that were on screen.
 *
 * A third block covers the re-consent gate at login: accounts that predate the
 * signup gate, and accounts that accepted a revision we no longer publish, are
 * held at sign-in until they accept — and the ticket that gate hands out is not
 * a session.
 *
 * The ordering claim — acceptance is recorded before the confirmation email is
 * sent — is structural rather than observable here: register() writes the
 * consent in the same User.create that makes the account, and issues the
 * verification token afterwards, so there is no window in which a user exists
 * unrecorded. What is testable, and tested below, is that a refused signup
 * leaves no user behind at all.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Same guard as registrationApproval.test.js: .env carries live Brevo
// credentials and register() sends mail. Cleared after dotenv and before the
// mailer is required, because the transport is built lazily and cached.
for (const key of [
  'BREVO_API_KEY', 'BREVO_SMTP_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM',
]) delete process.env[key];

const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');
const { consentProblem, consentIsCurrent, CURRENT_VERSIONS } = require('../config/legal');

const HAS_DB = Boolean(process.env.MONGODB_URI || process.env.MONGODB_TEST_URI);
const d = HAS_DB ? describe : describe.skip;

// One connection for the file. connectTestDb is not idempotent and
// disconnectTestDb closes the shared mongoose connection, so two describe
// blocks opening and closing their own would leave whichever ran second
// talking to a closed connection.
beforeAll(async () => { if (HAS_DB) await connectTestDb(); });
afterAll(async () => { if (HAS_DB) await disconnectTestDb(); });

const GOOD_CONSENT = {
  accepted: { terms: true, privacy: true, econtract: true },
  versions: { ...CURRENT_VERSIONS },
};

describe('consentProblem', () => {
  it('accepts a complete, current acceptance', () => {
    expect(consentProblem(GOOD_CONSENT)).toBeNull();
  });

  it('refuses a missing consent block', () => {
    expect(consentProblem(undefined)).toMatch(/accept/i);
    expect(consentProblem(null)).toMatch(/accept/i);
  });

  it('refuses a partial acceptance', () => {
    for (const clause of ['terms', 'privacy', 'econtract']) {
      const accepted = { ...GOOD_CONSENT.accepted, [clause]: false };
      expect(consentProblem({ ...GOOD_CONSENT, accepted })).toMatch(/accept/i);
    }
  });

  // Truthiness is not acceptance. A client sending 'on', 1 or 'true' has not
  // demonstrated that a person ticked anything, and coercing those would make
  // the record unfalsifiable.
  it('refuses non-boolean truthy values', () => {
    expect(consentProblem({ ...GOOD_CONSENT, accepted: { terms: 'on', privacy: 1, econtract: 'true' } }))
      .toMatch(/accept/i);
  });

  it('refuses an acceptance of superseded terms', () => {
    expect(consentProblem({ ...GOOD_CONSENT, versions: { ...CURRENT_VERSIONS, terms: '1999-01-01' } }))
      .toMatch(/updated/i);
    expect(consentProblem({ ...GOOD_CONSENT, versions: {} })).toMatch(/updated/i);
  });
});

d('register() and the acceptance record', () => {
  let User, ProgramApproval, UserProfile, StudentIdentity, register;
  const emails = [];

  const makeRes = () => ({
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  });

  const makeReq = (body) => ({
    body,
    ip: '203.0.113.7',
    get: (h) => (h.toLowerCase() === 'user-agent' ? 'JestAgent/1.0' : ''),
    headers: {},
    protocol: 'http',
  });

  async function signUp(body) {
    const res = makeRes();
    const next = jest.fn((err) => { throw err; });
    await register(makeReq(body), res, next);
    if (body.email) emails.push(body.email.toLowerCase());
    return res;
  }

  beforeAll(async () => {
    User = require('../models/User');
    ProgramApproval = require('../models/ProgramApproval');
    UserProfile = require('../models/UserProfile');
    StudentIdentity = require('../models/StudentIdentity');
    ({ register } = require('../controllers/authController'));
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    const users = await User.find({ email: { $in: emails } }).select('_id').lean();
    const ids = users.map((u) => u._id);
    await Promise.all([
      User.deleteMany({ email: { $in: emails } }),
      ProgramApproval.deleteMany({ requestedBy: { $in: ids } }),
      UserProfile.deleteMany({ user: { $in: ids } }),
      StudentIdentity.deleteMany({ user: { $in: ids } }),
    ]);
  });

  const base = { password: 'Passw0rd123', course: 'B.Tech', specialization: 'CSE', graduationYear: 2026 };

  it('refuses a signup with no acceptance, and creates nothing', async () => {
    const email = 'no-consent@consent-gate.test';
    const res = await signUp({ ...base, name: 'No Consent', email });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/accept/i);
    expect(await User.findOne({ email })).toBeNull();
  });

  it('refuses a signup that accepted only some of the clauses', async () => {
    const email = 'partial-consent@consent-gate.test';
    const res = await signUp({
      ...base, name: 'Partial', email,
      consent: { ...GOOD_CONSENT, accepted: { terms: true, privacy: true, econtract: false } },
    });

    expect(res.statusCode).toBe(400);
    expect(await User.findOne({ email })).toBeNull();
  });

  it('refuses an acceptance of terms that have since been superseded', async () => {
    const email = 'stale-consent@consent-gate.test';
    const res = await signUp({
      ...base, name: 'Stale', email,
      consent: { ...GOOD_CONSENT, versions: { ...CURRENT_VERSIONS, privacy: '2020-01-01' } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/updated/i);
    expect(await User.findOne({ email })).toBeNull();
  });

  it('records the acceptance on the account it creates', async () => {
    const email = 'good-consent@consent-gate.test';
    const before = Date.now();
    const res = await signUp({ ...base, name: 'Good', email, consent: GOOD_CONSENT });

    expect(res.statusCode).toBe(201);

    const user = await User.findOne({ email }).lean();
    expect(user.consent.terms).toBe(true);
    expect(user.consent.privacy).toBe(true);
    expect(user.consent.econtract).toBe(true);
    expect(user.consent.versions).toMatchObject(CURRENT_VERSIONS);
    expect(user.consent.ip).toBe('203.0.113.7');
    expect(user.consent.userAgent).toBe('JestAgent/1.0');

    // Server-stamped, not client-supplied.
    expect(new Date(user.consent.acceptedAt).getTime()).toBeGreaterThanOrEqual(before);

    // And the account is still unverified: acceptance is what allows the
    // confirmation email to be sent, not a substitute for confirming.
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.verifyTokenHash).toBeTruthy();
  });
});

describe('consentIsCurrent', () => {
  const current = { acceptedAt: new Date(), terms: true, privacy: true, econtract: true, versions: { ...CURRENT_VERSIONS } };

  it('is true only for a complete acceptance of the versions in force', () => {
    expect(consentIsCurrent(current)).toBe(true);
  });

  it('is false for an account that never accepted anything', () => {
    expect(consentIsCurrent(undefined)).toBe(false);
    expect(consentIsCurrent({})).toBe(false);
    // The shape a pre-gate account has: the subdoc defaults exist, but nothing
    // was ever accepted.
    expect(consentIsCurrent({ acceptedAt: null, terms: false, privacy: false, econtract: false, versions: {} })).toBe(false);
  });

  it('is false once a document version has been bumped', () => {
    expect(consentIsCurrent({ ...current, versions: { ...CURRENT_VERSIONS, terms: '2000-01-01' } })).toBe(false);
  });

  it('is false when a clause is missing, even with a timestamp and versions', () => {
    expect(consentIsCurrent({ ...current, econtract: false })).toBe(false);
  });
});

d('the re-consent gate at login', () => {
  let User, register, login, acceptConsent, jwt;
  const emails = [];
  const PASSWORD = 'Passw0rd123';

  const makeRes = () => ({
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  });

  const makeReq = (body) => ({
    body,
    ip: '203.0.113.9',
    get: (h) => (h.toLowerCase() === 'x-device-id' ? 'test-device-consent' : 'JestAgent/1.0'),
    headers: {},
    protocol: 'http',
  });

  const call = async (handler, body) => {
    const res = makeRes();
    await handler(makeReq(body), res, (err) => { throw err; });
    return res;
  };

  /** An account that exists but has never accepted anything — a pre-gate user. */
  async function makeLegacyUser(email, consent) {
    emails.push(email);
    const bcrypt = require('bcryptjs');
    const user = await User.create({
      name: 'Legacy', email, password: await bcrypt.hash(PASSWORD, 10),
      status: 'approved', emailVerifiedAt: new Date(),
    });
    if (consent) await User.updateOne({ _id: user._id }, { $set: { consent } });
    return user;
  }

  beforeAll(async () => {
    jwt = require('jsonwebtoken');
    User = require('../models/User');
    ({ register, login, acceptConsent } = require('../controllers/authController'));
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await User.deleteMany({ email: { $in: emails } });
  });

  it('holds back a login from an account that never accepted anything', async () => {
    const email = 'legacy@consent-gate.test';
    await makeLegacyUser(email);

    const res = await call(login, { email, password: PASSWORD });

    expect(res.statusCode).toBe(403);
    expect(res.body.needsConsent).toBe(true);
    // No session, under any name.
    expect(res.body.token).toBeUndefined();
    expect(res.body.consentToken).toBeTruthy();
  });

  it('holds back a login whose acceptance names a superseded version', async () => {
    const email = 'outdated@consent-gate.test';
    await makeLegacyUser(email, {
      acceptedAt: new Date(), terms: true, privacy: true, econtract: true,
      versions: { terms: '2020-01-01', privacy: '2020-01-01' },
    });

    const res = await call(login, { email, password: PASSWORD });

    expect(res.statusCode).toBe(403);
    expect(res.body.needsConsent).toBe(true);
    // The wording distinguishes "these changed" from "you never accepted",
    // which is what the client keys its heading off.
    expect(res.body.message).toMatch(/changed/i);
  });

  // The whole point of the hold is that it is not a session. verifyToken
  // refuses any token without a device claim, and this asserts the ticket has
  // none — so it cannot be replayed against the rest of the API.
  it('hands out a ticket that is not a session', async () => {
    const email = 'ticket@consent-gate.test';
    await makeLegacyUser(email);

    const res = await call(login, { email, password: PASSWORD });
    const payload = jwt.verify(res.body.consentToken, process.env.JWT_SECRET);

    expect(payload.purpose).toBe('consent');
    expect(payload.did).toBeUndefined();
    expect(payload.role).toBeUndefined();
  });

  it('records the acceptance and issues the session login withheld', async () => {
    const email = 'accepts@consent-gate.test';
    await makeLegacyUser(email);

    const held = await call(login, { email, password: PASSWORD });
    const res = await call(acceptConsent, {
      consentToken: held.body.consentToken,
      consent: GOOD_CONSENT,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeTruthy();

    const user = await User.findOne({ email }).lean();
    expect(user.consent.acceptedAt).toBeTruthy();
    expect(user.consent.versions).toMatchObject(CURRENT_VERSIONS);

    // And the gate now lets them straight through.
    const again = await call(login, { email, password: PASSWORD });
    expect(again.statusCode).toBe(200);
    expect(again.body.token).toBeTruthy();
  });

  it('refuses to record a partial acceptance, and issues no session', async () => {
    const email = 'partial-reconsent@consent-gate.test';
    await makeLegacyUser(email);

    const held = await call(login, { email, password: PASSWORD });
    const res = await call(acceptConsent, {
      consentToken: held.body.consentToken,
      consent: { ...GOOD_CONSENT, accepted: { terms: true, privacy: true, econtract: false } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.token).toBeUndefined();
    const user = await User.findOne({ email }).lean();
    expect(user.consent?.acceptedAt).toBeFalsy();
  });

  it('refuses a forged or wrong-purpose ticket', async () => {
    const email = 'forged@consent-gate.test';
    const user = await makeLegacyUser(email);

    // Right secret, wrong purpose — a session token must not work here.
    const sessionish = jwt.sign({ userId: String(user._id), did: 'd' }, process.env.JWT_SECRET);
    expect((await call(acceptConsent, { consentToken: sessionish, consent: GOOD_CONSENT })).statusCode).toBe(401);

    // Wrong secret.
    const forged = jwt.sign({ userId: String(user._id), purpose: 'consent' }, 'not-the-secret');
    expect((await call(acceptConsent, { consentToken: forged, consent: GOOD_CONSENT })).statusCode).toBe(401);

    expect((await call(acceptConsent, { consent: GOOD_CONSENT })).statusCode).toBe(400);
  });

  // A password change between the two requests revokes the ticket: whoever is
  // holding it may no longer be the account holder.
  it('refuses a ticket issued before the account changed', async () => {
    const email = 'revoked@consent-gate.test';
    const user = await makeLegacyUser(email);

    const held = await call(login, { email, password: PASSWORD });
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });

    const res = await call(acceptConsent, { consentToken: held.body.consentToken, consent: GOOD_CONSENT });
    expect(res.statusCode).toBe(401);
  });

  // Registration already collects consent, so a freshly created account must
  // never meet this gate — that would be an infinite loop for new students.
  it('does not hold back an account that just registered', async () => {
    const email = 'fresh@consent-gate.test';
    emails.push(email);
    await register(
      makeReq({
        name: 'Fresh', email, password: PASSWORD,
        course: 'B.Tech', specialization: 'CSE', graduationYear: 2026,
        consent: GOOD_CONSENT,
      }),
      makeRes(),
      (err) => { throw err; }
    );
    // Verification is a separate gate and comes first; satisfy it so the
    // consent check is the one actually under test here.
    await User.updateOne({ email }, { $set: { emailVerifiedAt: new Date(), status: 'approved' } });

    const res = await call(login, { email, password: PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});
