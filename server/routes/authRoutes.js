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
} = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');
const upload = require('../middleware/upload');
const { authLimiter } = require('../middleware/rateLimiters');

// Every unauthenticated entry point is rate limited (20 per 15 min per IP).
// Without this, register can be scripted without bound and check-email becomes
// an oracle for enumerating which addresses hold accounts.
router.get('/check-email', authLimiter, checkEmail);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);
router.post('/avatar', verifyToken, upload.single('avatar'), uploadAvatar);
router.put('/password', verifyToken, changePassword);
router.delete('/me', verifyToken, deleteAccount);

module.exports = router;
