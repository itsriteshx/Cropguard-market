const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role (FARMER, BUYER_RETAIL, BUYER_WHOLESALE, ADMIN)
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'cropguard_dev_secret_key_adypu_2026',
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

module.exports = generateToken;
