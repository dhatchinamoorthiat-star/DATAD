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
const { upsertFromRegistration, updateIdentity } = require('../services/studentIdentityService');
const { inferNewsInterests } = require('../utils/domainClassifier');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../config/mailer');
const logActivity = require('../utils/logActivity');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

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

const signToken = (user) =>
  jwt.sign(
    { userId: user._id, name: user.name, email: user.email, role: user.role || 'member', tier: user.tier || 'free', studentType: user.studentType || 'fresher', programs: user.programs || ['general'], activeProgram: user.activeProgram || 'general' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

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

exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      referralCode,
      rollNumber,
      // ⭐ Program Personalization
      program,
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

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    const pwdProblem = passwordProblem(password);
    if (pwdProblem) return res.status(400).json({ message: pwdProblem });

    // Program validation
    if (!program || !program.id || !program.label) {
      return res.status(400).json({ message: 'Program selection is required' });
    }
    if (!['preset', 'custom'].includes(program.type)) {
      return res.status(400).json({ message: 'Invalid program type' });
    }

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

    // Map the student's chosen course to a registered module slug. Only
    // 'mba' has a dedicated module today (with MBA-specific tooling like
    // case-interview prep); every other course — including "Other" free
    // text — lands on 'general', the discipline-agnostic default with the
    // same full feature set. This is the one place a course selection
    // actually reaches the module/feature-routing system; previously
    // programs/activeProgram were hardcoded to ['mba']/'mba' regardless
    // of what a student picked at signup.
    const programSlug = (course || '').trim().toLowerCase() === 'mba' ? 'mba' : 'general';

    // Update user with computed studentType, workExYears, and program
    user.studentType = studentType;
    user.workExYears = workExYears;
    user.programs = [programSlug];
    user.activeProgram = programSlug;
    await user.save();

    if (referrer) {
      logActivity(
        'register_referral',
        `${user.name} registered with ${referrer.name}'s referral code ${referrer.referralCode} — instant access`,
        user,
        { referrerName: referrer.name, referrerEmail: referrer.email, code: referrer.referralCode }
      );
    } else if (approved) {
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

    // Profile data (course, specialization, interests, etc.) is now saved
    // above regardless of approval status — this gate only controls the
    // response/token/email, so a pending signup's registration data isn't
    // silently discarded while they wait for an admin to approve them.

    if (approvalStatus === 'pending') {
      const message = isCustomProgram
        ? `Account created for ${program.label}! Admin will verify your program and sync all data shortly.`
        : 'Account created — an admin will review and approve it shortly.';

      logActivity(
        'register_program_pending',
        `${user.name} registered with ${isCustomProgram ? 'custom' : 'preset'} program: ${program.label}`,
        user,
        { programId: program.id, programType: program.type, approvalId: programApproval._id }
      );

      return res.status(201).json({
        pending: true,
        message,
        programAwaitingApproval: isCustomProgram,
      });
    }

    // Auto-approved: Preset program + referral
    if (isPresetProgram && referrer) {
      logActivity(
        'register_program_auto_approved',
        `${user.name} registered with preset program ${program.label} via referral`,
        user,
        { programId: program.id, referrerName: referrer.name }
      );

      // Fire-and-forget: registration must not fail if the mail service is down.
      sendWelcomeEmail(user).catch((err) => logger.error('Welcome email failed:', { error: err.message }));
      return res.status(201).json({
        token: signToken(user),
        programReady: true,
      });
    }

    // Fire-and-forget: registration must not fail if the mail service is down.
    sendWelcomeEmail(user).catch((err) => logger.error('Welcome email failed:', { error: err.message }));
    res.status(201).json({ token: signToken(user) });
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
    }
    res.json({ token: signToken(user) });
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
    res.json({ user, token: signToken(user) });
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
    await user.save();
    res.json({ message: 'Password updated' });
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

    // Build the reset link from wherever the user is actually browsing —
    // through an ngrok tunnel the request Origin is the tunnel URL, and a
    // localhost CLIENT_URL link would be unreachable for them.
    const origin = req.get('origin') || '';
    const trustedOrigin = /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok\.app|ngrok\.io)$/.test(origin)
      ? origin
      : process.env.CLIENT_URL.split(',')[0].trim();
    const link = `${trustedOrigin}/reset-password?token=${token}`;
    sendPasswordResetEmail(user, link).catch((err) =>
      logger.error('Reset email failed:', err.message)
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
    await user.save();
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

    await Promise.all([
      Album.deleteMany({ createdBy: userId }),
      Note.deleteMany({ author: userId }),
      Task.deleteMany({ createdBy: userId }),
      Expense.deleteMany({ user: userId }),
      Budget.deleteMany({ user: userId }),
      Resume.deleteMany({ user: userId }),
      JournalEntry.deleteMany({ user: userId }),
      Announcement.deleteMany({ createdBy: userId }),
    ]);
    // Shared tasks created by others but assigned to this user: unassign, don't delete.
    await Task.updateMany({ assignee: userId }, { assignee: null });
    // If someone spent their one-time referral code on this account, give it back.
    await User.updateMany({ referralUsedBy: userId }, { referralUsedBy: null });

    await User.deleteOne({ _id: userId });
    logActivity('account_deleted', `${user.name} deleted their account and all data`, user);
    res.json({ message: 'Your account and all your data have been deleted' });
  } catch (err) {
    next(err);
  }
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
