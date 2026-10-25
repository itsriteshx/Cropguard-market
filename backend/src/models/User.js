const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
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
      enum: ['en', 'hi', 'kn'],
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
        default: [0, 0]
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
