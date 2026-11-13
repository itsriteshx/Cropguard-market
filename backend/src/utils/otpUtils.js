const crypto = require('crypto');
const OTP_CONFIG = require('../config/otpConfig');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Returns the secret pepper used for hashing OTPs.
 * Uses a dedicated OTP_PEPPER env var if present, or derives from JWT_SECRET.
 */
function getOtpPepper() {
  const pepper = process.env.OTP_PEPPER;
  if (pepper && pepper.trim()) {
    return pepper.trim();
  }
  return getJwtSecret();
}

/**
 * Generates a cryptographically secure random numeric OTP.
 * @param {number} length - Desired OTP length (default 6)
 * @returns {string} Numeric OTP string (e.g. '482901')
 */
function generateSecureOtp(length = OTP_CONFIG.LENGTH) {
  const otpLength = Number.isInteger(length) && length >= 4 && length <= 10 ? length : 6;
  const min = 10 ** (otpLength - 1);
  const max = 10 ** otpLength;
  const num = crypto.randomInt(min, max);
  return String(num);
}

/**
 * Computes a secure SHA-256 hash of the OTP combined with target and pepper.
 * Including target (email or phone) prevents cross-target replay attacks.
 * @param {string} otp - Plaintext OTP
 * @param {string} target - Normalized email or phone
 * @returns {string} Hex-encoded SHA-256 HMAC
 */
function hashOtp(otp, target) {
  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP string is required for hashing');
  }
  const cleanOtp = otp.trim();
  const cleanTarget = (target || '').trim().toLowerCase();
  const pepper = getOtpPepper();

  return crypto
    .createHmac('sha256', pepper)
    .update(`${cleanTarget}:${cleanOtp}`)
    .digest('hex');
}

/**
 * Timing-safe verification of an entered OTP against a stored hash.
 * @param {string} enteredOtp - Plaintext OTP provided by user
 * @param {string} storedHash - Hex hash stored in database
 * @param {string} target - Normalized email or phone
 * @returns {boolean} True if matching, false otherwise
 */
function verifyOtpHash(enteredOtp, storedHash, target) {
  if (!enteredOtp || !storedHash || typeof enteredOtp !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  try {
    const computedHash = hashOtp(enteredOtp, target);
    const storedBuf = Buffer.from(storedHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');

    if (storedBuf.length !== computedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(storedBuf, computedBuf);
  } catch (_) {
    return false;
  }
}

/**
 * Normalizes an email address (trims whitespace and converts to lowercase).
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Normalizes an Indian mobile phone number to 10 digits.
 * Strips non-digits, country code 91, or leading 0.
 * @param {string} phone
 * @returns {string} 10-digit number or empty string
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).trim().replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Formats a 10-digit Indian phone number to E.164 (+91XXXXXXXXXX).
 * @param {string} phone
 * @returns {string} E.164 formatted phone number
 */
function toE164(phone) {
  const clean = normalizePhone(phone);
  if (!clean || clean.length !== 10) return '';
  return `+91${clean}`;
}

/**
 * Masks an email for safe display in logs and client responses.
 * Example: 'ramesh.patil@uasd.agri.in' -> 'r***l@uasd.agri.in'
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  const norm = normalizeEmail(email);
  if (!norm || !norm.includes('@')) return '***';
  const [local, domain] = norm.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks a phone number for safe display in logs and client responses.
 * Example: '9876543210' -> '******3210'
 * @param {string} phone
 * @returns {string}
 */
function maskPhone(phone) {
  const norm = normalizePhone(phone);
  if (!norm || norm.length !== 10) return '******';
  return `******${norm.slice(-4)}`;
}

module.exports = {
  getOtpPepper,
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  normalizeEmail,
  normalizePhone,
  toE164,
  maskEmail,
  maskPhone
};
