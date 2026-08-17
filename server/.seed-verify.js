/**
 * Throwaway verification fixture. Lives in /tmp, not the repo.
 *
 * Seeds a Pro-tier user into the *test* database (datad-test) — never the real
 * `datad` database — and mints a token matching authController's signToken
 * payload so the browser can authenticate without a password.
 */
require('dotenv').config({ path: '/Users/aaruraanat/Documents/DATAD/server/.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TEST_URI = process.env.MONGODB_URI.replace(/\/datad(\?|$)/, '/datad-test$1');
if (!/datad-test/.test(TEST_URI)) throw new Error('refusing to seed anything but datad-test');

(async () => {
  await mongoose.connect(TEST_URI);
  const User = require('/Users/aaruraanat/Documents/DATAD/server/models/User');
  const StudentIdentity = require('/Users/aaruraanat/Documents/DATAD/server/models/StudentIdentity');
  const Resume = require('/Users/aaruraanat/Documents/DATAD/server/models/Resume');

  const email = 'linkedin-verify@example.test';
  await User.deleteOne({ email });

  const user = await User.create({
    name: 'Asha Menon',
    email,
    password: 'not-a-real-login-path-' + Math.random().toString(36),
    role: 'member',
    status: 'active',
    tier: 'pro',
    isVerified: true,
    tokenVersion: 0,
    activeProgram: 'general',
    programs: ['general'],
  });

  // DATAD context, so the enrichment path is exercised rather than skipped.
  await StudentIdentity.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        name: 'Asha Menon',
        email,
        college: 'Presidency College',
        course: 'B.Sc Statistics',
        graduationYear: 2027,
        dreamRole: 'Product Analyst',
        preferredIndustries: ['SaaS / Technology'],
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
          role: 'Data Analyst Intern',
          organization: 'Zoho',
          duration: 'Jun 2024 - Aug 2024',
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

  console.log(JSON.stringify({ userId: String(user._id), token, uri: TEST_URI.replace(/:[^:@]+@/, ':***@') }));
  await mongoose.disconnect();
})();
