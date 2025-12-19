const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const router = express.Router();

// --- 1. EMAIL TRANSPORTER SETUP ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Must be false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ EMAIL SERVER ERROR:", error);
  } else {
    console.log("✅ EMAIL SERVER IS READY");
  }
});

// --- 2. REGISTER ROUTE (With Safety Loop) ---
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, location } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate Token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user (temporarily)
    const user = new User({
      fullName,
      email,
      password,
      location: location || 'FME',
      verificationToken,
      isVerified: false
    });

    // Save to DB
    await user.save();

    // Try to send email
    try {
      const verificationLink = `https://gear-gik.vercel.app/verify/${verificationToken}`;

      await transporter.sendMail({
        from: '"GearGIK Support" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'Verify your GearGIK Account',
        html: `
          <h2>Welcome to GearGIK!</h2>
          <p>Please click the link below to verify your account:</p>
          <a href="${verificationLink}" style="padding: 10px 20px; background-color: #6c63ff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        `
      });

      res.status(201).json({ 
        message: 'Registration successful! Please check your email.' 
      });

    } catch (emailError) {
      // 🚨 SAFETY LOOP: If email fails, delete the user so they can try again!
      console.error("❌ Email failed to send:", emailError);
      await User.findOneAndDelete({ email: email });
      return res.status(500).json({ error: "Email failed to send. Please try again." });
    }

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 3. VERIFY ROUTE ---
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: "Email verified successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// --- 4. LOGIN ROUTE ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    if (!user.isVerified) {
      return res.status(400).json({ error: 'Please verify your email first.' });
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

// --- 5. OTHER ROUTES ---
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
