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

/**
 * Dispatches an SMS verification OTP to an Indian mobile number.
 */
async function sendPhoneOtp({ userId, phone, adapter = null }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
    return {
      success: false,
      message: 'A valid 10-digit Indian mobile number starting with 6-9 is required'
    };
  }

  const now = new Date();

  // 1. Check for active resend cooldown
  const existingOtp = await VerificationOtp.findOne({
    target: cleanPhone,
    type: 'PHONE',
    consumedAt: null,
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 });

  if (existingOtp && existingOtp.resendAvailableAt > now) {
    const waitSeconds = Math.ceil((existingOtp.resendAvailableAt.getTime() - now.getTime()) / 1000);
    return {
      success: false,
      cooldown: true,
      waitSeconds,
      message: `Please wait ${waitSeconds} seconds before requesting a new SMS verification code`
    };
  }

  // 2. Invalidate previous active unconsumed OTPs for this phone
  if (existingOtp) {
    await VerificationOtp.updateMany(
      { target: cleanPhone, type: 'PHONE', consumedAt: null },
      { $set: { consumedAt: now } }
    );
  }

  // 3. Generate secure OTP and cryptographic hash
  const otp = generateSecureOtp(OTP_CONFIG.LENGTH);
  const otpHash = hashOtp(otp, cleanPhone);
  const expiresAt = new Date(now.getTime() + OTP_CONFIG.EXPIRY_SECONDS * 1000);
  const resendAvailableAt = new Date(now.getTime() + OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000);

  // 4. Persist hashed OTP record in MongoDB
  const otpDoc = await VerificationOtp.create({
    userId: userId || null,
    target: cleanPhone,
    type: 'PHONE',
    otpHash,
    expiresAt,
    resendAvailableAt,
    attempts: 0,
    maxAttempts: OTP_CONFIG.MAX_ATTEMPTS
  });

  // 5. Build DLT-compliant SMS message
  const expiryMinutes = Math.round(OTP_CONFIG.EXPIRY_SECONDS / 60);
  const message = `CropGuard Market: Your verification code is ${otp}. Valid for ${expiryMinutes} minutes. Never share this OTP with anyone. - UASD APMC`;

  // 6. Deliver via configured SMS adapter
  const smsAdapter = adapter || getSmsAdapter();
  try {
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
async function verifyPhoneOtp({ phone, otp }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !otp) {
    return { success: false, message: 'Phone number and verification code are required' };
  }

  const cleanOtp = String(otp).trim();
  const now = new Date();

  // Find latest active OTP record for this phone number
  const record = await VerificationOtp.findOne({
    target: cleanPhone,
    type: 'PHONE',
    consumedAt: null
  }).sort({ createdAt: -1 });

  if (!record) {
    return {
      success: false,
      message: 'No active verification code found for this mobile number. Please request a new code.'
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
  const isValid = verifyOtpHash(cleanOtp, record.otpHash, cleanPhone);

  if (!isValid) {
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
    message: 'Mobile number verified successfully'
  };
}

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp
};
