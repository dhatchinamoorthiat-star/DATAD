const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    interests: { type: [{ type: String, maxlength: 40 }], default: [] },

    // Signup gating: pending accounts wait for admin approval unless they
    // registered with a valid referral code from an approved member.
    status: { type: String, enum: ['pending', 'approved'], default: 'approved' },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // One-time use: set to the account that redeemed this user's code.
    referralUsedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Roll number (no format restrictions — any string)
    rollNumber: { type: String, default: '', trim: true },

    // Profile
    avatarUrl: { type: String, maxlength: 500, default: '' },
    bio: { type: String, maxlength: 300, default: '' },
    linkedin: { type: String, maxlength: 200, default: '' },
    github: { type: String, maxlength: 200, default: '' },

    // Password reset (hashed token + expiry)
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },

    // Email verification. Proving inbox ownership is what actually filters
    // bots — admin approval is for judging people, not for blocking scripts.
    // Only the hash is stored, same as the reset flow: a leaked DB must not
    // yield usable tokens.
    emailVerifiedAt: { type: Date, default: null },
    verifyTokenHash: { type: String, default: null },
    verifyTokenExpires: { type: Date, default: null },

    // Background
    studentType: { type: String, enum: ['fresher', 'experienced'], default: 'fresher' },
    workExYears: { type: Number, min: 0, max: 40, default: null },

    // Subscription / tier
    tier: { type: String, enum: ['free', 'trial', 'pro', 'max'], default: 'free' },
    trialStartedAt: { type: Date, default: null },
    tierExpiresAt: { type: Date, default: null },    // null = never expires
    subscriptionRef: { type: String, default: null }, // last verified payment ref

    // Module system: which module's feature set and dashboard the user gets.
    // Set from program.id at registration — moduleContext, moduleRoutes and the
    // client's AuthContext all still read these, so they can't be dropped in
    // favour of `program` below without migrating those first.
    programs: { type: [{ type: String }], default: ['general'] },
    activeProgram: { type: String, default: 'general' },

    // Content personalization: the richer record driving every content filter.
    // program.id is the same slug as activeProgram.
    program: {
      id: { type: String, default: null },              // 'mba', 'btech-cs', 'custom-xyz'
      label: { type: String, default: null },           // 'MBA', 'BTech Computer Science'
      type: { type: String, enum: ['preset', 'custom'], default: null },
      customName: { type: String, default: null },      // User-typed program name (if type='custom')
      category: { type: String, default: null },        // 'Master', 'Bachelor', 'Diploma'
      specialization: { type: String, default: null },  // 'Finance', 'AI/ML', etc
      cohort: { type: Number, default: null },          // Graduation year
      institution: { type: String, default: null },     // College name
      approvalId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProgramApproval', default: null },
    },

    // Program change history (max 1 change allowed)
    programHistory: [{
      program: {
        id: String,
        label: String,
      },
      changedAt: { type: Date, default: Date.now },
      reason: { type: String, enum: ['graduation_completed', 'transfer_certificate', 'career_change'] },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
    }],
    canChangeProgramAgain: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
