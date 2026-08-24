const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    // select:false so the bcrypt hash is never returned by an ordinary query.
    // Every handler that sends a user document currently remembers to exclude
    // it by hand; that is one forgotten `-password` away from serving password
    // hashes to a client, and the safe default costs nothing. The four places
    // that genuinely need it — sign-in, password change, password reset and
    // account deletion — ask for it with .select('+password').
    password: { type: String, required: true, select: false },
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

    // Session revocation for stateless JWTs. Signed into every token and
    // compared on each request (services/sessionVersion.js); incrementing it
    // invalidates every token issued before the increment. Bumped on password
    // change, password reset, and role/status change. Existing documents
    // without the field read as 0, so no backfill is required.
    tokenVersion: { type: Number, default: 0 },

    // Active devices. A token is only accepted while its device is still in
    // this list, which is what caps how many people can share one login.
    // Capped and LRU-evicted atomically on sign-in — see services/deviceSessions.js.
    sessions: {
      type: [
        {
          _id: false,
          deviceId: { type: String, required: true },
          label: { type: String, default: '' },      // "Chrome on Android"
          ip: { type: String, default: '' },
          userAgent: { type: String, default: '', maxlength: 300 },
          createdAt: { type: Date, default: Date.now },
          lastSeenAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

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
    tier: { type: String, enum: ['free', 'trial', 'pro', 'placement'], default: 'free' },
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

    // The e-contract record: proof that this person accepted the Terms of Use
    // and the Privacy Policy, and agreed to be bound electronically, before the
    // account existed. Registration will not create an account without it and
    // the confirmation email is not sent until it is stored, so on any account
    // created after this shipped, `acceptedAt` is non-null.
    //
    // Versions are copied in rather than referenced, because the point of the
    // record is to name the text that was agreed to. When /terms is reworded
    // and its version bumped, this row keeps pointing at the older wording —
    // which is the only thing that makes it evidence rather than a boolean.
    //
    // `acceptedAt` is stamped by the server. A timestamp the browser chose is
    // not evidence of when anything happened.
    consent: {
      acceptedAt: { type: Date, default: null },
      // Per-clause, not a single flag: "they agreed to everything" cannot show
      // which document was agreed to if one of them is ever disputed.
      terms: { type: Boolean, default: false },
      privacy: { type: Boolean, default: false },
      econtract: { type: Boolean, default: false },
      versions: {
        terms: { type: String, default: null },
        privacy: { type: String, default: null },
      },
      // Where the acceptance came from. Not identifying on its own; it is the
      // ordinary supporting detail an acceptance record carries.
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '', maxlength: 300 },
    },
  },
  { timestamps: true }
);



const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;