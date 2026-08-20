const jwt = require('jsonwebtoken');

/**
 * Mint a session token.
 *
 * Single source of truth deliberately: `verifyToken` rejects any token missing
 * `tv` or carrying a `did` it cannot find, so a second hand-rolled jwt.sign
 * elsewhere produces tokens that authenticate once and then 401 on the very
 * next request. Every path that issues a token goes through here.
 *
 * `program` drives every content filter (server) and the program UI (client,
 * which decodes this same token) — omitting it silently disables both.
 */
const signToken = (user, deviceId) =>
  jwt.sign(
    { userId: user._id, name: user.name, email: user.email, role: user.role || 'member', tier: user.tier || 'free',
      // Session version — compared on every request so a password change or
      // role change can revoke tokens already in the wild. See
      // services/sessionVersion.js.
      tv: user.tokenVersion || 0,
      // Device this token was issued to. Checked against the account's active
      // device list on every request, which is what caps account sharing.
      did: deviceId || undefined, studentType: user.studentType || 'fresher', programs: user.programs || ['general'], activeProgram: user.activeProgram || 'general',
      program: user.program?.id
        ? {
            id: user.program.id,
            label: user.program.label,
            type: user.program.type,
            customName: user.program.customName,
            category: user.program.category,
            specialization: user.program.specialization,
            cohort: user.program.cohort,
            institution: user.program.institution,
          }
        : undefined },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

module.exports = signToken;
