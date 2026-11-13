const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Protect routes - Verifies JWT Bearer token and attaches user to req.user
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

  try {
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists' });
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
