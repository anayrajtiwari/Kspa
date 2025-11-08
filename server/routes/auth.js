const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');
const { protect, refreshToken: refreshMiddleware } = require('../middleware/auth');
const {
  sendEmailVerification,
  sendPasswordResetEmail,
  sendPhoneVerification,
  verifyPhoneNumber
} = require('../services/communicationService');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('userType').isIn(['customer', 'showroom']).withMessage('Invalid user type'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('profile.name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('profile.city').optional().trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userType, email, password, profile, phone } = req.body;

    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Check phone number if provided
    if (phone) {
      existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this phone number already exists'
        });
      }
    }

    // Create user
    const user = new User({
      userType,
      email,
      password,
      profile: {
        name: profile.name,
        city: profile.city || '',
        location: profile.location || { coordinates: [0, 0] },
        preferences: {
          notifications: {
            email: true,
            sms: phone ? true : false,
            push: true
          }
        }
      },
      phone: phone || undefined
    });

    // Add showroom info if registering as showroom
    if (userType === 'showroom') {
      user.showroomInfo = {
        businessName: profile.name, // Use name as business name initially
        ratings: { average: 0, count: 0 }
      };
    }

    await user.save();

    // Generate email verification token
    const verificationToken = jwt.sign(
      { id: user._id, type: 'email' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.security.emailVerificationToken = verificationToken;
    await user.save();

    // Send verification email
    try {
      await sendEmailVerification(user.email, verificationToken);
    } catch (emailError) {
      logger.error('Failed to send verification email', emailError);
    }

    // Send phone verification if phone provided
    if (phone) {
      try {
        await sendPhoneVerification(phone, user._id);
      } catch (smsError) {
        logger.error('Failed to send phone verification', smsError);
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE }
    );

    logger.auth('User registered', user._id, { userType, email });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          userType: user.userType,
          email: user.email,
          profile: user.profile,
          verification: user.verification,
          phone: user.phone
        }
      }
    });
  } catch (error) {
    logger.error('Registration error', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('identifier').trim().isLength({ min: 1 }).withMessage('Email or phone required'),
  body('password').exists().withMessage('Password required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { identifier, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts'
      });
    }

    // Check if account is blocked or inactive
    if (!user.isActive || user.isBlocked) {
      return res.status(401).json({
        success: false,
        error: 'Account is not accessible'
      });
    }

    // Check password for OAuth users
    if (user.oauthProviders && user.oauthProviders.length > 0 && !user.password) {
      return res.status(401).json({
        success: false,
        error: 'Please login using OAuth provider'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    if (user.security.loginAttempts > 0) {
      user.security.loginAttempts = 0;
      user.security.lockUntil = undefined;
      await user.save();
    }

    // Update last login
    user.security.lastLogin = new Date();
    user.lastActivity = new Date();
    await user.save();

    // Generate JWT tokens
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE }
    );

    logger.auth('User logged in', user._id, { userType: user.userType });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          userType: user.userType,
          email: user.email,
          profile: user.profile,
          verification: user.verification,
          phone: user.phone,
          showroomInfo: user.showroomInfo,
          subscription: user.subscription
        }
      }
    });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/oauth/google
// @desc    Google OAuth login/register
// @access  Public
router.post('/oauth/google', [
  body('accessToken').trim().isLength({ min: 1 }).withMessage('Access token required'),
  body('userType').optional().isIn(['customer', 'showroom'])
], async (req, res) => {
  try {
    const { accessToken, userType = 'customer' } = req.body;

    // Verify Google token (implementation would use Google's API)
    // For now, we'll simulate the verification
    let googleUser;
    try {
      // In production, make actual call to Google API
      // const response = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`);
      // googleUser = response.data;

      // Mock data for development
      googleUser = {
        id: 'google_user_id',
        email: req.body.email || 'user@gmail.com',
        name: req.body.name || 'Google User',
        picture: req.body.picture || ''
      };
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Google access token'
      });
    }

    // Find existing user by OAuth provider
    let user = await User.findOne({
      'oauthProviders.provider': 'google',
      'oauthProviders.providerId': googleUser.id
    });

    if (!user) {
      // Check if user exists with same email
      user = await User.findOne({ email: googleUser.email });

      if (user) {
        // Add Google OAuth to existing user
        user.oauthProviders.push({
          provider: 'google',
          providerId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture
        });
      } else {
        // Create new user
        user = new User({
          userType,
          email: googleUser.email,
          profile: {
            name: googleUser.name,
            preferences: {
              notifications: {
                email: true,
                sms: false,
                push: true
              }
            }
          },
          oauthProviders: [{
            provider: 'google',
            providerId: googleUser.id,
            email: googleUser.email,
            name: googleUser.name,
            avatar: googleUser.picture
          }],
          verification: {
            email: true // OAuth emails are pre-verified
          }
        });

        if (userType === 'showroom') {
          user.showroomInfo = {
            businessName: googleUser.name,
            ratings: { average: 0, count: 0 }
          };
        }
      }

      await user.save();
    }

    // Update last login
    user.security.lastLogin = new Date();
    user.lastActivity = new Date();
    await user.save();

    // Generate JWT tokens
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE }
    );

    logger.auth('Google OAuth login', user._id, { userType: user.userType });

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          userType: user.userType,
          email: user.email,
          profile: user.profile,
          verification: user.verification,
          showroomInfo: user.showroomInfo,
          subscription: user.subscription
        }
      }
    });
  } catch (error) {
    logger.error('Google OAuth error', error);
    res.status(500).json({
      success: false,
      error: 'Server error during Google authentication'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.post('/verify-email', [
  body('token').trim().isLength({ min: 1 }).withMessage('Verification token required')
], async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'email') {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification token'
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.verification.email) {
      return res.status(400).json({
        success: false,
        error: 'Email already verified'
      });
    }

    user.verification.email = true;
    user.verification.verifiedAt = new Date();
    user.security.emailVerificationToken = undefined;
    await user.save();

    logger.auth('Email verified', user._id);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error('Email verification error', error);
    res.status(500).json({
      success: false,
      error: 'Invalid or expired verification token'
    });
  }
});

// @route   POST /api/auth/verify-phone
// @desc    Verify phone number
// @access  Public
router.post('/verify-phone', [
  body('phone').isMobilePhone().withMessage('Valid phone number required'),
  body('code').trim().isLength({ min: 4, max: 6 }).withMessage('Verification code required')
], async (req, res) => {
  try {
    const { phone, code } = req.body;

    const result = await verifyPhoneNumber(phone, code);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    const user = await User.findById(result.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.verification.phone = true;
    user.security.phoneVerificationCode = undefined;
    user.security.phoneVerificationExpires = undefined;
    await user.save();

    logger.auth('Phone verified', user._id);

    res.json({
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    logger.error('Phone verification error', error);
    res.status(500).json({
      success: false,
      error: 'Server error during phone verification'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.security.passwordResetToken = resetToken;
    user.security.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (emailError) {
      logger.error('Failed to send password reset email', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send password reset email'
      });
    }

    logger.auth('Password reset requested', user._id);

    res.json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    logger.error('Forgot password error', error);
    res.status(500).json({
      success: false,
      error: 'Server error processing password reset request'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password
// @access  Public
router.post('/reset-password', [
  body('token').trim().isLength({ min: 1 }).withMessage('Reset token required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const { token, password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset token'
      });
    }

    const user = await User.findOne({
      _id: decoded.id,
      'security.passwordResetToken': token,
      'security.passwordResetExpires': { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.security.passwordResetToken = undefined;
    user.security.passwordResetExpires = undefined;
    user.security.loginAttempts = 0;
    user.security.lockUntil = undefined;
    await user.save();

    logger.auth('Password reset successful', user._id);

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Password reset error', error);
    res.status(500).json({
      success: false,
      error: 'Invalid or expired reset token'
    });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', [
  body('refreshToken').trim().isLength({ min: 1 }).withMessage('Refresh token required')
], refreshMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      token: req.newToken
    }
  });
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    // In a production environment, you might want to blacklist the token
    // or implement token invalidation logic

    logger.auth('User logged out', req.user._id);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout'
    });
  }
});

module.exports = router;