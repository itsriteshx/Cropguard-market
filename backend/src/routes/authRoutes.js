const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateLanguagePreference,
  verifyEmail,
  resendEmailOtp,
  verifyPhone,
  resendPhoneOtp
} = require('../controllers/authController');

const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { otpLimiter } = require('../middleware/securityMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Email & SMS verification endpoints
router.post('/verify-email', optionalProtect, verifyEmail);
router.post('/resend-email-otp', otpLimiter, optionalProtect, resendEmailOtp);
router.post('/verify-phone', optionalProtect, verifyPhone);
router.post('/resend-phone-otp', otpLimiter, optionalProtect, resendPhoneOtp);

// Protected routes (Require JWT Bearer Token)
router.get('/me', protect, getMe);
router.patch('/language', protect, updateLanguagePreference);

module.exports = router;
