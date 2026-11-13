const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateLanguagePreference,
  verifyEmail,
  resendEmailOtp
} = require('../controllers/authController');

const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { otpLimiter } = require('../middleware/securityMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Email verification endpoints
router.post('/verify-email', optionalProtect, verifyEmail);
router.post('/resend-email-otp', otpLimiter, optionalProtect, resendEmailOtp);

// Protected routes (Require JWT Bearer Token)
router.get('/me', protect, getMe);
router.patch('/language', protect, updateLanguagePreference);

module.exports = router;
