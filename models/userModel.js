const crypto = require('crypto'); // built-in module
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

// name, email, photo, password, password confirmed
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'name field is required'],
  },
  email: {
    type: String,
    required: [true, 'email field is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: String, // path to photo stored in field
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },

  password: {
    type: String,
    required: [true, 'password field is required'],
    minlength: 8,
    select: false, // not shown in any output
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE or SAVE
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same',
    },
  },
  passwordChangedAt: { type: Date, default: Date.now },
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// Middleware for password encryption
userSchema.pre('save', async function (next) {
  // Only run this function if password was modified
  if (!this.isModified('password')) return next(); // 'this' refers to current document/user
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  // Delete passwordConfirm field -- don't persist it in database
  this.passwordConfirm = undefined;
  next();
});

// Middleware before a new document saved
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Middleware that applies to every query that starts with find -- Only find active documents
userSchema.pre(/^find/, function (next) {
  // 'this' points to current query
  this.find({ active: { $ne: false } });
  next();
});

// Instance method, available to all documents of collection
// Compare given password (hashed) with original one
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if user changed password after token issued
userSchema.methods.changedPasswordAfter = function (JWTTimeStamp) {
  if (this.passwordChangedAt) {
    // 'this' refers to current document
    const changedTimeStamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimeStamp < changedTimeStamp;
  }
  return false; // false by default -- user hasn't changed password
};

// Instance method -- Reset password
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // in msecs

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
