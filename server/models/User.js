const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    enum: ['customer', 'showroom', 'admin'],
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    sparse: true,
    unique: true
  },
  password: {
    type: String,
    required: function() {
      return !this.oauthProviders || this.oauthProviders.length === 0;
    }
  },
  profile: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    city: {
      type: String,
      trim: true
    },
    preferences: {
      favoriteMakes: [String],
      favoriteModels: [String],
      priceRange: {
        min: Number,
        max: Number
      },
      searchRadius: {
        type: Number,
        default: 50 // kilometers
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true }
      }
    }
  },
  // Showroom specific fields
  showroomInfo: {
    businessName: String,
    businessLicense: String,
    taxId: String,
    description: String,
    website: String,
    establishedYear: Number,
    staffCount: Number,
    specializations: [String], // e.g., ["Luxury", "SUVs", "Electric"]
    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    },
    services: [String], // e.g., ["Test Drive", "Financing", "Insurance", "Delivery"]
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 }
    }
  },
  // OAuth providers
  oauthProviders: [{
    provider: {
      type: String,
      enum: ['google', 'facebook']
    },
    providerId: String,
    email: String,
    name: String,
    avatar: String
  }],
  verification: {
    email: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
    documents: [{
      type: {
        type: String,
        enum: ['business_license', 'tax_id', 'identity_proof', 'address_proof']
      },
      url: String,
      verified: { type: Boolean, default: false },
      uploadedAt: { type: Date, default: Date.now }
    }],
    verifiedAt: Date
  },
  subscription: {
    tier: {
      type: String,
      enum: ['free', 'silver', 'gold', 'platinum'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    autoRenew: { type: Boolean, default: false },
    features: [String]
  },
  security: {
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    phoneVerificationCode: String,
    phoneVerificationExpires: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedReason: String,
  lastActivity: Date
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'profile.location': '2dsphere' });
userSchema.index({ userType: 1 });
userSchema.index({ 'verification.email': 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.security.passwordResetToken;
  delete user.security.passwordResetExpires;
  delete user.security.emailVerificationToken;
  delete user.security.phoneVerificationCode;
  delete user.security.phoneVerificationExpires;
  delete user.security.twoFactorSecret;
  return user;
};

userSchema.methods.isLocked = function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'security.lockUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }

  const updates = { $inc: { 'security.loginAttempts': 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { 'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Static methods
userSchema.statics.findByEmailOrPhone = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier },
      { phone: identifier }
    ]
  });
};

module.exports = mongoose.model('User', userSchema);