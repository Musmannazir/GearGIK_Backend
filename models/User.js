const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    default: '',
  },
  regNo: {
    type: String,
    default: '',
  },
  location: {
    type: String,
    enum: ['FME', 'FCSE', 'AcB', 'FMCE', 'H11/12', 'Brabers', 'H9/10', 'H1/2', 'H5/6', 'H3/4'],
    default: 'FME',
  },
  profileImage: {
    type: String,
    default: null,
  },
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  totalEarnings: {
    type: Number,
    default: 0,
  },
  // --- NEW FIELDS FOR EMAIL VERIFICATION ---
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    default: null,
  },
  // -----------------------------------------
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);