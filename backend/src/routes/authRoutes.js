const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateLanguagePreference
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (Require JWT Bearer Token)
router.get('/me', protect, getMe);
router.patch('/language', protect, updateLanguagePreference);

module.exports = router;
