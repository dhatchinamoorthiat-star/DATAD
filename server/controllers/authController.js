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
const { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } = require('../config/mailer');
const logActivity = require('../utils/logActivity');
const { cleanupUserData } = require('../services/userCleanup');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { emailLinkBase } = require('../utils/clientUrl');
const sessionVersion = require('../services/sessionVersion');
const deviceSessions = require('../services/deviceSessions');
const signToken = require('../utils/signToken');

// The client generates this once and stores it locally; axios sends it on
// every request. It is not a secret and not proof of anything — it only has to
// be stable per browser so sessions can be counted and listed.
const deviceFromRequest = (req) => ({
  deviceId: String(req.get('x-device-id') || '').trim().slice(0, 64) || null,
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

    // Program determines approval status:
    // - Preset programs: auto-approve (or pending if no referral and not admin)
    // - Custom programs: always pending (needs admin approval + data sync)
    const isPresetProgram = program.type === 'preset';
    const isCustomProgram = program.type === 'custom';
    const autoApproved = isAdminEmail(email) || (Boolean(referrer) && isPresetProgram);
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
      });

      // Create ProgramApproval record for tracking
      programApproval = await ProgramApproval.create({
        programId: program.id,
        programLabel: program.label,
        programType: program.type,
        requestedBy: newUserId,
        status: isPresetProgram ? 'approved' : 'pending',
        approvedBy: isPresetProgram ? newUserId : null,
        approvedAt: isPresetProgram ? new Date() : null,
        syncStatus: isPresetProgram ? 'pending' : 'pending',
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
    const user = await User.findOne({ email: email.toLowerCase() });
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

    const user = await User.findById(req.user.userId);
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

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    });
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
    const user = await User.findById(userId);
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
