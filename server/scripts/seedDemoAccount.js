/**
 * Stand up the demo account the Play Store screenshots are taken from.
 *
 * The listing needs six signed-in screens — dashboard, notes, planner, résumé,
 * finance, Dax — and `docs/PLAY_STORE_LISTING.md` is explicit that they come
 * "from a seeded demo account, never a real student's". A store listing is
 * public, indexed and mirrored; a name or a batch number in one of those images
 * is not something you can quietly revise later.
 *
 * So this builds an account whose every field is invented, and whose content is
 * plausible enough to photograph: an MBA student mid-semester with a few
 * subjects, some deadlines that have not passed yet, and a term's spending.
 *
 * Idempotent. Re-running replaces the demo content rather than stacking a
 * second copy of it, so the screenshots can be regenerated after a UI change
 * without the planner slowly filling up with duplicates.
 *
 *   MONGODB_URI=... DEMO_PASSWORD='...' node scripts/seedDemoAccount.js
 *
 * The password comes from the environment and is never written down here. It is
 * a live credential for an account on a real deployment, and a default baked
 * into a committed file is a default that survives into production.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const StudentIdentity = require('../models/StudentIdentity');
const Note = require('../models/Note');
const Task = require('../models/Task');
const Expense = require('../models/Expense');
const { LEGAL_DOCS } = require('../config/legal');

// Reserved by IANA and deliverable to nobody, which is the point: this address
// can never collide with a real person's, and nothing addressed to it escapes.
const DEMO_EMAIL = 'demo.student@example.com';

// Days from today, so the planner is never showing a screen full of overdue
// work. A screenshot taken next month should still look like a student who is
// on top of things.
const inDays = (n) => new Date(Date.now() + n * 864e5);
const daysAgo = (n) => new Date(Date.now() - n * 864e5);

const NOTES = [
  {
    title: 'Weighted Average Cost of Capital',
    subject: 'Corporate Finance',
    semester: 'Semester 3',
    content:
      'WACC = (E/V x Re) + (D/V x Rd x (1 - Tc)).\n\n'
      + 'The part that actually catches people out is that the weights are market '
      + 'values, not book values. Book equity is a historical artefact; the '
      + 'discount rate is about what capital costs *now*.\n\n'
      + 'Tax shield only applies to debt — equity dividends are paid post-tax, '
      + 'which is why heavily levered firms show a lower WACC right up until the '
      + 'point that distress risk starts repricing their debt.',
  },
  {
    title: 'Porter — where the five forces stop being useful',
    subject: 'Strategic Management',
    semester: 'Semester 3',
    content:
      'Good for structural analysis of a settled industry. Much weaker where the '
      + 'industry boundary is itself in play — platforms, bundling, anything where '
      + 'the substitute is a different category rather than a cheaper version of '
      + 'the same thing.\n\n'
      + 'Worth pairing with a value-net view so complements get counted. Porter '
      + 'has no slot for a complement, and for most software businesses that is '
      + 'the whole game.',
  },
  {
    title: 'Regression diagnostics — the checks I keep skipping',
    subject: 'Business Analytics',
    semester: 'Semester 3',
    content:
      'Residual plots before R². A high R² on a misspecified model is a '
      + 'confident wrong answer.\n\n'
      + 'Checklist: linearity (residuals vs fitted), homoscedasticity (fan shape '
      + 'means the standard errors lie), independence (Durbin-Watson on anything '
      + 'time-ordered), normality of residuals (only really matters for small n).\n\n'
      + 'Multicollinearity does not bias the coefficients, it just makes them '
      + 'unstable — VIF above 5 and I stop trusting any individual coefficient.',
  },
  {
    title: 'Consumer decision journey — case notes',
    subject: 'Marketing Management',
    semester: 'Semester 3',
    content:
      'The funnel model assumes a shrinking consideration set. Evidence points '
      + 'the other way: the set often *widens* mid-journey as people research.\n\n'
      + 'Implication for spend — post-purchase is not the end of the funnel, it '
      + 'is the top of the next one. The loyalty loop is where the margin is.',
  },
];

const TASKS = [
  { title: 'Submit Corporate Finance case — Metro Logistics', type: 'case-study', subject: 'Corporate Finance', dueDate: inDays(2), status: 'in-progress', description: 'Cost-reduction analysis. Model built; the writeup is what is left.' },
  { title: 'Business Analytics mid-term', type: 'exam', subject: 'Business Analytics', dueDate: inDays(5), status: 'pending', description: 'Regression, hypothesis testing, sampling.' },
  { title: 'Summer placement — first round prep', type: 'interview-prep', subject: 'Placements', dueDate: inDays(8), status: 'in-progress', description: 'Guesstimates and two market-sizing walkthroughs.' },
  { title: 'Strategic Management group presentation', type: 'deadline', subject: 'Strategic Management', dueDate: inDays(11), status: 'pending', description: 'Industry teardown. Slides 4-7 are mine.' },
  { title: 'Marketing project — survey design', type: 'deadline', subject: 'Marketing Management', dueDate: inDays(16), status: 'pending' },
  { title: 'Read Ch. 12 before Thursday', type: 'other', subject: 'Corporate Finance', dueDate: daysAgo(3), status: 'done' },
];

const EXPENSES = [
  { kind: 'income', amount: 15000, source: 'Allowance', note: 'Monthly allowance', date: daysAgo(24) },
  { kind: 'income', amount: 8000, source: 'Stipend', note: 'Live project stipend', date: daysAgo(12) },
  { kind: 'income', amount: 2500, source: 'Freelance', note: 'Deck design for a startup', date: daysAgo(6) },
  { kind: 'expense', amount: 6200, category: 'Rent', note: 'Hostel — monthly share', date: daysAgo(23) },
  { kind: 'expense', amount: 3150, category: 'Food', note: 'Mess fee', date: daysAgo(22) },
  { kind: 'expense', amount: 2400, category: 'Books & Courses', note: 'Financial Modelling course', date: daysAgo(18) },
  { kind: 'expense', amount: 890, category: 'Travel', note: 'Campus recruitment travel', date: daysAgo(14) },
  { kind: 'expense', amount: 1250, category: 'Food', note: 'Study-group dinners', date: daysAgo(9) },
  { kind: 'expense', amount: 640, category: 'Entertainment', note: 'Weekend film', date: daysAgo(5) },
  { kind: 'expense', amount: 1800, category: 'Shopping', note: 'Formal shirt for interviews', date: daysAgo(3) },
];

(async () => {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    console.error('Set DEMO_PASSWORD (8+ chars) in the environment. It is not stored in this file.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  // This writes to whatever MONGODB_URI points at, which for this project is
  // the live database. Say so rather than letting it be a surprise.
  console.log(`Seeding ${DEMO_EMAIL} into ${process.env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  await mongoose.connect(process.env.MONGODB_URI);

  const now = new Date();
  const hashed = await bcrypt.hash(password, 10);

  // Every login gate satisfied up front, because the point of this account is
  // that someone can sign in on a fresh device and immediately photograph it:
  // verified email, approved status, and a consent record naming the current
  // revisions so ReconsentGate does not intercept the session.
  const user = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      $set: {
        name: 'Aditi Raman',
        email: DEMO_EMAIL,
        password: hashed,
        role: 'member',
        status: 'approved',
        emailVerifiedAt: now,
        programs: ['mba'],
        activeProgram: 'mba',
        program: {
          id: 'mba',
          label: 'MBA',
          type: 'preset',
          category: 'Master',
          specialization: 'Finance',
          cohort: new Date().getFullYear() + 2,
          institution: 'Northfield Institute of Management',
        },
        consent: {
          acceptedAt: now,
          terms: true,
          privacy: true,
          econtract: true,
          versions: {
            terms: LEGAL_DOCS.terms.version,
            privacy: LEGAL_DOCS.privacy.version,
          },
          ip: '',
          userAgent: 'seedDemoAccount',
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await StudentIdentity.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        name: 'Aditi Raman',
        email: DEMO_EMAIL,
        rollNumber: 'NIM-2027-0184',
        bio: 'MBA Finance. Interested in valuation and corporate strategy.',
        college: 'Northfield Institute of Management',
        course: 'MBA',
        department: 'Finance',
        semester: 'Semester 3',
        batch: String(new Date().getFullYear() + 2),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // Replace rather than append, so re-running keeps the screens photogenic.
  await Promise.all([
    Note.deleteMany({ author: user._id }),
    Task.deleteMany({ createdBy: user._id }),
    Expense.deleteMany({ user: user._id }),
  ]);

  await Note.insertMany(NOTES.map((n) => ({ ...n, author: user._id, program: 'mba' })));
  await Task.insertMany(TASKS.map((t) => ({ ...t, createdBy: user._id, assignee: user._id, program: 'mba' })));
  await Expense.insertMany(EXPENSES.map((e) => ({ ...e, user: user._id })));

  console.log(`OK  user=${user._id}  notes=${NOTES.length}  tasks=${TASKS.length}  entries=${EXPENSES.length}`);
  console.log(`Sign in as ${DEMO_EMAIL} with the DEMO_PASSWORD you supplied.`);

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
