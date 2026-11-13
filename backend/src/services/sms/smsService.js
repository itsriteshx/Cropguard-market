const VerificationOtp = require('../../models/VerificationOtp');
const OTP_CONFIG = require('../../config/otpConfig');
const {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  normalizePhone,
  maskPhone
} = require('../../utils/otpUtils');
const { getSmsAdapter } = require('./smsAdapter');
const { verifyOtpCore } = require('../otpVerificationCore');
const { withResendLock } = require('../../utils/resendLock');

/**
 * Dispatches an SMS verification OTP to an Indian mobile number.
 */
async function sendPhoneOtp({ userId, phone, adapter = null, lockOptions = {} }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
    return {
      success: false,
      message: 'A valid 10-digit Indian mobile number starting with 6-9 is required'
    };
  }

  // Pre-initialize adapter so any initialization error fails before creating the OTP
  let smsAdapter;
  try {
    smsAdapter = adapter || getSmsAdapter();
  } catch (err) {
    return {
      success: false,
      deliveryFailed: true,
      message: 'Failed to deliver SMS verification code. Please check your mobile number or try again later.'
    };
  }

  const lockKey = `PHONE:${cleanPhone}`;
  let otpDoc = null;
  let otp = null;
  let cooldownResult = null;
  let expiresAt = null;
  let resendAvailableAt = null;

  // CRITICAL SECTION (Under distributed lock):
  // Limited strictly to checking cooldown, invalidating old OTPs, and creating new OTP.
  // The lock is released BEFORE sending SMS.
  await withResendLock(lockKey, async (lockContext) => {
    const now = new Date();

    // 1. Find latest active/unconsumed OTP for this mobile number
    const existingOtp = await VerificationOtp.findOne({
      target: cleanPhone,
      type: 'PHONE',
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
          { target: cleanPhone, type: 'PHONE', consumedAt: null },
          { $set: { consumedAt: now } }
        );
      } else if (existingOtp.resendAvailableAt > now) {
        // Active cooldown in effect
        const waitSeconds = Math.ceil((existingOtp.resendAvailableAt.getTime() - now.getTime()) / 1000);
        cooldownResult = {
          success: false,
          cooldown: true,
          waitSeconds,
          message: `Please wait ${waitSeconds} seconds before requesting a new SMS verification code`
        };
        return;
      } else {
        // Cooldown has elapsed: invalidate previous active unconsumed OTPs
        if (lockContext && typeof lockContext.assertValid === 'function') {
          lockContext.assertValid();
        }
        await VerificationOtp.updateMany(
          { target: cleanPhone, type: 'PHONE', consumedAt: null },
          { $set: { consumedAt: now } }
        );
      }
    }

    // Revalidate lock validity immediately before creating new OTP
    if (lockContext && typeof lockContext.assertValid === 'function') {
      lockContext.assertValid();
    }

    // 4. Generate secure OTP and cryptographic hash
    otp = generateSecureOtp(OTP_CONFIG.LENGTH);
    const otpHash = hashOtp(otp, cleanPhone);
    expiresAt = new Date(now.getTime() + OTP_CONFIG.EXPIRY_SECONDS * 1000);
    resendAvailableAt = new Date(now.getTime() + OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000);

    // 5. Persist hashed OTP record in MongoDB
    otpDoc = await VerificationOtp.create({
      userId: userId || null,
      target: cleanPhone,
      type: 'PHONE',
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

  // OUTSIDE CRITICAL SECTION: Deliver via configured SMS adapter.
  // Any failure after OTP creation immediately invalidates the created OTP record.
  try {
    const expiryMinutes = Math.round(OTP_CONFIG.EXPIRY_SECONDS / 60);
    const message = `CropGuard Market: Your verification code is ${otp}. Valid for ${expiryMinutes} minutes. Never share this OTP with anyone. - UASD APMC`;

    const delivery = await smsAdapter.send({
      phone: cleanPhone,
      message,
      otp
    });

    return {
      success: true,
      maskedPhone: maskPhone(cleanPhone),
      resendAvailableAt,
      expiresAt,
      messageId: delivery.messageId,
      ...(process.env.NODE_ENV === 'test' && { _testOtp: otp })
    };
  } catch (error) {
    // Invalidate record if provider fails
    await VerificationOtp.updateOne({ _id: otpDoc._id }, { $set: { consumedAt: new Date() } });
    return {
      success: false,
      deliveryFailed: true,
      message: 'Failed to deliver SMS verification code. Please check your mobile number or try again later.'
    };
  }
}

/**
 * Verifies entered phone OTP against cryptographic hash with atomic single-use consumption.
 */
async function verifyPhoneOtp({ phone, otp, userId = null }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !otp) {
    return { success: false, message: 'Phone number and verification code are required' };
  }

  return verifyOtpCore({
    type: 'PHONE',
    target: cleanPhone,
    otp,
    userId,
    notFoundMessage: 'No active verification code found for this mobile number. Please request a new code.',
    successMessage: 'Mobile number verified successfully'
  });
}

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp
};
