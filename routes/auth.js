const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// --- REGISTER ROUTE (Simplified - No Email Verification) ---
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, location } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user - Set Verified to TRUE immediately
    const user = new User({
      fullName,
      email,
      password,
      location: location || 'FME', // Default location if none provided
      isEmailVerified: true,       // ✅ AUTO-VERIFY: No email needed
      emailVerificationToken: undefined,
      emailVerificationTokenExpires: undefined
    });

    await user.save();

    // Send success response
    // We explicitly say requiresEmailVerification: false so frontend knows what to do
    res.status(201).json({
      message: 'Registration successful!',
      requiresEmailVerification: false, 
      email: email
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- LOGIN ROUTE (Simplified) ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    // ✅ REMOVED: The check for !user.isEmailVerified is gone.
    // Users can login immediately.

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) return res.status(400).json({ error: 'Invalid email or password' });

    // Generate JWT Token
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
    console.error("Login Error:", error);
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