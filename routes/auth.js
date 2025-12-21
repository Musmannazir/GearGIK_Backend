const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { generateVerificationToken, sendVerificationEmail } = require('../services/emailService');
const router = express.Router();

// --- REGISTER ROUTE ---
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, location } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const user = new User({
      fullName,
      email,
      password,
      location: location || 'FME',
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpires: tokenExpiry
    });

    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(email, fullName, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the signup, just log the error
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      requiresEmailVerification: true,
      email: email
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- VERIFY EMAIL ROUTE ---
router.post('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with this token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await user.save();

    res.json({
      message: 'Email verified successfully! You can now login.',
      success: true
    });

  } catch (error) {
    console.error("Email Verification Error:", error);
    res.status(500).json({ error: error.message });
  }
});


// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        error: 'Please verify your email first. Check your inbox for the verification link.',
        requiresEmailVerification: true,
        email: user.email
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        location: user.location,
        rating: user.rating,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GET CURRENT USER ---
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- UPDATE PROFILE ---
router.put('/profile', auth, async (req, res) => {
  try {
    const { fullName, phone, location, profileImage } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { fullName, phone, location, profileImage, updatedAt: Date.now() },
      { new: true }
    ).select('-password');
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
