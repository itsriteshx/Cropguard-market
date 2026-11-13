const VerificationOtp = require('../../models/VerificationOtp');
const OTP_CONFIG = require('../../config/otpConfig');
const {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  normalizeEmail,
  maskEmail
} = require('../../utils/otpUtils');
const { getOtpEmailTemplate } = require('./emailTemplates');
const { getEmailAdapter } = require('./emailAdapter');

/**
 * Initiates email OTP verification.
 * Generates OTP, persists hashed record, enforces cooldown, and delivers email.
 */
async function sendEmailOtp({ userId, email, name = 'Farmer/Trader', adapter = null }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'A valid email address is required' };
  }

  const now = new Date();

  // 1. Check for active resend cooldown
  const existingOtp = await VerificationOtp.findOne({
    target: cleanEmail,
    type: 'EMAIL',
    consumedAt: null,
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 });

  if (existingOtp && existingOtp.resendAvailableAt > now) {
    const waitSeconds = Math.ceil((existingOtp.resendAvailableAt.getTime() - now.getTime()) / 1000);
    return {
      success: false,
      cooldown: true,
      waitSeconds,
      message: `Please wait ${waitSeconds} seconds before requesting a new verification email`
    };
  }

  // 2. Invalidate all previous unconsumed OTPs for this target
  if (existingOtp) {
    await VerificationOtp.updateMany(
      { target: cleanEmail, type: 'EMAIL', consumedAt: null },
      { $set: { consumedAt: now } }
    );
  }

  // 3. Generate secure OTP and cryptographic hash
  const otp = generateSecureOtp(OTP_CONFIG.LENGTH);
  const otpHash = hashOtp(otp, cleanEmail);
  const expiresAt = new Date(now.getTime() + OTP_CONFIG.EXPIRY_SECONDS * 1000);
  const resendAvailableAt = new Date(now.getTime() + OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000);

  // 4. Save new verification OTP record
  const otpDoc = await VerificationOtp.create({
    userId: userId || null,
    target: cleanEmail,
    type: 'EMAIL',
    otpHash,
    expiresAt,
    resendAvailableAt,
    attempts: 0,
    maxAttempts: OTP_CONFIG.MAX_ATTEMPTS
  });

  // 5. Deliver through configured email adapter
  const emailAdapter = adapter || getEmailAdapter();
  const template = getOtpEmailTemplate({
    otp,
    expiryMinutes: Math.round(OTP_CONFIG.EXPIRY_SECONDS / 60),
    name
  });

  try {
    const delivery = await emailAdapter.send({
      to: cleanEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

    return {
      success: true,
      maskedEmail: maskEmail(cleanEmail),
      resendAvailableAt,
      expiresAt,
      messageId: delivery.messageId,
      // Only include plaintext OTP in isolated unit test environments
      ...(process.env.NODE_ENV === 'test' && { _testOtp: otp })
    };
  } catch (error) {
    // If delivery fails, consume the record so invalid attempt isn't waiting
    await VerificationOtp.updateOne({ _id: otpDoc._id }, { $set: { consumedAt: new Date() } });
    return {
      success: false,
      deliveryFailed: true,
      message: 'Failed to deliver verification email. Please check your address or try again later.'
    };
  }
}

/**
 * Verifies the entered OTP against stored hash with atomic single-use consumption.
 */
async function verifyEmailOtp({ email, otp }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !otp) {
    return { success: false, message: 'Email and verification code are required' };
  }

  const cleanOtp = String(otp).trim();
  const now = new Date();

  // Find latest active OTP record for this email
  const record = await VerificationOtp.findOne({
    target: cleanEmail,
    type: 'EMAIL',
    consumedAt: null
  }).sort({ createdAt: -1 });

  if (!record) {
    return {
      success: false,
      message: 'No active verification code found. Please request a new code.'
    };
  }

  // Check if expired
  if (record.expiresAt < now) {
    await VerificationOtp.updateOne({ _id: record._id }, { $set: { consumedAt: now } });
    return {
      success: false,
      expired: true,
      message: 'Verification code has expired. Please request a new code.'
    };
  }

  // Check attempt limit
  if (record.attempts >= record.maxAttempts) {
    await VerificationOtp.updateOne({ _id: record._id }, { $set: { consumedAt: now } });
    return {
      success: false,
      maxAttemptsExceeded: true,
      message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.'
    };
  }

  // Verify cryptographic hash
  const isValid = verifyOtpHash(cleanOtp, record.otpHash, cleanEmail);

  if (!isValid) {
    // Increment attempts atomically
    const updated = await VerificationOtp.findOneAndUpdate(
      { _id: record._id, consumedAt: null },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    const attemptsLeft = Math.max(0, (record.maxAttempts || 5) - (updated?.attempts || record.attempts + 1));
    return {
      success: false,
      message: attemptsLeft > 0
        ? `Incorrect verification code. ${attemptsLeft} attempt(s) remaining.`
        : 'Too many incorrect attempts. Please request a new code.',
      attemptsRemaining: attemptsLeft
    };
  }

  // Atomic single-use consumption
  const consumed = await VerificationOtp.findOneAndUpdate(
    { _id: record._id, consumedAt: null },
    { $set: { consumedAt: now } },
    { new: true }
  );

  if (!consumed) {
    return {
      success: false,
      message: 'Verification code was already used or invalidated.'
    };
  }

  return {
    success: true,
    message: 'Email verified successfully'
  };
}

module.exports = {
  sendEmailOtp,
  verifyEmailOtp
};
