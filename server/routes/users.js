const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  protect,
  authorize,
  emailVerificationRequired,
  phoneVerificationRequired,
  showroomVerificationRequired
} = require('../middleware/auth');
const { uploadDocument } = require('../services/uploadService');

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-security.passwordResetToken -security.passwordResetExpires -security.emailVerificationToken -security.phoneVerificationCode -security.phoneVerificationExpires');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get profile error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, [
  body('profile.name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('profile.city').optional().trim().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  body('profile.preferences.priceRange.min').optional().isNumeric().withMessage('Minimum price must be a number'),
  body('profile.preferences.priceRange.max').optional().isNumeric().withMessage('Maximum price must be a number'),
  body('profile.preferences.searchRadius').optional().isInt({ min: 5, max: 500 }).withMessage('Search radius must be between 5 and 500 km')
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

    const { profile, showroomInfo } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update basic profile information
    if (profile) {
      if (profile.name) user.profile.name = profile.name;
      if (profile.city) user.profile.city = profile.city;
      if (profile.location) user.profile.location = profile.location;
      if (profile.preferences) {
        user.profile.preferences = {
          ...user.profile.preferences,
          ...profile.preferences
        };
      }
    }

    // Update showroom information if user is showroom
    if (user.userType === 'showroom' && showroomInfo) {
      user.showroomInfo = {
        ...user.showroomInfo,
        ...showroomInfo
      };
    }

    await user.save();

    logger.business('Profile updated', { userId: user._id, userType: user.userType });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update profile error', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating profile'
    });
  }
});

// @route   POST /api/users/upload-documents
// @desc    Upload verification documents
// @access  Private
router.post('/upload-documents', protect, upload.array('documents', 5), [
  body('documentType').isIn(['business_license', 'tax_id', 'identity_proof', 'address_proof']).withMessage('Invalid document type')
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

    const { documentType } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No documents uploaded'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Upload documents and save URLs
    const uploadedDocuments = [];
    for (const file of req.files) {
      try {
        const result = await uploadDocument(file, documentType, user._id);
        uploadedDocuments.push({
          type: documentType,
          url: result.url,
          verified: false,
          uploadedAt: new Date()
        });
      } catch (uploadError) {
        logger.error('Document upload error', uploadError);
        return res.status(500).json({
          success: false,
          error: `Failed to upload ${file.originalname}`
        });
      }
    }

    // Add documents to user verification
    user.verification.documents.push(...uploadedDocuments);
    await user.save();

    logger.business('Documents uploaded', {
      userId: user._id,
      documentType,
      count: uploadedDocuments.length
    });

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedDocuments
      }
    });
  } catch (error) {
    logger.error('Upload documents error', error);
    res.status(500).json({
      success: false,
      error: 'Server error uploading documents'
    });
  }
});

// @route   POST /api/users/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', protect, [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has password (OAuth users might not)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change password for OAuth accounts'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.auth('Password changed', user._id);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error', error);
    res.status(500).json({
      success: false,
      error: 'Server error changing password'
    });
  }
});

// @route   POST /api/users/send-phone-verification
// @desc    Send phone verification code
// @access  Private
router.post('/send-phone-verification', protect, [
  body('phone').isMobilePhone().withMessage('Valid phone number required')
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

    const { phone } = req.body;

    // Check if phone is already verified
    if (req.user.verification.phone && req.user.phone === phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is already verified'
      });
    }

    // Check if phone is already in use by another user
    const existingUser = await User.findOne({ phone, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is already in use'
      });
    }

    // Send verification code
    const { sendPhoneVerification } = require('../services/communicationService');
    await sendPhoneVerification(phone, req.user._id);

    // Update user's phone number
    req.user.phone = phone;
    await req.user.save();

    logger.auth('Phone verification sent', req.user._id, { phone });

    res.json({
      success: true,
      message: 'Verification code sent to your phone'
    });
  } catch (error) {
    logger.error('Send phone verification error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users (admin only)
// @access  Private (Admin only)
router.get('/search', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      q,
      userType,
      city,
      verified,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Text search
    if (q) {
      query.$or = [
        { 'profile.name': { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ];
    }

    // Filter by user type
    if (userType) {
      query.userType = userType;
    }

    // Filter by city
    if (city) {
      query['profile.city'] = { $regex: city, $options: 'i' };
    }

    // Filter by verification status
    if (verified !== undefined) {
      query['verification.email'] = verified === 'true';
    }

    const users = await User.find(query)
      .select('-security -__v')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Search users error', error);
    res.status(500).json({
      success: false,
      error: 'Server error searching users'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (public profile)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('profile showroomInfo userType verification.createdAt ratings');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Return limited public information
    const publicProfile = {
      id: user._id,
      userType: user.userType,
      profile: {
        name: user.profile.name,
        city: user.profile.city,
        location: user.profile.location
      },
      createdAt: user.verification.createdAt
    };

    // Add showroom-specific public information
    if (user.userType === 'showroom') {
      publicProfile.showroomInfo = {
        businessName: user.showroomInfo.businessName,
        description: user.showroomInfo.description,
        ratings: user.showroomInfo.ratings,
        establishedYear: user.showroomInfo.establishedYear
      };
    }

    res.json({
      success: true,
      data: { user: publicProfile }
    });
  } catch (error) {
    logger.error('Get user error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching user'
    });
  }
});

// @route   POST /api/users/deactivate
// @desc    Deactivate user account
// @access  Private
router.post('/deactivate', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = false;
    await user.save();

    logger.auth('Account deactivated', user._id);

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    logger.error('Deactivate account error', error);
    res.status(500).json({
      success: false,
      error: 'Server error deactivating account'
    });
  }
});

// @route   PUT /api/users/:id/block
// @desc    Block/unblock user (admin only)
// @access  Private (Admin only)
router.put('/:id/block', protect, authorize('admin'), [
  body('block').isBoolean().withMessage('Block status must be boolean'),
  body('reason').optional().trim().isLength({ min: 5 }).withMessage('Reason must be at least 5 characters')
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

    const { block, reason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't allow blocking admin users
    if (user.userType === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot block admin users'
      });
    }

    user.isBlocked = block;
    user.blockedReason = block ? reason || 'Violation of platform policies' : null;
    await user.save();

    logger.security(`User ${block ? 'blocked' : 'unblocked'}`, {
      userId: user._id,
      adminId: req.user._id,
      reason
    });

    res.json({
      success: true,
      message: `User ${block ? 'blocked' : 'unblocked'} successfully`
    });
  } catch (error) {
    logger.error('Block user error', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating user status'
    });
  }
});

module.exports = router;