const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const emailService = require('../services/email/emailService');
const smsService = require('../services/sms/smsService');
const { normalizeEmail, normalizePhone, maskEmail, maskPhone } = require('../utils/otpUtils');

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

    // Create user in unverified state
    const user = await User.create({
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password,
      role: role || 'FARMER',
      languagePreference: languagePreference || 'en',
      location: location || { type: 'Point' },
      isVerified: false,
      phoneVerified: false,
      emailVerified: false
    });

    // Automatically initiate phone verification and email verification
    try {
      await smsService.sendPhoneOtp({ userId: user._id, phone: cleanPhone });
    } catch (_) {}

    if (cleanEmail) {
      try {
        await emailService.sendEmailOtp({ userId: user._id, email: cleanEmail, name: user.name });
      } catch (_) {}
    }

    // Generate restricted verification token
    const verificationToken = generateToken.generateVerificationToken
      ? generateToken.generateVerificationToken(user._id, user.role)
      : generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      message: 'Account created. Please verify your mobile number' + (cleanEmail ? ' and email' : '') + ' to activate your account.',
      token: verificationToken,
      verificationToken,
      verificationStatus: user.getVerificationStatus(),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        languagePreference: user.languagePreference,
        location: user.location,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
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
        message: 'Invalid credentials. User not found or incorrect password.'
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found or incorrect password.'
      });
    }

    // Synchronize verification state & check if user is verified
    user.syncVerificationState();

    if (!user.isVerified) {
      const verificationToken = generateToken.generateVerificationToken
        ? generateToken.generateVerificationToken(user._id, user.role)
        : generateToken(user._id, user.role);

      return res.status(200).json({
        success: false,
        requiresVerification: true,
        message: 'Account verification required before accessing the market.',
        token: verificationToken,
        verificationToken,
        verificationStatus: user.getVerificationStatus(),
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          languagePreference: user.languagePreference,
          location: user.location,
          isVerified: user.isVerified,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt
        }
      });
    }

    // Generate JWT Token for fully verified user
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
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
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

/**
 * @desc    Verify Email using 6-digit OTP
 * @route   POST /api/auth/verify-email
 * @access  Public (Optional Bearer token for session association)
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { otp } = req.body;
    let email = req.body.email;

    // If request has authenticated / restricted token, can fall back to user's registered email
    if (!email && req.user && req.user.email) {
      email = req.user.email;
    }

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and verification code'
      });
    }

    // Call email verification service (atomic consumption & validation)
    const verification = await emailService.verifyEmailOtp({ email: cleanEmail, otp });
    if (!verification.success) {
      return res.status(400).json(verification);
    }

    // Update user record if exists
    let user = req.user || (await User.findOne({ email: cleanEmail }));
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Email address verified successfully'
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.syncVerificationState();
    await user.save();

    const verificationStatus = user.getVerificationStatus();
    // If account now satisfies full verification, issue full access token
    const token = user.isVerified ? generateToken(user._id, user.role) : undefined;

    return res.status(200).json({
      success: true,
      message: 'Email address verified successfully',
      isFullyVerified: user.isVerified,
      verificationStatus,
      ...(token && { token }),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend Email OTP
 * @route   POST /api/auth/resend-email-otp
 * @access  Public (Optional Bearer token)
 */
const resendEmailOtp = async (req, res, next) => {
  try {
    let email = req.body.email;
    if (!email && req.user && req.user.email) {
      email = req.user.email;
    }

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const user = req.user || (await User.findOne({ email: cleanEmail }));
    if (user && user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already verified'
      });
    }

    const result = await emailService.sendEmailOtp({
      userId: user?._id,
      email: cleanEmail,
      name: user?.name || 'Farmer/Trader'
    });

    if (!result.success) {
      const statusCode = result.cooldown ? 429 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
      maskedEmail: result.maskedEmail,
      resendAvailableAt: result.resendAvailableAt,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Phone using 6-digit SMS OTP
 * @route   POST /api/auth/verify-phone
 * @access  Public (Optional Bearer token for session association)
 */
const verifyPhone = async (req, res, next) => {
  try {
    const { otp } = req.body;
    let phone = req.body.phone;

    if (!phone && req.user && req.user.phone) {
      phone = req.user.phone;
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide mobile number and verification code'
      });
    }

    // Call SMS verification service (atomic consumption & validation)
    const verification = await smsService.verifyPhoneOtp({ phone: cleanPhone, otp });
    if (!verification.success) {
      return res.status(400).json(verification);
    }

    // Update user record if exists
    let user = req.user || (await User.findOne({ phone: cleanPhone }));
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Mobile number verified successfully'
      });
    }

    user.phoneVerified = true;
    user.phoneVerifiedAt = new Date();
    user.syncVerificationState();
    await user.save();

    const verificationStatus = user.getVerificationStatus();
    const token = user.isVerified ? generateToken(user._id, user.role) : undefined;

    return res.status(200).json({
      success: true,
      message: 'Mobile number verified successfully',
      isFullyVerified: user.isVerified,
      verificationStatus,
      ...(token && { token }),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend Phone SMS OTP
 * @route   POST /api/auth/resend-phone-otp
 * @access  Public (Optional Bearer token)
 */
const resendPhoneOtp = async (req, res, next) => {
  try {
    let phone = req.body.phone;
    if (!phone && req.user && req.user.phone) {
      phone = req.user.phone;
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian mobile number'
      });
    }

    const user = req.user || (await User.findOne({ phone: cleanPhone }));
    if (user && user.phoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is already verified'
      });
    }

    const result = await smsService.sendPhoneOtp({
      userId: user?._id,
      phone: cleanPhone
    });

    if (!result.success) {
      const statusCode = result.cooldown ? 429 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your mobile number',
      maskedPhone: result.maskedPhone,
      resendAvailableAt: result.resendAvailableAt,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get verification status for current user or given email/phone
 * @route   GET /api/auth/verification-status
 * @access  Public (Optional Bearer token)
 */
const getVerificationStatus = async (req, res, next) => {
  try {
    let user = req.user;
    if (!user) {
      const email = req.query.email ? normalizeEmail(req.query.email) : null;
      const phone = req.query.phone ? normalizePhone(req.query.phone) : null;
      if (email) user = await User.findOne({ email });
      else if (phone) user = await User.findOne({ phone });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    user.syncVerificationState();
    return res.status(200).json({
      success: true,
      verificationStatus: user.getVerificationStatus(),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
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
  updateLanguagePreference,
  verifyEmail,
  resendEmailOtp,
  verifyPhone,
  resendPhoneOtp,
  getVerificationStatus
};
