const router = require('express').Router();
const {
  register,
  login,
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
} = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');
const upload = require('../middleware/upload');
const { checkRequestSize, verifyFileSignatures, LIMITS } = require('../middleware/uploadGuards');
const { authLimiter, loginAccountLimiter } = require('../middleware/rateLimiters');

// Every unauthenticated entry point is rate limited (20 per 15 min per IP).
// Without this, register can be scripted without bound and check-email becomes
// an oracle for enumerating which addresses hold accounts.
router.get('/check-email', authLimiter, checkEmail);
router.post('/register', authLimiter, register);
// Two limiters, deliberately: authLimiter is a per-network abuse ceiling, and
// loginAccountLimiter is the actual brute-force guard, keyed on the account so
// a whole campus behind one NAT address is not throttled as a single client.
router.post('/login', authLimiter, loginAccountLimiter, login);
router.post('/verify-email', authLimiter, verifyEmail);
// Recovery for a lapsed confirmation link. Same limiter as the other
// unauthenticated entry points, and the handler answers generically so it
// cannot be used to test which addresses hold accounts.
router.post('/resend-verification', authLimiter, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);
router.post('/avatar', verifyToken, checkRequestSize(LIMITS.image), upload.single('avatar'), verifyFileSignatures, uploadAvatar);
router.put('/password', verifyToken, changePassword);
router.delete('/me', verifyToken, deleteAccount);

// "Your devices" — list active sessions and sign one out.
router.get('/devices', verifyToken, listDevices);
router.delete('/devices/:id', verifyToken, revokeDevice);

module.exports = router;
