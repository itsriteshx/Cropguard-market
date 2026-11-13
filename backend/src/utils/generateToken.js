const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Generate a signed JWT access token for fully verified users
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role (FARMER, BUYER_RETAIL, BUYER_WHOLESALE, ADMIN)
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role, scope: 'access' },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

/**
 * Generate a restricted-scope verification token for users pending verification
 * Valid only for verification endpoints; rejected by operational API middleware.
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role
 * @returns {string} Signed JWT verification token
 */
const generateVerificationToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role, scope: 'verification_pending' },
    getJwtSecret(),
    {
      expiresIn: '2h'
    }
  );
};

generateToken.generateToken = generateToken;
generateToken.generateVerificationToken = generateVerificationToken;

module.exports = generateToken;
