const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Generate a signed JWT token
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role (FARMER, BUYER_RETAIL, BUYER_WHOLESALE, ADMIN)
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

module.exports = generateToken;
