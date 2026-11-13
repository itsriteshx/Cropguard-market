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
const { verifyOtpCore } = require('../otpVerificationCore');
const { withResendLock } = require('../../utils/resendLock');

/**
 * Initiates email OTP verification.
 * Generates OTP, persists hashed record, enforces cooldown, and delivers email.
 */
async function sendEmailOtp({ userId, email, name = 'Farmer/Trader', adapter = null, lockOptions = {} }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'A valid email address is required' };
  }

  // Pre-initialize adapter so any initialization error fails before creating the OTP
  let emailAdapter;
  try {
    emailAdapter = adapter || getEmailAdapter();
  } catch (err) {
    return {
      success: false,
      deliveryFailed: true,
      message: 'Failed to deliver verification email. Please check your address or try again later.'
    };
  }

  const lockKey = `EMAIL:${cleanEmail}`;
  let otpDoc = null;
  let otp = null;
  let cooldownResult = null;
  let expiresAt = null;
  let resendAvailableAt = null;

  // CRITICAL SECTION (Under distributed lock):
  // Limited strictly to checking cooldown, invalidating old OTPs, and creating new OTP.
  // The lock is released BEFORE sending email.
  await withResendLock(lockKey, async (lockContext) => {
    const now = new Date();

    // 1. Find latest active/unconsumed OTP for this target
    const existingOtp = await VerificationOtp.findOne({
      target: cleanEmail,
      type: 'EMAIL',
      consumedAt: null
    }).sort({ createdAt: -1 });

    // Revalidate after awaited database read and before subsequent writes
    if (lockContext && typeof lockContext.assertValid === 'function') {
      lockContext.assertValid();
    }

    if (existingOtp) {
      const isExpired = existingOtp.expiresAt && existingOtp.expiresAt <= now;

      // Safe handling of expired unconsumed records: invalidate and do not enforce cooldown
      if (isExpired) {
        if (lockContext && typeof lockContext.assertValid === 'function') {
          lockContext.assertValid();
        }
        await VerificationOtp.updateMany(
          { target: cleanEmail, type: 'EMAIL', consumedAt: null },
          { $set: { consumedAt: now } }
        );
      } else if (existingOtp.resendAvailableAt > now) {
        // Active cooldown in effect
        const waitSeconds = Math.ceil((existingOtp.resendAvailableAt.getTime() - now.getTime()) / 1000);
        cooldownResult = {
          success: false,
          cooldown: true,
          waitSeconds,
          message: `Please wait ${waitSeconds} seconds before requesting a new verification email`
        };
        return;
      } else {
        // Cooldown has elapsed: invalidate previous active unconsumed OTPs
        if (lockContext && typeof lockContext.assertValid === 'function') {
          lockContext.assertValid();
        }
        await VerificationOtp.updateMany(
          { target: cleanEmail, type: 'EMAIL', consumedAt: null },
          { $set: { consumedAt: now } }
        );
      }
    }

    // Revalidate lock validity immediately before creating new OTP
    if (lockContext && typeof lockContext.assertValid === 'function') {
      lockContext.assertValid();
    }

    // 2. Generate secure OTP and cryptographic hash
    otp = generateSecureOtp(OTP_CONFIG.LENGTH);
    const otpHash = hashOtp(otp, cleanEmail);
    expiresAt = new Date(now.getTime() + OTP_CONFIG.EXPIRY_SECONDS * 1000);
    resendAvailableAt = new Date(now.getTime() + OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000);

    // 3. Save new verification OTP record
    otpDoc = await VerificationOtp.create({
      userId: userId || null,
      target: cleanEmail,
      type: 'EMAIL',
      otpHash,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: OTP_CONFIG.MAX_ATTEMPTS,
      consumedAt: null
    });
  }, lockOptions);

  // If cooldown was detected inside critical section, return cooldown response
  if (cooldownResult) {
    return cooldownResult;
  }

  if (!otpDoc) {
    return {
      success: false,
      message: 'Failed to generate verification code. Please try again later.'
    };
  }

  // OUTSIDE CRITICAL SECTION: Deliver email via adapter.
  // Any failure after OTP creation immediately invalidates the created OTP record.
  try {
    const template = getOtpEmailTemplate({
      otp,
      expiryMinutes: Math.round(OTP_CONFIG.EXPIRY_SECONDS / 60),
      name
    });

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
    // If delivery or template generation fails AFTER OTP creation, invalidate the record
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
async function verifyEmailOtp({ email, otp, userId = null }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !otp) {
    return { success: false, message: 'Email and verification code are required' };
  }

  return verifyOtpCore({
    type: 'EMAIL',
    target: cleanEmail,
    otp,
    userId,
    notFoundMessage: 'No active verification code found. Please request a new code.',
    successMessage: 'Email verified successfully'
  });
}

module.exports = {
  sendEmailOtp,
  verifyEmailOtp
};
