const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * Normalizes Indian mobile number by removing non-digits, country code (+91/91),
 * and leading zero to yield a consistent 10-digit format.
 */
const sanitizePhone = (val) => {
  if (!val) return '';
  let cleaned = String(val).trim().replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
};

/**
 * @desc    Register a new user (Farmer, Retail Buyer, Wholesale Buyer)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      role,
      languagePreference,
      location
    } = req.body;

    const cleanPhone = sanitizePhone(phone);
    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined;

    // Validate required fields
    if (!name || !cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, valid phone number, and password'
      });
    }

    // Administrative accounts must be provisioned outside public registration.
    const publicRoles = ['FARMER', 'BUYER_RETAIL', 'BUYER_WHOLESALE'];
    if (role && !publicRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid registration role' });
    }

    // Check if phone number already registered
    const existingPhone = await User.findOne({ phone: cleanPhone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'A user with this phone number already exists'
      });
    }

    // Check if email already registered (if email is provided)
    if (cleanEmail) {
      const existingEmail = await User.findOne({ email: cleanEmail });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email already exists'
        });
      }
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password,
      role: role || 'FARMER',
      languagePreference: languagePreference || 'en',
      location: location || {
        type: 'Point',
        coordinates: [0, 0]
      }
    });

    // Generate JWT Token
    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        languagePreference: user.languagePreference,
        location: user.location,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user with Phone/Email and Password
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { phone, email, password } = req.body;

    const cleanPhone = phone ? sanitizePhone(phone) : '';
    const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Must provide either phone or email, and password
    if ((!cleanPhone && !cleanEmail) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number (or email) and password'
      });
    }

    // Find user by phone or email and include password for check
    const query = cleanPhone ? { phone: cleanPhone } : { email: cleanEmail };
    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    // Generate JWT Token
    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        languagePreference: user.languagePreference,
        location: user.location,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Requires Bearer Token)
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user language preference
 * @route   PATCH /api/auth/language
 * @access  Private (Requires Bearer Token)
 */
const updateLanguagePreference = async (req, res, next) => {
  try {
    const { languagePreference } = req.body;
    const SUPPORTED = ['en', 'hi', 'kn', 'mr', 'te', 'ta', 'gu', 'pa'];

    if (!languagePreference || !SUPPORTED.includes(languagePreference)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language code. Supported languages are: ${SUPPORTED.join(', ')}`
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { languagePreference },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Language preference updated successfully',
      languagePreference: user.languagePreference,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        languagePreference: user.languagePreference
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateLanguagePreference
};
