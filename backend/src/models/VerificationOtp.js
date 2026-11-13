const mongoose = require('mongoose');

const verificationOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    target: {
      type: String,
      required: [true, 'Verification target (email or phone) is required'],
      trim: true,
      index: true
    },
    type: {
      type: String,
      enum: {
        values: ['EMAIL', 'PHONE'],
        message: '{VALUE} is not a valid OTP verification type'
      },
      required: [true, 'Verification type is required'],
      index: true
    },
    otpHash: {
      type: String,
      required: [true, 'OTP hash is required']
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry timestamp is required']
    },
    resendAvailableAt: {
      type: Date,
      required: [true, 'Resend cooldown timestamp is required']
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    consumedAt: {
      type: Date,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

// TTL index to automatically purge expired OTP records from MongoDB
verificationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast active OTP lookup per target and type
verificationOtpSchema.index({ target: 1, type: 1, consumedAt: 1, expiresAt: 1 });

// Instance method to check if OTP has expired
verificationOtpSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Instance method to check if resend cooldown is active
verificationOtpSchema.methods.isCooldownActive = function () {
  return new Date() < this.resendAvailableAt;
};

// Instance method to check if max attempts reached
verificationOtpSchema.methods.hasExceededMaxAttempts = function () {
  return this.attempts >= this.maxAttempts;
};

module.exports = mongoose.model('VerificationOtp', verificationOtpSchema);
