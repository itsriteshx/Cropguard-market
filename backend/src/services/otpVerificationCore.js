const VerificationOtp = require('../models/VerificationOtp');
const { verifyOtpHash } = require('../utils/otpUtils');

/**
 * Concurrency-safe, fail-closed atomic OTP verification helper shared by Email and SMS services.
 *
 * Enforces:
 * - Scoped initial lookup by target, type, and optional user ownership
 * - Fail-closed user binding
 * - Atomic expiry checks at time of write ($gt: now)
 * - Atomic attempt limits ($lt: maxAttempts) preventing race conditions from exceeding max attempts
 * - Atomic single-use consumption preventing concurrent double-spending
 * - Invalidation when max attempts or expiry is reached
 */
async function verifyOtpCore({
  type,
  target,
  otp,
  userId = null,
  notFoundMessage,
  successMessage
}) {
  const cleanOtp = String(otp).trim();
  const now = new Date();

  // 1. Scoped lookup: active unconsumed OTP; if userId is supplied, specifically query for this user's active OTP or an unbound OTP
  const lookupQuery = {
    target,
    type,
    consumedAt: null
  };
  if (userId) {
    lookupQuery.$or = [{ userId }, { userId: null }];
  }

  const record = await VerificationOtp.findOne(lookupQuery).sort({ createdAt: -1 });

  if (!record) {
    return {
      success: false,
      message: notFoundMessage
    };
  }

  // 2. Fail-closed ownership check: if record is user-bound, require matching userId; reject if missing or different
  if (record.userId) {
    if (!userId || String(record.userId) !== String(userId)) {
      return {
        success: false,
        message: notFoundMessage
      };
    }
  }

  const maxAttempts = record.maxAttempts || 5;

  // 3. Expiry check on initial read
  if (record.expiresAt <= now) {
    await VerificationOtp.updateOne(
      { _id: record._id, consumedAt: null },
      { $set: { consumedAt: now } }
    ).catch(() => {});
    return {
      success: false,
      expired: true,
      message: 'Verification code has expired. Please request a new code.'
    };
  }

  // 4. Attempt limit check on initial read
  if (record.attempts >= maxAttempts) {
    await VerificationOtp.updateOne(
      { _id: record._id, consumedAt: null },
      { $set: { consumedAt: now } }
    ).catch(() => {});
    return {
      success: false,
      maxAttemptsExceeded: true,
      message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.'
    };
  }

  // 5. If already consumed by previous successful verification
  if (record.consumedAt) {
    return {
      success: false,
      message: notFoundMessage
    };
  }

  // 6. Timing-safe cryptographic hash verification
  const isValid = verifyOtpHash(cleanOtp, record.otpHash, target);

  if (!isValid) {
    // Atomically increment attempts AND immediately set consumedAt in the same database operation
    // if the increment reaches maxAttempts, eliminating race conditions.
    const incorrectFilter = {
      _id: record._id,
      consumedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: maxAttempts }
    };
    if (record.userId) {
      incorrectFilter.userId = record.userId;
    }

    const incorrectPipeline = [
      {
        $set: {
          attempts: { $add: ['$attempts', 1] },
          consumedAt: {
            $cond: {
              if: { $gte: [{ $add: ['$attempts', 1] }, maxAttempts] },
              then: now,
              else: '$consumedAt'
            }
          }
        }
      }
    ];

    const updated = await VerificationOtp.findOneAndUpdate(
      incorrectFilter,
      incorrectPipeline,
      { new: true }
    );

    if (!updated) {
      // Conditional atomic update did not match: determine exact cause
      const checkNow = new Date();
      if (record.expiresAt <= checkNow) {
        await VerificationOtp.updateOne(
          { _id: record._id, consumedAt: null },
          { $set: { consumedAt: checkNow } }
        );
        return {
          success: false,
          expired: true,
          message: 'Verification code has expired. Please request a new code.'
        };
      }

      let current = null;
      try {
        current = await VerificationOtp.findOne({ _id: record._id });
      } catch (_) {}

      if (current && current.expiresAt <= checkNow) {
        await VerificationOtp.updateOne(
          { _id: current._id, consumedAt: null },
          { $set: { consumedAt: checkNow } }
        );
        return {
          success: false,
          expired: true,
          message: 'Verification code has expired. Please request a new code.'
        };
      }

      if (current && current.attempts >= (current.maxAttempts || maxAttempts)) {
        await VerificationOtp.updateOne(
          { _id: current._id, consumedAt: null },
          { $set: { consumedAt: checkNow } }
        );
        return {
          success: false,
          maxAttemptsExceeded: true,
          message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
          attemptsRemaining: 0
        };
      }

      if (current && current.consumedAt) {
        return {
          success: false,
          message: 'Verification code was already used or invalidated.'
        };
      }

      return {
        success: false,
        maxAttemptsExceeded: true,
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
        attemptsRemaining: 0
      };
    }

    const currentAttempts = updated.attempts;
    const attemptsLeft = Math.max(0, maxAttempts - currentAttempts);

    if (currentAttempts >= maxAttempts) {
      if (!updated.consumedAt) {
        throw new Error('Atomic OTP invalidation was not persisted: consumedAt is missing after reaching max attempts');
      }
      return {
        success: false,
        maxAttemptsExceeded: true,
        message: 'Too many incorrect attempts. Please request a new code.',
        attemptsRemaining: 0
      };
    }

    return {
      success: false,
      message: `Incorrect verification code. ${attemptsLeft} attempt(s) remaining.`,
      attemptsRemaining: attemptsLeft
    };
  }

  // 6. Valid OTP: Atomic single-use consumption with all safety conditions enforced
  const consumptionFilter = {
    _id: record._id,
    consumedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: maxAttempts }
  };
  if (record.userId) {
    consumptionFilter.userId = record.userId;
  }

  const consumed = await VerificationOtp.findOneAndUpdate(
    consumptionFilter,
    { $set: { consumedAt: now } },
    { new: true }
  );

  if (!consumed) {
    // If the atomic consumption write did not match, inspect reason
    const checkNow = new Date();
    if (record.expiresAt <= checkNow) {
      await VerificationOtp.updateOne(
        { _id: record._id, consumedAt: null },
        { $set: { consumedAt: checkNow } }
      );
      return {
        success: false,
        expired: true,
        message: 'Verification code has expired. Please request a new code.'
      };
    }

    let current = null;
    try {
      current = await VerificationOtp.findOne({ _id: record._id });
    } catch (_) {}

    if (current && current.expiresAt <= checkNow) {
      await VerificationOtp.updateOne(
        { _id: current._id, consumedAt: null },
        { $set: { consumedAt: checkNow } }
      );
      return {
        success: false,
        expired: true,
        message: 'Verification code has expired. Please request a new code.'
      };
    }

    if (current && current.attempts >= (current.maxAttempts || maxAttempts)) {
      await VerificationOtp.updateOne(
        { _id: current._id, consumedAt: null },
        { $set: { consumedAt: checkNow } }
      );
      return {
        success: false,
        maxAttemptsExceeded: true,
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.'
      };
    }

    if (current && current.consumedAt) {
      return {
        success: false,
        message: 'Verification code was already used or invalidated.'
      };
    }

    return {
      success: false,
      message: 'Verification code was already used or invalidated.'
    };
  }

  return {
    success: true,
    message: successMessage
  };
}

module.exports = {
  verifyOtpCore
};
