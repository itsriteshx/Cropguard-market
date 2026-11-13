const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Helper: normalize Indian phone number
const sanitizePhone = (val) => {
  if (!val) return '';
  let cleaned = String(val).trim().replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number'],
      unique: true,
      trim: true,
      set: sanitizePhone,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      set: (val) => (val && typeof val === 'string' && val.trim() ? val.trim().toLowerCase() : undefined),
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: {
        values: ['FARMER', 'BUYER_RETAIL', 'BUYER_WHOLESALE', 'ADMIN'],
        message: '{VALUE} is not a supported user role'
      },
      default: 'FARMER'
    },
    languagePreference: {
      type: String,
      enum: {
        values: ['en', 'hi', 'kn', 'mr', 'te', 'ta', 'gu', 'pa'],
        message: '{VALUE} is not a supported language preference'
      },
      default: 'en'
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined
      },
      village: { type: String, trim: true },
      taluk: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    phoneVerifiedAt: {
      type: Date,
      default: null
    },
    avatar: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere index for geospatial proximity search
userSchema.index({ 'location.coordinates': '2dsphere' });

// Method: Synchronize verification state & legacy compatibility
userSchema.methods.syncVerificationState = function () {
  // Legacy migration / compatibility: If marked isVerified: true (e.g. seeds), ensure flags match
  if (this.isVerified && !this.phoneVerified) {
    this.phoneVerified = true;
    if (!this.phoneVerifiedAt) this.phoneVerifiedAt = new Date();
    if (this.email && !this.emailVerified) {
      this.emailVerified = true;
      if (!this.emailVerifiedAt) this.emailVerifiedAt = new Date();
    }
  }

  // Active status sync: account is fully verified if phone is verified AND (no email OR email is verified)
  if (this.phoneVerified && (!this.email || this.emailVerified)) {
    this.isVerified = true;
  } else if (!this.phoneVerified || (this.email && !this.emailVerified)) {
    // If phone is unverified, or if email was added but remains unverified
    this.isVerified = false;
  }

  return this.isVerified;
};

// Pre-save hook: Synchronize verification state before save
userSchema.pre('save', function (next) {
  this.syncVerificationState();
  next();
});

// Instance method: Returns breakdown of remaining verification steps
userSchema.methods.getVerificationStatus = function () {
  const pending = [];
  if (!this.phoneVerified) pending.push('phone');
  if (this.email && !this.emailVerified) pending.push('email');

  return {
    isVerified: this.isVerified,
    phoneVerified: this.phoneVerified,
    emailVerified: this.emailVerified,
    phoneVerifiedAt: this.phoneVerifiedAt,
    emailVerifiedAt: this.emailVerifiedAt,
    pending,
    hasEmail: Boolean(this.email)
  };
};

// Pre-save hook: Hash password with bcrypt before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: Match entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
