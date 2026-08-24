/**
 * Who gets in at signup.
 *
 * This is the rule that decides whether a new student can log in at all, and
 * until now nothing tested it. It got the two questions below tangled together:
 *
 *   Is this person allowed in?      -> user.status
 *   Is their program curated yet?   -> ProgramApproval.status
 *
 * Auto-approval used to require `referrer && isPresetProgram`, so a one-time
 * referral code admitted a B.Tech CSE student instantly and left an identical
 * B.Com student in the queue — while the invite they were sent promised
 * "instant access". The code was claimed before that check, so it was spent
 * either way and no one else could use it.
 *
 * These tests pin the separation. The second describe block needs no database:
 * it measures how much of the signup form the curated map actually covers, so
 * the gap stays visible rather than being rediscovered by students.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// .env carries live Brevo credentials, and register() sends a verification
// email. Without this, running the suite mails real people from the production
// sender — this file alone delivered four before the guard was added. Cleared
// after dotenv and before the mailer is required, because mailTransport builds
// its transport lazily and caches it.
for (const key of [
  'BREVO_API_KEY', 'BREVO_SMTP_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM',
]) delete process.env[key];

const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('./helpers/testDb');
const { resolveProgramFromCourse } = require('../utils/programResolver');

const HAS_DB = Boolean(process.env.MONGODB_URI || process.env.MONGODB_TEST_URI);
const d = HAS_DB ? describe : describe.skip;

let User, ProgramApproval, UserProfile, StudentIdentity, register;
const emails = [];

/** Minimal express doubles — register only ever calls these. */
const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const makeReq = (body) => ({
  body,
  ip: '127.0.0.1',
  get: () => '',
  headers: {},
  protocol: 'http',
});

async function signUp(body) {
  const req = makeReq(body);
  const res = makeRes();
  const next = jest.fn((err) => { throw err; });
  await register(req, res, next);
  if (body.email) emails.push(body.email.toLowerCase());
  return res;
}

/** A referral code belonging to an approved member. */
async function makeReferrer(code) {
  const email = `referrer-${code.toLowerCase()}@registration-approval.test`;
  emails.push(email);
  await User.create({
    name: 'Referrer', email, password: 'x', status: 'approved',
    referralCode: code, referralUsedBy: null,
  });
  return code;
}

d('who gets in at signup', () => {
  beforeAll(async () => {
    await connectTestDb();
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
    await disconnectTestDb();
  });

  // Every signup carries a valid acceptance. Registration refuses to create an
  // account without one, so this is now part of the minimum viable body rather
  // than something only the consent tests care about — see consentGate.test.js.
  const { CURRENT_VERSIONS } = require('../config/legal');
  const base = {
    password: 'Passw0rd123',
    graduationYear: 2026,
    consent: {
      accepted: { terms: true, privacy: true, econtract: true },
      versions: { ...CURRENT_VERSIONS },
    },
  };

  it('admits a referred student on a curated program', async () => {
    const code = await makeReferrer('CURATED1');
    const email = 'curated@registration-approval.test';

    const res = await signUp({ ...base, name: 'A', email, referralCode: code, course: 'B.Tech', specialization: 'CSE' });

    expect(res.statusCode).toBe(201);
    const user = await User.findOne({ email }).lean();
    expect(user.status).toBe('approved');
    expect(user.program.type).toBe('preset');
  });

  it('admits a referred student on an uncurated program too — the code is the vouch', async () => {
    const code = await makeReferrer('UNCURATED1');
    const email = 'uncurated@registration-approval.test';

    // Medical/MBBS is offered by the signup form but is not in CURATED_COMBOS.
    // This is the case that used to land in the approval queue holding a spent
    // referral code.
    const res = await signUp({ ...base, name: 'B', email, referralCode: code, course: 'Medical', specialization: 'MBBS' });

    expect(res.statusCode).toBe(201);
    const user = await User.findOne({ email }).lean();
    expect(user.status).toBe('approved');
    expect(user.program.type).toBe('custom');
  });

  it('still tracks the uncurated program as needing review, separately from the student', async () => {
    const email = 'uncurated@registration-approval.test';
    const user = await User.findOne({ email }).lean();
    const approval = await ProgramApproval.findById(user.program.approvalId).lean();

    // The person is in; the program has not been curated. Both are true at once,
    // which is the whole point of the separation.
    expect(user.status).toBe('approved');
    expect(approval.status).toBe('pending');
  });

  it('leaves an unreferred student in the queue, curated program or not', async () => {
    const email = 'noreferral@registration-approval.test';

    const res = await signUp({ ...base, name: 'C', email, course: 'B.Tech', specialization: 'CSE' });

    expect(res.statusCode).toBe(201);
    const user = await User.findOne({ email }).lean();
    expect(user.status).toBe('pending');
  });

  it('spends the referral code exactly once, and only on someone it admitted', async () => {
    const code = await makeReferrer('ONETIME1');
    const first = 'onetime-a@registration-approval.test';
    const second = 'onetime-b@registration-approval.test';

    await signUp({ ...base, name: 'D', email: first, referralCode: code, course: 'B.Com', specialization: 'Accounting' });
    const admitted = await User.findOne({ email: first }).lean();
    expect(admitted.status).toBe('approved'); // uncurated, but admitted

    const res = await signUp({ ...base, name: 'E', email: second, referralCode: code, course: 'B.Tech', specialization: 'CSE' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already been used/i);
  });

  it('rejects an unknown referral code without creating an account', async () => {
    const email = 'badcode@registration-approval.test';

    const res = await signUp({ ...base, name: 'F', email, referralCode: 'NOPE-9999', course: 'B.Tech', specialization: 'CSE' });

    expect(res.statusCode).toBe(400);
    expect(await User.findOne({ email })).toBeNull();
  });
});

describe('how much of the signup form the curated map covers', () => {
  // Mirrors client/src/components/register/AcademicStep.jsx. If the form and
  // this list drift, the coverage number below stops meaning anything — which
  // is itself worth knowing.
  const FORM = {
    MBA: ['Finance', 'Marketing', 'HR', 'Operations', 'Analytics', 'Strategy', 'General'],
    'B.Tech': ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical'],
    'B.Sc': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
    'B.Com': ['Accounting', 'Finance', 'Marketing', 'HR'],
    BBA: ['Finance', 'Marketing', 'HR', 'Operations'],
    BA: ['English', 'History', 'Political Science', 'Economics', 'Psychology'],
    'M.Sc': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'CS'],
    Law: ['Corporate', 'Criminal', 'Intellectual Property', 'Family Law'],
    Medical: ['MBBS', 'BDS', 'Nursing', 'Pharmacy'],
  };

  const all = Object.entries(FORM).flatMap(([course, specs]) =>
    specs.map((specialization) => ({ course, specialization }))
  );

  it('resolves every combination the form can produce, without throwing', () => {
    for (const combo of all) {
      const program = resolveProgramFromCourse({ ...combo, graduationYear: 2026 });
      expect(program.id).toBeTruthy();
      expect(['preset', 'custom']).toContain(program.type);
    }
  });

  it('leaves most of the form uncurated — which no longer decides admission', () => {
    const preset = all.filter(
      (c) => resolveProgramFromCourse({ ...c, graduationYear: 2026 }).type === 'preset'
    );

    // Recorded rather than asserted tightly: curating more programs is good and
    // must not break this test. What matters is that the majority being
    // uncurated is a content gap, not a locked door.
    expect(all.length).toBe(45);
    expect(preset.length).toBeLessThan(all.length);
    expect(preset.length).toBeGreaterThan(0);
  });

  it('falls back to a curated general program when the course is skipped', () => {
    const program = resolveProgramFromCourse({});

    // Telling someone their degree needs admin review when they simply did not
    // pick one would be nonsense.
    expect(program.id).toBe('general');
    expect(program.type).toBe('preset');
  });
});
