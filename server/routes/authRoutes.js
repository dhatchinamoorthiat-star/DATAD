const router = require('express').Router();
const {
  register,
  login,
  acceptConsent,
  getMe,
  updateProfile,
  uploadAvatar,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
  checkEmail,
  verifyEmail,
  resendVerification,
  listDevices,
  revokeDevice,
  approvalLanding,
  approveFromEmail,
} = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');
const upload = require('../middleware/upload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');
const {
  authLimiter,
  loginAccountLimiter,
  checkEmailLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  verifyEmailLimiter,
  resetPasswordLimiter,
} = require('../middleware/rateLimiters');

// Every unauthenticated entry point is rate limited (20 per 15 min per IP).
// Without this, register can be scripted without bound and check-email becomes
// an oracle for enumerating which addresses hold accounts.
// One limiter instance per route, not one shared instance across all of them.
// Sharing `authLimiter` gave these endpoints a single counter, so scripting the
// cheapest one (/check-email) spent the budget for signing in — for every
// student behind the same campus NAT. See middleware/rateLimiters.js.
router.get('/check-email', checkEmailLimiter, checkEmail);
router.post('/register', registerLimiter, register);
// Two limiters, deliberately: authLimiter is a per-network abuse ceiling, and
// loginAccountLimiter is the actual brute-force guard, keyed on the account so
// a whole campus behind one NAT address is not throttled as a single client.
router.post('/login', authLimiter, loginAccountLimiter, login);
// The second half of a login that stopped at the re-consent gate. Reached with
// the short-lived ticket that gate hands out, not with a session — see
// acceptConsent. authLimiter because it is an unauthenticated entry point in
// the same sense /login is.
router.post('/accept-consent', authLimiter, acceptConsent);
router.post('/verify-email', verifyEmailLimiter, verifyEmail);
// Recovery for a lapsed confirmation link. Same limiter as the other
// unauthenticated entry points, and the handler answers generically so it
// cannot be used to test which addresses hold accounts.
router.post('/resend-verification', resendVerificationLimiter, resendVerification);
// One-click approval from the registration alert email. Unauthenticated on
// purpose: the admin is in their inbox, not in the app, so the signed token in
// the path is the whole authorisation — see utils/approvalToken.
//
// The GET only renders a confirmation page. That split is not decoration:
// corporate link scanners fetch every URL in an inbound email, so a GET that
// approved directly would admit every applicant before the admin read the
// subject line. Only the POST from that page writes.
//
// authLimiter, because these paths take an unauthenticated id + token and must
// not become an offline-ish oracle for guessing either.
router.get('/approve/:id/:token', authLimiter, approvalLanding);
router.post('/approve/:id/:token', authLimiter, approveFromEmail);

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);
router.post('/avatar', verifyToken, checkRequestSize(LIMITS.image), upload.single('avatar'), verifyFileSignatures, uploadAvatar);
router.put('/password', verifyToken, changePassword);
router.delete('/me', verifyToken, deleteAccount);

// "Your devices" — list active sessions and sign one out.
router.get('/devices', verifyToken, listDevices);
router.delete('/devices/:id', verifyToken, revokeDevice);

module.exports = router;
