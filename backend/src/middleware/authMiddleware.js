const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwtSecret');
const OTP_CONFIG = require('../config/otpConfig');

/**
 * Protect routes - Verifies JWT Bearer token, enforces verified status, and attaches user to req.user
 */
const protect = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ') || !authorization.slice(7).trim()) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authorization.slice(7).trim(), getJwtSecret());
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
  }

  const isMeEndpoint = (req.originalUrl || req.url || '').split('?')[0].endsWith('/auth/me');

  // Restricted verification tokens cannot access operational endpoints
  if (decoded.scope === 'verification_pending' && !isMeEndpoint) {
    return res.status(403).json({
      success: false,
      requiresVerification: true,
      message: 'Account verification pending. Please verify your mobile number and email to access market features.'
    });
  }

  try {
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists' });
    }

    req.user.syncVerificationState();

    // Enforce that active user has completed verification on operational routes
    if (OTP_CONFIG.REQUIRE_VERIFICATION && !req.user.isVerified && !isMeEndpoint) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message: 'Account verification required. Please verify your mobile number and email to continue.'
      });
    }

    return next();
  } catch (error) {
    // Database failures are server errors, not evidence that the token expired.
    return next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) middleware
 * @param  {...string} roles Allowed roles (e.g. 'FARMER', 'ADMIN')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user ? req.user.role : 'None'}) is not authorized to access this resource`
      });
    }
    next();
  };
};

/**
 * Optional auth - Attaches req.user if a valid Bearer token is present, otherwise continues cleanly
 */
const optionalProtect = async (req, res, next) => {
  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { protect, authorize, optionalProtect };
