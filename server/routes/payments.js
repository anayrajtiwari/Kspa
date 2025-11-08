const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/payments/subscribe
// @desc    Create subscription
// @access  Private (Showroom only)
router.post('/subscribe', protect, authorize('showroom'), [
  body('tier').isIn(['silver', 'gold', 'platinum']).withMessage('Invalid subscription tier'),
  body('paymentMethod').trim().isLength({ min: 1 }).withMessage('Payment method is required')
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

    const { tier, paymentMethod } = req.body;

    // Get user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Define subscription pricing
    const pricing = {
      silver: 2999,
      gold: 5999,
      platinum: 9999
    };

    const amount = pricing[tier];

    // In production, integrate with actual payment gateways (Stripe, Razorpay)
    // For now, we'll simulate the payment process

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // Update user subscription
    user.subscription = {
      tier,
      startDate,
      endDate,
      autoRenew: true,
      features: getSubscriptionFeatures(tier)
    };

    await user.save();

    logger.business('Subscription created', {
      userId: user._id,
      tier,
      amount,
      paymentMethod
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription: user.subscription,
        amount,
        tier
      }
    });
  } catch (error) {
    logger.error('Create subscription error', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating subscription'
    });
  }
});

// @route   GET /api/payments/plans
// @desc    Get subscription plans
// @access  Public
router.get('/plans', (req, res) => {
  try {
    const plans = {
      silver: {
        name: 'Silver Plan',
        price: 2999,
        duration: 'month',
        features: [
          'Up to 25 active vehicle listings',
          '10 photos per vehicle',
          'Basic analytics dashboard',
          'Standard search placement',
          'Email support (48-hour response)'
        ],
        limits: {
          maxListings: 25,
          maxPhotos: 10
        }
      },
      gold: {
        name: 'Gold Plan',
        price: 5999,
        duration: 'month',
        features: [
          'Up to 100 active vehicle listings',
          '15 photos + 1 video per vehicle',
          'Advanced analytics with insights',
          'Priority search placement',
          'Bulk upload functionality',
          'Phone support (24-hour response)',
          'Monthly performance report'
        ],
        limits: {
          maxListings: 100,
          maxPhotos: 15,
          maxVideos: 1
        }
      },
      platinum: {
        name: 'Platinum Plan',
        price: 9999,
        duration: 'month',
        features: [
          'Unlimited vehicle listings',
          '15 photos + 2 videos per vehicle',
          'Premium analytics with AI insights',
          'Top placement in search results',
          'Advanced bulk upload with validation',
          'Dedicated account manager',
          'Weekly performance reports',
          'Featured in platform newsletters',
          'Social media promotion'
        ],
        limits: {
          maxListings: -1, // Unlimited
          maxPhotos: 15,
          maxVideos: 2
        }
      }
    };

    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    logger.error('Get subscription plans error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching subscription plans'
    });
  }
});

// @route   POST /api/payments/cancel-subscription
// @desc    Cancel subscription
// @access  Private (Showroom only)
router.post('/cancel-subscription', protect, authorize('showroom'), [
  body('reason').optional().trim().isLength({ max: 200 }).withMessage('Reason must be less than 200 characters')
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

    const { reason } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.subscription || user.subscription.tier === 'free') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }

    // Update subscription to auto-renew = false
    user.subscription.autoRenew = false;
    await user.save();

    logger.business('Subscription cancelled', {
      userId: user._id,
      tier: user.subscription.tier,
      reason
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully. You will continue to have access until the end of your billing period.',
      data: {
        endDate: user.subscription.endDate,
        tier: user.subscription.tier
      }
    });
  } catch (error) {
    logger.error('Cancel subscription error', error);
    res.status(500).json({
      success: false,
      error: 'Server error cancelling subscription'
    });
  }
});

// @route   GET /api/payments/subscription-status
// @desc    Get subscription status
// @access  Private (Showroom only)
router.get('/subscription-status', protect, authorize('showroom'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const subscription = user.subscription;

    // Check if subscription is active
    const isActive = subscription && subscription.endDate && new Date(subscription.endDate) > new Date();

    // Get current vehicle count
    const Vehicle = require('../models/Vehicle');
    const currentListings = await Vehicle.countDocuments({
      showroomId: req.user._id,
      status: 'active'
    });

    res.json({
      success: true,
      data: {
        subscription,
        isActive,
        currentListings,
        daysRemaining: subscription && subscription.endDate
          ? Math.max(0, Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
          : 0
      }
    });
  } catch (error) {
    logger.error('Get subscription status error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching subscription status'
    });
  }
});

// Helper function to get subscription features
function getSubscriptionFeatures(tier) {
  const features = {
    silver: ['listings_25', 'photos_10', 'basic_analytics', 'email_support'],
    gold: ['listings_100', 'photos_15', 'videos_1', 'advanced_analytics', 'bulk_upload', 'phone_support', 'reports'],
    platinum: ['listings_unlimited', 'photos_15', 'videos_2', 'premium_analytics', 'advanced_bulk_upload', 'account_manager', 'weekly_reports', 'newsletter_featured', 'social_promotion']
  };

  return features[tier] || [];
}

module.exports = router;