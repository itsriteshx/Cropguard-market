const User = require('../models/User');
const generateToken = require('../utils/generateToken');

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

    // Validate required fields
    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, phone number, and password'
      });
    }

    // Check if phone number already registered
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'A user with this phone number already exists'
      });
    }

    // Check if email already registered (if email is provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email already exists'
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      phone,
      email,
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

    // Must provide either phone or email, and password
    const identifier = phone || email;
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number (or email) and password'
      });
    }

    // Find user by phone or email and include password for check
    const query = phone ? { phone } : { email };
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

module.exports = {
  register,
  login,
  getMe
};
