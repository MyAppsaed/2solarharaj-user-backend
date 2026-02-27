const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
    trim: true,
    maxLength: [100, 'Name cannot be more than 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  password: {
  type: String,
  required: [true, 'Please enter a valid password'],
  trim: true,
},

  profileImageUrl: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/i.test(v);
      },
      message: 'Profile image must be a valid URL'
    }
  },
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  lastOtpRequest: {
    type: Date,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for better performance
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ isVerified: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });

// Update updatedAt before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to generate OTP
userSchema.methods.generateOTP = function() {
  // Generate random 6-digit OTP
  this.otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  this.lastOtpRequest = new Date();
};

// Instance method to check if can resend OTP (60 seconds cooldown)
userSchema.methods.canResendOTP = function() {
  if (!this.lastOtpRequest) return true;
  const timeSinceLastRequest = Date.now() - this.lastOtpRequest.getTime();
  return timeSinceLastRequest >= 60 * 1000; // 60 seconds
};

// Instance method to verify OTP
userSchema.methods.verifyOTP = function(inputOtp) {
  if (!this.otp || !this.otpExpires) {
    return false;
  }
  
  if (this.otpExpires < Date.now()) {
    return false;
  }
  
  return this.otp === inputOtp;
};

// Instance method to clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = null;
  this.otpExpires = null;
  this.lastOtpRequest = null;
  this.isVerified = true;
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

module.exports = mongoose.model('User', userSchema);
