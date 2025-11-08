const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const logger = require('../utils/logger');
const { optionalAuth } = require('../middleware/auth');

// @route   GET /api/search/suggestions
// @desc    Get search suggestions
// @access  Public
router.get('/suggestions', [
  query('q').trim().isLength({ min: 1 }).withMessage('Search term is required'),
  query('type').optional().isIn(['make', 'model', 'location']).withMessage('Invalid suggestion type')
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

    const { q, type, limit = 10 } = req.query;
    const searchRegex = new RegExp(q, 'i');

    let suggestions = [];

    if (!type || type === 'make') {
      // Get unique makes
      const makes = await Vehicle.distinct('specifications.make', {
        status: 'active',
        'specifications.make': searchRegex
      });
      suggestions = suggestions.concat(makes.slice(0, 5).map(make => ({
        type: 'make',
        value: make,
        label: make
      })));
    }

    if (!type || type === 'model') {
      // Get popular models
      const models = await Vehicle.find({
        status: 'active',
        'specifications.model': searchRegex
      })
        .distinct('specifications.model')
        .limit(5);

      suggestions = suggestions.concat(models.map(model => ({
        type: 'model',
        value: model,
        label: model
      })));
    }

    if (!type || type === 'location') {
      // Get popular cities
      const cities = await User.aggregate([
        { $match: { 'profile.city': searchRegex, userType: 'showroom' } },
        { $group: { _id: '$profile.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      suggestions = suggestions.concat(cities.map(city => ({
        type: 'location',
        value: city._id,
        label: `${city._id} (${city.count} showrooms)`
      })));
    }

    res.json({
      success: true,
      data: { suggestions: suggestions.slice(0, limit) }
    });
  } catch (error) {
    logger.error('Search suggestions error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching suggestions'
    });
  }
});

// @route   GET /api/search/filters
// @desc    Get available filter options
// @access  Public
router.get('/filters', async (req, res) => {
  try {
    const filters = {};

    // Get available makes
    filters.makes = await Vehicle.distinct('specifications.make', { status: 'active' });

    // Get available fuel types with counts
    filters.fuel = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$specifications.fuel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get available transmission types with counts
    filters.transmission = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$specifications.transmission', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get available body types with counts
    filters.bodyType = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$specifications.bodyType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get price range
    const priceRange = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          min: { $min: '$pricing.listedPrice' },
          max: { $max: '$pricing.listedPrice' },
          avg: { $avg: '$pricing.listedPrice' }
        }
      }
    ]);

    filters.priceRange = priceRange[0] || { min: 0, max: 0, avg: 0 };

    // Get year range
    const yearRange = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          min: { $min: '$specifications.year' },
          max: { $max: '$specifications.year' }
        }
      }
    ]);

    filters.yearRange = yearRange[0] || { min: 2020, max: new Date().getFullYear() };

    // Get cities with showrooms
    filters.cities = await User.aggregate([
      { $match: { userType: 'showroom', 'profile.city': { $ne: null } } },
      { $group: { _id: '$profile.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: { filters }
    });
  } catch (error) {
    logger.error('Get filters error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching filters'
    });
  }
});

// @route   GET /api/search/trending
// @desc    Get trending searches and popular vehicles
// @access  Public
router.get('/trending', [
  query('location').optional().trim(),
  query('make').optional().trim()
], async (req, res) => {
  try {
    const { location, make } = req.query;

    // Build base query
    const baseQuery = { status: 'active' };

    if (location) {
      // Find showrooms in the location
      const showrooms = await User.find({
        userType: 'showroom',
        'profile.city': new RegExp(location, 'i')
      }).select('_id');

      if (showrooms.length > 0) {
        baseQuery.showroomId = { $in: showrooms.map(s => s._id) };
      }
    }

    if (make) {
      baseQuery['specifications.make'] = new RegExp(make, 'i');
    }

    // Get trending vehicles (most viewed in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingVehicles = await Vehicle.find(baseQuery)
      .sort({ 'analytics.views': -1, 'analytics.contacts': -1 })
      .limit(10)
      .populate('showroomId', 'showroomInfo.businessName profile.location.address ratings');

    // Get hot deals (recently listed with good pricing)
    const hotDeals = await Vehicle.find({
      ...baseQuery,
      createdAt: { $gte: sevenDaysAgo },
      'analytics.contacts': { $gte: 1 }
    })
      .sort({ 'analytics.contacts': -1, 'pricing.listedPrice': 1 })
      .limit(10)
      .populate('showroomId', 'showroomInfo.businessName profile.location.address ratings');

    // Get popular makes in area
    const popularMakes = await Vehicle.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$specifications.make', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent searches (in production, this would come from analytics)
    const recentSearches = [
      'SUV under 15 lakhs',
      'automatic cars',
      'diesel hatchback',
      'recently listed sedans',
      'electric vehicles'
    ];

    res.json({
      success: true,
      data: {
        trendingVehicles,
        hotDeals,
        popularMakes,
        recentSearches
      }
    });
  } catch (error) {
    logger.error('Get trending error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching trending data'
    });
  }
});

// @route   GET /api/search/recommendations
// @desc    Get personalized recommendations
// @access  Private
router.get('/recommendations', optionalAuth, [
  query('vehicleId').optional().isMongoId().withMessage('Invalid vehicle ID'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
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

    const { vehicleId, limit = 10 } = req.query;
    let recommendations = [];

    if (vehicleId) {
      // Find similar vehicles
      const vehicle = await Vehicle.findById(vehicleId);
      if (vehicle) {
        const similarQuery = {
          _id: { $ne: vehicleId },
          status: 'active',
          'specifications.make': vehicle.specifications.make,
          'specifications.bodyType': vehicle.specifications.bodyType,
          'pricing.listedPrice': {
            $gte: vehicle.pricing.listedPrice * 0.7,
            $lte: vehicle.pricing.listedPrice * 1.3
          }
        };

        recommendations = await Vehicle.find(similarQuery)
          .sort({ 'analytics.views': -1 })
          .limit(limit)
          .populate('showroomId', 'showroomInfo.businessName profile.location.address ratings');
      }
    } else if (req.user) {
      // Get recommendations based on user preferences
      const user = await User.findById(req.user._id);
      if (user && user.profile.preferences) {
        const { favoriteMakes, priceRange, city } = user.profile.preferences;

        const preferenceQuery = {
          status: 'active'
        };

        if (favoriteMakes && favoriteMakes.length > 0) {
          preferenceQuery['specifications.make'] = { $in: favoriteMakes };
        }

        if (priceRange) {
          preferenceQuery['pricing.listedPrice'] = {};
          if (priceRange.min) preferenceQuery['pricing.listedPrice'].$gte = priceRange.min;
          if (priceRange.max) preferenceQuery['pricing.listedPrice'].$lte = priceRange.max;
        }

        if (city) {
          const showrooms = await User.find({
            userType: 'showroom',
            'profile.city': city
          }).select('_id');

          if (showrooms.length > 0) {
            preferenceQuery.showroomId = { $in: showrooms.map(s => s._id) };
          }
        }

        recommendations = await Vehicle.find(preferenceQuery)
          .sort({ 'analytics.views': -1, createdAt: -1 })
          .limit(limit)
          .populate('showroomId', 'showroomInfo.businessName profile.location.address ratings');
      }
    }

    // If no personalized recommendations, get popular vehicles
    if (recommendations.length === 0) {
      recommendations = await Vehicle.find({ status: 'active' })
        .sort({ 'analytics.views': -1, 'analytics.contacts': -1 })
        .limit(limit)
        .populate('showroomId', 'showroomInfo.businessName profile.location.address ratings');
    }

    res.json({
      success: true,
      data: { recommendations }
    });
  } catch (error) {
    logger.error('Get recommendations error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching recommendations'
    });
  }
});

// @route   GET /api/search/price-analysis
// @desc    Get price analysis for vehicle configurations
// @access  Public
router.get('/price-analysis', [
  query('make').trim().isLength({ min: 1 }).withMessage('Make is required'),
  query('model').optional().trim(),
  query('year').optional().isInt({ min: 2010, max: new Date().getFullYear() + 1 }),
  query('fuel').optional().isIn(['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid'])
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

    const { make, model, year, fuel } = req.query;

    // Build query
    const query = {
      status: 'active',
      'specifications.make': new RegExp(make, 'i')
    };

    if (model) {
      query['specifications.model'] = new RegExp(model, 'i');
    }

    if (year) {
      query['specifications.year'] = parseInt(year);
    }

    if (fuel) {
      query['specifications.fuel'] = fuel;
    }

    // Get price statistics
    const priceStats = await Vehicle.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          min: { $min: '$pricing.listedPrice' },
          max: { $max: '$pricing.listedPrice' },
          avg: { $avg: '$pricing.listedPrice' },
          median: { $percentile: { input: '$pricing.listedPrice', p: [0.5] } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get price distribution by year
    const priceByYear = await Vehicle.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$specifications.year',
          avg: { $avg: '$pricing.listedPrice' },
          min: { $min: '$pricing.listedPrice' },
          max: { $max: '$pricing.listedPrice' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]);

    // Get price distribution by fuel type
    const priceByFuel = await Vehicle.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$specifications.fuel',
          avg: { $avg: '$pricing.listedPrice' },
          min: { $min: '$pricing.listedPrice' },
          max: { $max: '$pricing.listedPrice' },
          count: { $sum: 1 }
        }
      },
      { $sort: { avg: -1 } }
    ]);

    // Get popular variants with their price ranges
    const popularVariants = await Vehicle.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$specifications.variant',
          avg: { $avg: '$pricing.listedPrice' },
          min: { $min: '$pricing.listedPrice' },
          max: { $max: '$pricing.listedPrice' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        stats: priceStats[0] || { min: 0, max: 0, avg: 0, median: 0, count: 0 },
        priceByYear,
        priceByFuel,
        popularVariants
      }
    });
  } catch (error) {
    logger.error('Price analysis error', error);
    res.status(500).json({
      success: false,
      error: 'Server error analyzing prices'
    });
  }
});

module.exports = router;