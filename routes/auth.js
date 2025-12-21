const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const router = express.Router();

// --- 1. EMAIL CONFIGURATION (Fixed for Render) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,               // ✅ Use Port 465 for SSL (Works better on Render)
  secure: true,            // ✅ Must be true for port 465
  auth: {
    user: process.env.EMAIL_USER, // Set this in Render Dashboard
    pass: process.env.EMAIL_PASS  // Set this in Render Dashboard
  },
  connectionTimeout: 10000, // Fail fast if connection hangs
});

// Optional: Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('⚠️ Email service warning:', error.message);
  } else {
    console.log('✅ Email service is ready');
  }
});

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const sendVerificationEmail = async (email, fullName, token) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://gear-gik.vercel.app';
  const verificationLink = `${baseUrl}/verify-email/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER, // Use the env variable here too
    to: email,
    subject: 'GearGIK - Email Verification Required',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to GearGIK, ${fullName}!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for signing up with us. Please verify your email address to complete your registration and start enjoying premium vehicle rental services.
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            Or copy and paste this link in your browser:<br>
            <span style="word-break: break-all; color: #007bff;">${verificationLink}</span>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This link will expire in 24 hours. If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// --- 2. REGISTER ROUTE (Non-Blocking) ---
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

    // ✅ INSTANT RESPONSE: Send success to React immediately
    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      requiresEmailVerification: true,
      email: email
    });

    // ✅ BACKGROUND PROCESS: Send email *after* response
    // We do NOT use 'await' here so the user doesn't have to wait
    sendVerificationEmail(email, fullName, verificationToken)
      .then(() => console.log(`✅ Email sent successfully to: ${email}`))
      .catch((err) => console.error(`❌ Background email failed for ${email}:`, err.message));

  } catch (error) {
    console.error("Register Error:", error);
    // Only send error if we haven't sent a success response yet
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
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
