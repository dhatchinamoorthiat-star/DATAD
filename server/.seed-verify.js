/**
 * Verification fixture — NOT part of the application. Delete after use.
 *
 * Seeds a Pro-tier user into the *test* database and mints a token matching
 * authController's signToken payload, so the browser can authenticate without
 * anyone typing a password.
 *
 * It refuses to touch anything but a database whose name contains "test", the
 * same guard tests/helpers/testDb.js applies — the real `datad` database is
 * never written to by this script.
 */
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TEST_URI = process.env.MONGODB_URI.replace(/\/([^/?]+)(\?|$)/, '/$1-test$2');
if (!/-test(\?|$)/.test(TEST_URI)) throw new Error('refusing to seed a non-test database');

(async () => {
  await mongoose.connect(TEST_URI);
  const User = require('./models/User');
  const StudentIdentity = require('./models/StudentIdentity');
  const Resume = require('./models/Resume');
  const LinkedInProfile = require('./models/LinkedInProfile');
  const LinkedInAnalysis = require('./models/LinkedInAnalysis');

  const email = 'linkedin-verify@example.test';
  const existing = await User.findOne({ email });
  if (existing) {
    await Promise.all([
      LinkedInProfile.deleteMany({ user: existing._id }),
      LinkedInAnalysis.deleteMany({ user: existing._id }),
    ]);
    await User.deleteOne({ _id: existing._id });
  }

  const user = await User.create({
    name: 'Asha Menon',
    email,
    password: 'verification-only-' + Math.random().toString(36).slice(2),
    role: 'member',
    status: 'approved',
    tier: 'pro',
    isVerified: true,
    tokenVersion: 0,
    activeProgram: 'general',
    programs: ['general'],
  });

  // DATAD context, so the enrichment path runs rather than being skipped.
  await StudentIdentity.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        name: 'Asha Menon', email,
        college: 'Presidency College', course: 'B.Sc Statistics', graduationYear: 2027,
        dreamRole: 'Product Analyst', preferredIndustries: ['SaaS / Technology'],
        skills: ['SQL', 'Python', 'Excel', 'Statistics'],
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  await Resume.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        personal: { fullName: 'Asha Menon', location: 'Chennai' },
        summary: 'Final-year statistics student focused on product analytics.',
        experience: [{
          role: 'Data Analyst Intern', organization: 'Zoho', duration: 'Jun 2024 - Aug 2024',
          description: 'Rebuilt the onboarding funnel report in SQL and GA4, improving activation by 12%.',
        }],
        projects: [{ title: 'Churn scorer', description: 'Gradient boosted churn model.', technologies: 'Python' }],
        skills: ['SQL', 'Python', 'GA4'],
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const token = jwt.sign(
    {
      userId: user._id, name: user.name, email: user.email, role: 'member', tier: 'pro',
      tv: 0, studentType: 'fresher', programs: ['general'], activeProgram: 'general',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log('SEEDED ' + JSON.stringify({ userId: String(user._id), token }));
  await mongoose.disconnect();
})();
