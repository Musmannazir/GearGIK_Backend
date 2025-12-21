const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter using your Gmail account
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: 'nazirusman721@gmail.com',
    pass: 'bfcc mibg ipax zgja' // Your app password
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify the connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email service error:', error);
  } else {
    console.log('✅ Email service is ready:', success);
  }
});

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (email, fullName, token) => {
  // Use your deployed frontend URL or localhost for development
  const baseUrl = process.env.FRONTEND_URL || 'https://gear-gik.vercel.app';
  const verificationLink = `${baseUrl}/verify-email/${token}`;

  const mailOptions = {
    from: 'nazirusman721@gmail.com',
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

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p>© 2025 GearGIK. All rights reserved.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail
};
