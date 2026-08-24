const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Note = require('../models/Note');
const Album = require('../models/Album');
const Task = require('../models/Task');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Resume = require('../models/Resume');
const JournalEntry = require('../models/JournalEntry');
const Announcement = require('../models/Announcement');
const UserProfile = require('../models/UserProfile');
const StudentIdentity = require('../models/StudentIdentity');
const ProgramApproval = require('../models/ProgramApproval');
const { resolveProgramFromCourse } = require('../utils/programResolver');
const { upsertFromRegistration, updateIdentity } = require('../services/studentIdentityService');
const { inferNewsInterests } = require('../utils/domainClassifier');
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendAdminNewRegistrationEmail,
  esc,
} = require('../config/mailer');
const { approveAccount, adminUser } = require('../services/accountApproval');
const { mintApprovalToken, approvalTokenMatches } = require('../utils/approvalToken');
const logActivity = require('../utils/logActivity');
const { cleanupUserData } = require('../services/userCleanup');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { emailLinkBase, serverLinkBase } = require('../utils/clientUrl');
const { consentProblem, consentIsCurrent, CURRENT_VERSIONS } = require('../config/legal');
const sessionVersion = require('../services/sessionVersion');
const deviceSessions = require('../services/deviceSessions');
const signToken = require('../utils/signToken');

// The client generates this once and stores it locally; axios sends it on
// every request. It is not a secret and not proof of anything — it only has to
// be stable per browser so sessions can be counted and listed.
/**
 * The device a request is coming from.
 *
 * When the client sends no `x-device-id`, one is generated here rather than
 * left null. A null device id used to produce a token with no `did` claim, and
 * verifyToken skipped the device check entirely for those — so the whole
 * account-sharing cap was opt-in for anyone willing to drop one header. Worse,
 * such a session was never recorded, so it did not appear in "Your devices"
 * and the student had no way to revoke it.
 *
 * A generated id is not stable across sign-ins, so a client that never sends
 * the header consumes a fresh device slot each time. That is the documented
 * trade-off for the storage-blocked case in client/src/utils/deviceId.js, and
 * it is the right direction to fail: costing a slot is the behaviour the cap
 * is for, whereas escaping the cap is not.
 */
const deviceFromRequest = (req) => ({
  deviceId: String(req.get('x-device-id') || '').trim().slice(0, 64) || crypto.randomUUID(),
  ip: req.ip,
  userAgent: req.get('user-agent') || '',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// How long a verification link stays usable, and how long a caller must wait
// before another one will actually be sent. The cooldown is what stops
// /resend-verification being used to mail-bomb an address: the endpoint still
// answers identically, it just doesn't send.
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFY_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Issue a fresh verification token, returning the raw value to embed in a link.
 *
 * Only the SHA-256 hash is persisted, so a database read cannot be turned into
 * a working confirmation link. Overwriting the hash is also what invalidates
 * any previously issued token — there is deliberately never more than one live
 * verification link per account.
 */
async function issueVerificationToken(user) {
  const raw = crypto.randomBytes(32).toString('hex');
  user.verifyTokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  user.verifyTokenExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await user.save();
  return raw;
}

/**
 * Whether a verification token was issued so recently that resending would just
 * be duplicate mail. Derived from the stored expiry rather than a new column,
 * so this needs no schema change: issuedAt === expires - TTL.
 */
function verificationIssuedRecently(user) {
  if (!user.verifyTokenExpires) return false;
  const issuedAt = new Date(user.verifyTokenExpires).getTime() - VERIFY_TOKEN_TTL_MS;
  return Date.now() - issuedAt < VERIFY_RESEND_COOLDOWN_MS;
}

const isAdminEmail = (email) =>
  process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

const passwordProblem = (password) => {
  if (!password || password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include both a letter and a number';
  }
  return null;
};

// How long the ticket handed out by a consent-blocked login stays usable. Short:
// it exists only to carry one person from the login screen to the acceptance
// screen and back, so a leaked one should expire before it is worth anything.
const CONSENT_TOKEN_TTL = '15m';

/**
 * A ticket proving someone just passed a password check, issued when login is
 * held back for re-consent.
 *
 * Not a session. It carries no `did`, and verifyToken refuses any token without
 * one, so this cannot be presented to the API as a login — which is the whole
 * point: the person has authenticated, but until they accept there is no basis
 * to give them access to anything. `tv` is included so a password change or a
 * revocation between the two requests invalidates the ticket too.
 *
 * The alternative — asking for the password again on the acceptance screen —
 * would train people to retype credentials after an unexpected interstitial,
 * which is the exact shape of a phishing flow.
 */
const mintConsentToken = (user) =>
  jwt.sign(
    { userId: String(user._id), purpose: 'consent', tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: CONSENT_TOKEN_TTL }
  );

// Readable, non-guessable referral code: name prefix + random suffix, e.g. DHAT-7K2M.
const makeReferralCode = (name) => {
  const prefix = (name || 'USER').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  const suffix = crypto.randomBytes(3).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return `${prefix}-${suffix}`;
};

const uniqueReferralCode = async (name) => {
  for (let i = 0; i < 5; i++) {
    const code = makeReferralCode(name);
    if (!(await User.exists({ referralCode: code }))) return code;
  }
  return `${makeReferralCode(name)}${Date.now().toString(36).slice(-3).toUpperCase()}`;
};


// Used by the register flow to block advancing past the credentials step
// with an email that's already taken, before the student fills out the
// remaining 6 steps. Deliberately returns only a boolean, never whether the
// account is pending/approved/etc — nothing beyond "is this email usable".
exports.checkEmail = async (req, res, next) => {
  try {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    const exists = await User.exists({ email });
    res.json({ exists: Boolean(exists) });
  } catch (err) { next(err); }
};

// Sync a program's content the first time anyone joins it. Already-synced
// programs are skipped: a second MBA student doesn't need the MBA feed rebuilt.
const ensureProgramSynced = async (approval, program) => {
  const ProgramRegistry = require('../models/ProgramRegistry');
  if (await ProgramRegistry.exists({ _id: program.id })) return;

  const { runProgramSync } = require('../services/programSyncService');
  await runProgramSync(approval._id);
};

exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      referralCode,
      rollNumber,
      // Optional explicit override; normally derived from `course` below.
      program: explicitProgram,
      // New profile fields
      college,
      course,
      department,
      specialization,
      batch,
      semester,
      graduationYear,
      dreamRole,
      preferredIndustries,
      careerInterests,
      favouriteSubjects,
      difficultSubjects,
      learningStyle,
      goals,
      experience,
      skills: regSkills,
      timeAvailable,
      challenges,
      consent,
    } = req.body;

    // Honeypot: a field hidden from real users that form-filling bots populate.
    // Answer exactly as if the signup succeeded — telling a bot it was detected
    // just tells its author which field to skip next time.
    if (String(req.body.website || '').trim()) {
      logger.warn('Honeypot triggered on register', { email, ip: req.ip });
      return res.status(201).json({
        pending: true,
        message: 'Account created — check your email to confirm your address.',
      });
    }

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    const pwdProblem = passwordProblem(password);
    if (pwdProblem) return res.status(400).json({ message: pwdProblem });

    // Acceptance is checked here, before anything is written — not on the
    // client alone, and not after the account exists. The client gate is a
    // courtesy to the person filling in the form; this is the rule. An account
    // that was created and then found to be missing consent would already be a
    // record we had no basis to hold, and the "delete it afterwards" version of
    // that is not the same thing as never creating it.
    const consentIssue = consentProblem(consent);
    if (consentIssue) return res.status(400).json({ message: consentIssue });

    // The program is derived from the course/specialization the academic step
    // already collects, not asked for separately. An explicit `program` in the
    // body still wins so non-form clients can set it directly.
    const program = explicitProgram?.id
      ? explicitProgram
      : resolveProgramFromCourse({ course, specialization, graduationYear, college });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // A valid referral code from an approved member auto-approves the account.
    // Codes are strictly one-time: the claim below atomically marks the code as
    // used, so two simultaneous signups can never share one code.
    let referrer = null;
    const newUserId = new mongoose.Types.ObjectId();
    if (referralCode) {
      const code = referralCode.trim().toUpperCase();
      referrer = await User.findOneAndUpdate(
        { referralCode: code, status: { $ne: 'pending' }, referralUsedBy: null },
        { referralUsedBy: newUserId }
      );
      if (!referrer) {
        const exists = await User.exists({ referralCode: code });
        return res.status(400).json({
          message: exists
            ? 'This referral code has already been used'
            : 'Invalid referral code',
        });
      }
    }

    // Two different questions, deliberately answered separately:
    //
    //   Is this person allowed in?      -> user.status, below
    //   Is their program curated yet?   -> ProgramApproval.status, further down
    //
    // These used to be conflated: auto-approval required `referrer && isPreset`,
    // so a valid one-time code admitted a B.Tech CSE student instantly and left
    // an otherwise identical B.Com or Medical student in the approval queue.
    // CURATED_COMBOS covers 17 of the 40 course/specialisation pairs the signup
    // form offers, so that was most students — while the invite they were sent
    // promised "instant access". Worse, the code above is claimed before this
    // check ran, so the code was burned either way and nobody else could use it.
    //
    // A referral is a vouch for the person, and it is one-time and traceable to
    // an approved member, which is exactly the signal admission should turn on.
    // Whether anyone has curated a feed for "Medical (MBBS)" is a separate
    // question, still tracked on the ProgramApproval record and still reviewed
    // by an admin — it just no longer decides whether a vouched-for student can
    // log in. The content sync runs on verification either way (it tags existing
    // rows onto the new slug; there is no expensive provisioning to gate on).
    const isPresetProgram = program.type === 'preset';
    const autoApproved = isAdminEmail(email) || Boolean(referrer);
    const approvalStatus = autoApproved ? 'approved' : 'pending';

    let user;
    let programApproval;
    try {
      const hashed = await bcrypt.hash(password, 10);
      user = await User.create({
        _id: newUserId,
        name,
        email,
        password: hashed,
        role: isAdminEmail(email) ? 'admin' : 'member',
        status: approvalStatus,
        rollNumber: rollNumber ? String(rollNumber).trim() : '',
        referralCode: await uniqueReferralCode(name),
        referredBy: referrer ? referrer._id : null,
        // ⭐ Program Personalization
        program: {
          id: program.id,
          label: program.label,
          type: program.type,
          customName: program.customName || null,
          category: program.category || null,
          specialization: program.specialization || null,
          cohort: program.cohort || null,
          institution: program.institution || null,
        },
        // We will set studentType and workExYears after we have experience data
        studentType: 'fresher', // temporary, will update below
        workExYears: null, // temporary
        // Written in the same operation that creates the account, so no user
        // document ever exists without its acceptance record. acceptedAt comes
        // from the server clock; the client's own timestamp is not persisted.
        consent: {
          acceptedAt: new Date(),
          terms: true,
          privacy: true,
          econtract: true,
          versions: { ...CURRENT_VERSIONS },
          ip: req.ip || '',
          userAgent: String(req.get('user-agent') || '').slice(0, 300),
        },
      });

      // Curation state for the program itself, independent of whether the
      // person registering was admitted. A preset program is curated by
      // definition; a custom one waits for an admin to decide whether it
      // deserves its own feed and community, or should be folded into an
      // existing program.
      programApproval = await ProgramApproval.create({
        programId: program.id,
        programLabel: program.label,
        programType: program.type,
        requestedBy: newUserId,
        status: isPresetProgram ? 'approved' : 'pending',
        approvedBy: isPresetProgram ? newUserId : null,
        approvedAt: isPresetProgram ? new Date() : null,
        // Content is tagged onto the slug on first verification, for preset and
        // custom alike — so neither starts out synced.
        syncStatus: 'pending',
      });

      // Link approval ID to user
      user.program.approvalId = programApproval._id;
      await user.save();
    } catch (err) {
      // Release the claimed code if account creation failed for any reason.
      if (referrer) {
        await User.updateOne(
          { _id: referrer._id, referralUsedBy: newUserId },
          { referralUsedBy: null }
        );
      }
      throw err;
    }

    // Determine studentType and workExYears from experience
    let years = 0;
    let expType = 'fresher';
    let pastDomain = '';
    if (experience && typeof experience === 'object') {
      years = experience.years || 0;
      expType = experience.type || 'fresher';
      pastDomain = experience.pastDomain || '';
    }
    // Derive studentType: if years === 0 or type is fresher-like, then fresher, else experienced
    const studentType = years === 0 || ['fresher', 'intern'].includes(expType) ? 'fresher' : 'experienced';
    const workExYears = years > 0 ? years : null;

    // programs/activeProgram drive the older module + feature-routing system;
    // program.id drives content filtering. They are the same concept, so they
    // resolve from the same place — keeping them independent is how a student
    // ends up on the MBA module with a Law feed.
    user.studentType = studentType;
    user.workExYears = workExYears;
    user.programs = [program.id];
    user.activeProgram = program.id;
    await user.save();

    if (referrer) {
      logActivity(
        'register_referral',
        `${user.name} registered with ${referrer.name}'s referral code ${referrer.referralCode} — instant access`,
        user,
        { referrerName: referrer.name, referrerEmail: referrer.email, code: referrer.referralCode }
      );
    } else if (autoApproved) {
      logActivity('register_admin', `${user.name} registered as admin (ADMIN_EMAIL match)`, user);
    } else {
      logActivity('register_pending', `${user.name} registered without a code — waiting for approval`, user);
    }

    // Normalise learningStyle client values → schema enum
    const ClientLS = { Videos: 'Visual', Reading: 'Reading/Writing', Practice: 'Kinesthetic', Discussion: 'Auditory', AI: 'Other', Mixed: 'Multimodal' };
    const normalisedLS = ClientLS[learningStyle] || (['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic', 'Multimodal', 'Other'].includes(learningStyle) ? learningStyle : 'Other');

    // Prepare profile data using canonical goal mapper
    const profileData = {
      user: user._id,
      college: college || '',
      course: course || '',
      department: department || '',
      specialization: specialization || '',
      batch: batch || '',
      semester: semester || '',
      graduationYear: graduationYear || null,
      dreamRole: dreamRole || '',
      preferredIndustries: Array.isArray(preferredIndustries) ? preferredIndustries : [],
      careerInterests: Array.isArray(careerInterests) ? careerInterests : [],
      favouriteSubjects: Array.isArray(favouriteSubjects) ? favouriteSubjects : [],
      difficultSubjects: Array.isArray(difficultSubjects) ? difficultSubjects : [],
      learningStyle: normalisedLS,
      goals: typeof goals === 'object' && !Array.isArray(goals) && goals !== null ? goals : StudentIdentity.goalsArrayToSubdoc(goals),
      experience: {
        years: years,
        type: expType,
        pastDomain: pastDomain
      },
      skills: Array.isArray(regSkills) ? regSkills : [],
      interests: [],
      clubs: [],
      languages: [],
      linkedin: '',
      github: '',
      portfolio: '',
      bio: '',
      lookingFor: '',
      priorDomain: pastDomain
    };

    // Create UserProfile (backward compat)
    await UserProfile.create(profileData);

    // Populate canonical StudentIdentity (single source of truth).
    // Explicitly construct data — never spread req.body (which contains password).
    try {
      const identity = await upsertFromRegistration(user._id, {
        name, email, rollNumber: rollNumber || '',
        studentType, workExYears,
        college: college || '', course: course || '', department: department || '',
        specialization: specialization || '', batch: batch || '', semester: semester || '',
        graduationYear: graduationYear || null,
        dreamRole: dreamRole || '',
        preferredIndustries: Array.isArray(preferredIndustries) ? preferredIndustries : [],
        careerInterests: Array.isArray(careerInterests) ? careerInterests : [],
        favouriteSubjects: Array.isArray(favouriteSubjects) ? favouriteSubjects : [],
        difficultSubjects: Array.isArray(difficultSubjects) ? difficultSubjects : [],
        learningStyle: normalisedLS,
        goals,
        experience: { years, type: expType, pastDomain },
        skills: Array.isArray(regSkills) ? regSkills : [],
        timeAvailable: timeAvailable || '',
        challenges: Array.isArray(challenges) ? challenges : [],
      });

      // Auto-follow news topics that match the student's field, so the
      // Intelligence Center's "For you" feed isn't empty on day one.
      const newsInterests = inferNewsInterests({
        domainPrimary: identity?.domainPrimary,
        specialization: identity?.specialization,
        careerInterests: identity?.careerInterests,
      });
      if (newsInterests.length > 0) {
        await User.updateOne({ _id: user._id }, { $set: { interests: newsInterests } });
      }
    } catch (err) {
      logger.error('StudentIdentity creation failed', {
        error: err.message, stack: err.stack,
        userId: user._id, email: user.email,
      });
      // Mark for backfill so migration scripts can find missing identities
      await User.updateOne(
        { _id: user._id },
        { $set: { needsIdentityBackfill: true } }
      ).catch(() => {});
    }

    // Profile data is saved above regardless of approval status, so a pending
    // signup's registration data isn't discarded while they wait.
    //
    // Nobody gets a session before proving they own the address — not even a
    // referred or auto-approved account. That single rule is what keeps bots
    // out of the admin queue, so it has no exceptions.
    //
    // And nobody is mailed before their acceptance is on the record. The write
    // happened in User.create above; this re-reads what was actually stored
    // rather than trusting that it was, because the confirmation email is the
    // step that turns a form submission into a live account — sending it
    // against an unrecorded consent is exactly the thing this flow exists to
    // prevent. A failure here is a bug, not a user error, so it does not reach
    // the student as advice they can act on.
    if (!user.consent?.acceptedAt) {
      logger.error('Consent record missing after registration — verification email withheld', {
        userId: user._id, email: user.email,
      });
      // Unwind rather than leave a half-made account behind: a user row with no
      // acceptance on it is a record there is no basis to keep, and it would
      // also squat on the email address so the person could not simply retry.
      await Promise.all([
        User.deleteOne({ _id: user._id }),
        UserProfile.deleteOne({ user: user._id }),
        ProgramApproval.deleteOne({ _id: programApproval._id }),
        referrer
          ? User.updateOne({ _id: referrer._id, referralUsedBy: user._id }, { referralUsedBy: null })
          : Promise.resolve(),
      ].map((p) => Promise.resolve(p).catch(() => {})));
      return res.status(500).json({
        message: 'Your acceptance could not be recorded, so the account was not activated. Please try again.',
      });
    }

    const verifyToken = await issueVerificationToken(user);

    logActivity(
      approvalStatus === 'pending' ? 'register_program_pending' : 'register_program_auto_approved',
      `${user.name} registered (${program.label}) — awaiting email confirmation`,
      user,
      { programId: program.id, programType: program.type, approvalId: programApproval._id }
    );

    // emailLinkBase, not raw CLIENT_URL: that variable may be a comma-separated
    // allow-list, and interpolating it whole produced links of the form
    // "https://a.com,https://b.com/verify-email?token=…" — unclickable, and the
    // account is then unrecoverable because verification gates login.
    const link = `${emailLinkBase(req)}/verify-email?token=${verifyToken}`;

    // Awaited, not fire-and-forget. Login is gated on this email, so "did it
    // actually go out" decides whether the account is usable — and the answer
    // has to reach the student, who can then use the resend action rather than
    // sitting in front of an inbox that will never receive anything.
    const delivery = await sendVerificationEmail(user, link).catch((err) => ({
      delivered: false,
      error: err.message,
    }));

    if (!delivery?.delivered) {
      logger.error('Verification email NOT delivered at registration', {
        userId: String(user._id),
        error: delivery?.error,
      });
    }

    return res.status(201).json({
      pending: true,
      needsEmailVerification: true,
      emailSent: Boolean(delivery?.delivered),
      message: delivery?.delivered
        ? 'Account created — check your email to confirm your address.'
        : "Account created, but we couldn't send the confirmation email just now. Use “resend confirmation email” on the login page in a moment.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Tell the admin somebody is waiting.
 *
 * Sent on confirmation rather than on submit, deliberately. Registration is
 * unauthenticated and rate-limited but still scriptable, and the whole reason
 * login is gated on a confirmed address is that "a bot with a fake address
 * costs the admin nothing". Alerting at submit would hand that cost straight
 * back: an inbox full of approve buttons for accounts that do not exist. From
 * a real student's side the two moments are seconds apart.
 *
 * Fire-and-forget by design — the student's confirmation response must not wait
 * on, or fail with, the admin's mail server.
 */
async function notifyAdminOfPendingRegistration(user) {
  const admin = await adminUser();
  if (!admin) {
    logger.warn('No ADMIN_EMAIL account — pending signup not announced', {
      userId: String(user._id),
    });
    return;
  }

  // The approval screen's fields live on StudentIdentity, not on User. A
  // missing identity (the backfill path in register) must not cost the admin
  // the alert, so this degrades to the User fields alone.
  let details = {};
  try {
    const identity = await StudentIdentity.findOne({ user: user._id }).lean();
    if (identity) {
      details = {
        college: identity.college,
        course: identity.course,
        specialization: identity.specialization,
        batch: identity.batch,
        graduationYear: identity.graduationYear,
        dreamRole: identity.dreamRole,
        skills: identity.skills,
        careerInterests: identity.careerInterests,
      };
    }
  } catch (err) {
    logger.warn('Could not load identity for admin alert', { error: err.message });
  }

  if (user.referredBy) {
    const referrer = await User.findById(user.referredBy).select('name').lean().catch(() => null);
    if (referrer) details.referredByName = referrer.name;
  }

  const base = serverLinkBase();
  const approveUrl = base
    ? `${base}/api/auth/approve/${user._id}/${mintApprovalToken(user)}`
    : '';

  await sendAdminNewRegistrationEmail(admin, user, details, approveUrl);
}

// Confirming the address is what turns a raw signup into a real account: it's
// where the referral auto-approve resolves and where the program sync fires.
// Doing that work at registration would mean bots trigger it.
exports.verifyEmail = async (req, res, next) => {
  try {
    const raw = String(req.body.token || req.query.token || '');
    if (!raw) return res.status(400).json({ message: 'Verification token is required' });

    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const user = await User.findOne({
      verifyTokenHash: tokenHash,
      verifyTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'This confirmation link is invalid or has expired. Request a new one from the login page.',
      });
    }

    user.emailVerifiedAt = new Date();
    user.verifyTokenHash = null;
    user.verifyTokenExpires = null;
    await user.save();

    // Only now does the account become real enough to justify the work.
    if (user.status === 'approved') {
      const approval = await ProgramApproval.findById(user.program?.approvalId);
      if (approval) {
        ensureProgramSynced(approval, user.program).catch((err) =>
          logger.error('Program sync after verification failed', {
            error: err.message, programId: user.program?.id,
          })
        );
      }
      sendWelcomeEmail(user).catch((err) =>
        logger.error('Welcome email failed', { error: err.message })
      );
      const device = deviceFromRequest(req);
      await deviceSessions.register(user._id, device);
      return res.json({ token: signToken(user, device.deviceId), verified: true });
    }

    notifyAdminOfPendingRegistration(user).catch((err) =>
      logger.error('Admin registration alert failed', {
        error: err.message, userId: String(user._id),
      })
    );

    res.json({
      verified: true,
      pending: true,
      message: 'Email confirmed. An admin will review your account shortly.',
    });
  } catch (err) { next(err); }
};

/**
 * Reissue a verification link.
 *
 * Verification is a hard login gate with an expiring token, so without this an
 * account whose link lapsed was unrecoverable: it could not log in (403), could
 * not re-register (409 — the email is taken), and had no way to ask for another
 * link. verifyEmail's own error text already pointed users here.
 *
 * The response is byte-identical in every case — unknown address, already
 * verified, cooldown active, mail sent. Anything else would turn this into the
 * account-enumeration oracle that forgotPassword deliberately avoids being.
 * Route-level rate limiting (authLimiter) bounds it per IP; the per-account
 * cooldown bounds how much mail one address can be made to receive.
 */
exports.resendVerification = async (req, res, next) => {
  const generic = {
    message:
      'If that address needs confirming, a new link is on its way. Check your inbox and spam folder.',
  };
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !EMAIL_RE.test(email)) return res.json(generic);

    const user = await User.findOne({ email });
    // Unknown address, or one that is already confirmed: say nothing either way.
    if (!user || user.emailVerifiedAt) return res.json(generic);

    // Already sent one moments ago — answer the same, just don't send again.
    if (verificationIssuedRecently(user)) {
      logger.info('Verification resend suppressed by cooldown', { userId: String(user._id) });
      return res.json(generic);
    }

    const token = await issueVerificationToken(user);
    const link = `${emailLinkBase(req)}/verify-email?token=${token}`;
    sendVerificationEmail(user, link).catch((err) =>
      logger.error('Verification resend email failed', {
        error: err.message,
        userId: String(user._id),
      })
    );
    logActivity('verification_resent', `${user.name} requested a new confirmation link`, user);

    return res.json(generic);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    // +password: the field is select:false on the schema, so the hash has to
    // be asked for explicitly. Without it bcrypt.compare gets undefined and
    // every sign-in fails.
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // Accounts predating email verification have no verifyTokenHash and were
    // never sent a link — gating them would lock out every existing user, so
    // only accounts issued a token are held to it.
    if (!user.emailVerifiedAt && user.verifyTokenHash && !isAdminEmail(user.email)) {
      return res.status(403).json({
        needsEmailVerification: true,
        message: 'Confirm your email address first — check your inbox for the link.',
      });
    }
    // Only explicit 'pending' is blocked — accounts created before gating pass through.
    if (user.status === 'pending' && !isAdminEmail(user.email)) {
      return res.status(403).json({
        pending: true,
        message: 'Your account is awaiting admin approval. You will get an email once approved.',
      });
    }
    // Promote on login so the admin account works even if it registered
    // before ADMIN_EMAIL was configured.
    if (isAdminEmail(user.email) && (user.role !== 'admin' || user.status !== 'approved')) {
      user.role = 'admin';
      user.status = 'approved';
      await user.save();
      // Drop any cached session record so the new role is authoritative
      // immediately rather than after the cache TTL.
      sessionVersion.invalidate(user._id);
    }
    // Terms in force now, not terms in force whenever this account was made.
    //
    // Accounts predating the signup consent gate carry no acceptance at all,
    // and accounts that accepted an earlier revision have not agreed to the
    // current one — both are held here rather than being quietly treated as
    // consenting. Unlike the two gates above there is no admin exemption: the
    // point of the record is that it exists for everyone who uses the platform,
    // and an admin can satisfy it the same way anyone else does.
    //
    // The response is a 403 with a ticket, not a session. Nothing about this
    // account is readable until the acceptance is recorded by acceptConsent.
    if (!consentIsCurrent(user.consent)) {
      return res.status(403).json({
        needsConsent: true,
        consentToken: mintConsentToken(user),
        versions: { ...CURRENT_VERSIONS },
        message: user.consent?.acceptedAt
          ? 'Our Terms of Use and Privacy Policy have changed — please read and accept them to continue.'
          : 'Please read and accept our Terms of Use and Privacy Policy to continue.',
      });
    }

    const device = deviceFromRequest(req);
    const { evicted } = await deviceSessions.register(user._id, device);

    res.json({
      token: signToken(user, device.deviceId),
      // Lets the client tell the student why another device just dropped out,
      // rather than that device appearing to fail for no reason.
      deviceEvicted: evicted,
      maxDevices: deviceSessions.MAX_DEVICES,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Record an existing account's acceptance and finish the sign-in it was holding.
 *
 * This is the second half of a login that stopped at the re-consent gate, which
 * is why it ends by issuing the session that login withheld: making someone log
 * in twice around an interstitial teaches them to retype a password whenever a
 * page asks, and the password was already checked a moment ago.
 *
 * Validation is the same `consentProblem` the signup path uses. One rule, one
 * implementation — a second, laxer copy for existing users would make the
 * weaker of the two the real policy.
 */
exports.acceptConsent = async (req, res, next) => {
  try {
    const { consentToken, consent } = req.body;
    if (!consentToken) {
      return res.status(400).json({ message: 'Missing consent token — please sign in again.' });
    }

    let payload;
    try {
      payload = jwt.verify(consentToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'This took too long — please sign in again.' });
    }
    // A session token must not work here, and this ticket must not work as a
    // session. verifyToken already refuses anything without a `did`; this is
    // the other half of that pair.
    if (payload.purpose !== 'consent') {
      return res.status(401).json({ message: 'Invalid consent token' });
    }

    const consentIssue = consentProblem(consent);
    if (consentIssue) return res.status(400).json({ message: consentIssue });

    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'Account not found — please sign in again.' });
    // A password change or revocation between the two requests invalidates the
    // ticket: the person holding it may no longer be the account holder.
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Your session changed — please sign in again.' });
    }

    user.consent = {
      acceptedAt: new Date(),
      terms: true,
      privacy: true,
      econtract: true,
      versions: { ...CURRENT_VERSIONS },
      ip: req.ip || '',
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
    };
    await user.save();

    logActivity('consent_accepted', `${user.name} accepted the current terms`, user, {
      versions: CURRENT_VERSIONS,
    });

    const device = deviceFromRequest(req);
    const { evicted } = await deviceSessions.register(user._id, device);

    res.json({
      token: signToken(user, device.deviceId),
      deviceEvicted: evicted,
      maxDevices: deviceSessions.MAX_DEVICES,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -resetTokenHash -resetTokenExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Accounts created before referral codes existed get one lazily.
    if (!user.referralCode) {
      user.referralCode = await uniqueReferralCode(user.name);
      await user.save();
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio, linkedin, github } = req.body;
    const updates = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      updates.name = String(name).trim();
    }
    if (bio !== undefined) updates.bio = String(bio);
    if (linkedin !== undefined) updates.linkedin = String(linkedin);
    if (github !== undefined) updates.github = String(github);

    await updateIdentity(req.user.userId, updates);

    const user = await User.findByIdAndUpdate(req.user.userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password -resetTokenHash -resetTokenExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user, token: signToken(user, req.user?.deviceId) });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    const pwdProblem = passwordProblem(newPassword);
    if (pwdProblem) return res.status(400).json({ message: pwdProblem });

    const user = await User.findById(req.user.userId).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Clear every device, then re-register the one making the change: a
    // password change should sign out everyone the password was shared with.
    await deviceSessions.revokeAll(user._id);
    const device = deviceFromRequest(req);
    await deviceSessions.register(user._id, device);
    sessionVersion.invalidate(user._id);

    // Every previously issued token is now dead, including the caller's own.
    // Hand back a fresh one so changing your password does not log you out of
    // the tab you changed it in, while still evicting every other session.
    res.json({ message: 'Password updated', token: signToken(user, device.deviceId) });
  } catch (err) {
    next(err);
  }
};

// ---- Password reset via email link ----

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    // Always answer the same way so the endpoint can't be used to probe emails.
    const generic = { message: 'If an account exists for that email, a reset link has been sent.' };
    if (!email || !EMAIL_RE.test(email)) return res.json(generic);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json(generic);

    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    // In production this is CLIENT_URL and nothing else. The request's Origin
    // header is attacker-controlled on a cross-origin POST, so honouring it
    // here would let anyone have DATAD mail a victim a real reset token
    // pointed at a host the attacker owns. See utils/clientUrl.js.
    const link = `${emailLinkBase(req)}/reset-password?token=${token}`;
    sendPasswordResetEmail(user, link).catch((err) =>
      // meta must be an object — passing a bare string spreads it per-character
      // into the log record, which is how this line was rendering until now.
      logger.error('Reset email failed', { error: err.message, userId: String(user._id) })
    );
    logActivity('password_reset_requested', `${user.name} requested a password reset link`, user);
    res.json(generic);
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    const pwdProblem = passwordProblem(password);
    if (pwdProblem) return res.status(400).json({ message: pwdProblem });

    // Acceptance is checked here, before anything is written — not on the
    // client alone, and not after the account exists. The client gate is a
    // courtesy to the person filling in the form; this is the rule. An account
    // that was created and then found to be missing consent would already be a
    // record we had no basis to hold, and the "delete it afterwards" version of
    // that is not the same thing as never creating it.
    const consentIssue = consentProblem(consent);
    if (consentIssue) return res.status(400).json({ message: consentIssue });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    // The whole point of a reset is to evict whoever had the old password.
    // Without this the attacker's 7-day token outlives the recovery.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    // Nothing is preserved here: whoever triggered the reset has to sign in
    // again, and so does anyone the old password had been shared with.
    await deviceSessions.revokeAll(user._id);
    sessionVersion.invalidate(user._id);
    logActivity('password_reset_done', `${user.name} reset their password via email link`, user);
    res.json({ message: 'Password reset — you can now log in' });
  } catch (err) {
    next(err);
  }
};

// Permanently remove the account and everything the user owns.
exports.deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    await cleanupUserData(userId);

    await User.deleteOne({ _id: userId });
    logActivity('account_deleted', `${user.name} deleted their account and all data`, user);
    res.json({ message: 'Your account and all your data have been deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Device sessions ───────────────────────────────────────────────────────
//
// Surfaced to the student as "Your devices". This is a security feature they
// benefit from — seeing and evicting an unrecognised session — that also
// happens to make casual account sharing visible and inconvenient.

exports.listDevices = async (req, res, next) => {
  try {
    const exempt = deviceSessions.isExempt(req.user.email);
    res.json({
      devices: await deviceSessions.list(req.user.userId, req.user.deviceId),
      max: exempt ? null : deviceSessions.MAX_DEVICES,
      unlimited: exempt,
    });
  } catch (err) { next(err); }
};

exports.revokeDevice = async (req, res, next) => {
  try {
    const ok = await deviceSessions.revoke(req.user.userId, String(req.params.id || ''));
    if (!ok) return res.status(404).json({ message: 'That device is not signed in.' });
    res.json({ message: 'Device signed out.' });
  } catch (err) { next(err); }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'datad/avatars',
      public_id: `user_${req.user.userId}`,
      overwrite: true,
      transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
    });
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { avatarUrl: result.secure_url },
      { new: true }
    ).select('-password -resetTokenHash -resetTokenExpires');
    res.json({ avatarUrl: result.secure_url, user });
  } catch (err) {
    next(err);
  }
};

// ---- One-click approval from the registration alert email ----------------
//
// Two handlers for one button, and the split is the point. Corporate mail
// scanners GET every link in an inbound message before the human sees it, so
// the URL in the email must be safe to fetch: it renders a page. Only the POST
// that page submits changes anything.

/**
 * A standalone page, since the recipient has no session and may not be signed
 * in. No script of any kind: the API's CSP sets `script-src 'self'` and
 * `script-src-attr 'none'`, so an inline handler here would silently not run.
 */
const approvalPage = (heading, body) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading} — DATAD</title>
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#F6F7FB;color:#111827;
       margin:0;display:grid;place-items:center;min-height:100vh;padding:24px}
  .card{background:#fff;border-radius:14px;padding:32px;max-width:460px;width:100%;
        box-shadow:0 1px 3px rgba(8,11,20,.08),0 12px 32px rgba(8,11,20,.06)}
  h1{font-size:19px;margin:0 0 14px}
  dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:14px;margin:0 0 22px}
  dt{color:#6b7280}
  dd{margin:0}
  p{font-size:14px;line-height:1.6;color:#374151}
  button{background:#4D7CFF;color:#fff;border:0;border-radius:8px;padding:11px 22px;
         font-size:14px;font-weight:600;cursor:pointer}
</style></head>
<body><div class="card"><h1>${heading}</h1>${body}</div></body></html>`;

/**
 * The confirmation screen behind the email's button. Safe for a link scanner to
 * fetch: it reads, it does not write.
 */
exports.approvalLanding = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).catch(() => null);
    if (!user || !approvalTokenMatches(user, req.params.token)) {
      return res.status(400).type('html').send(
        approvalPage('This link is not valid', '<p>It may belong to an account that was removed. Approve from the admin dashboard instead.</p>')
      );
    }
    if (user.status !== 'pending') {
      return res.type('html').send(
        approvalPage('Already handled', `<p><strong>${esc(user.name)}</strong> is already approved — nothing left to do.</p>`)
      );
    }

    res.type('html').send(
      approvalPage(
        'Approve this account?',
        `<dl>
           <dt>Name</dt><dd>${esc(user.name)}</dd>
           <dt>Email</dt><dd>${esc(user.email)}</dd>
           <dt>Program</dt><dd>${esc(user.program?.label || '—')}</dd>
         </dl>
         <p>Approving admits them immediately and emails them the good news.</p>
         <form method="post">
           <button type="submit">Approve ${esc(user.name.split(' ')[0])}</button>
         </form>`
      )
    );
  } catch (err) { next(err); }
};

/**
 * The actual approval. Authorised by the signed token alone — the admin is
 * reading mail, not holding a session — which is why the token is an HMAC over
 * JWT_SECRET and why the handler refuses anything not still `pending`: that is
 * what stops a forwarded email from being replayed into a second approval.
 */
exports.approveFromEmail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).catch(() => null);
    if (!user || !approvalTokenMatches(user, req.params.token)) {
      logger.warn('Rejected an email approval link', { userId: req.params.id, ip: req.ip });
      return res.status(400).type('html').send(
        approvalPage('This link is not valid', '<p>Approve from the admin dashboard instead.</p>')
      );
    }

    const admin = await adminUser();
    const result = await approveAccount(user, { approvedBy: admin?._id, via: 'email' });

    if (!result.approved) {
      return res.type('html').send(
        approvalPage('Already handled', `<p><strong>${esc(user.name)}</strong> is already approved.</p>`)
      );
    }

    res.type('html').send(
      approvalPage(
        'Approved ✅',
        `<p><strong>${esc(user.name)}</strong> can log in now, and we've emailed them to say so.</p>`
      )
    );
  } catch (err) { next(err); }
};
