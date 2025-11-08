const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  protect,
  authorize,
  showroomVerificationRequired,
  optionalAuth
} = require('../middleware/auth');
const {
  uploadVehiclePhotos,
  uploadVehicleVideos,
  validateImage,
  validateVideo
} = require('../services/uploadService');

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    try {
      if (file.fieldname.startsWith('photo')) {
        validateImage(file);
        cb(null, true);
      } else if (file.fieldname.startsWith('video')) {
        validateVideo(file);
        cb(null, true);
      } else {
        cb(new Error('Invalid file field'));
      }
    } catch (error) {
      cb(error);
    }
  }
});

// @route   GET /api/vehicles
// @desc    Search and filter vehicles
// @access  Public
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('make').optional().trim().isLength({ min: 1 }).withMessage('Make cannot be empty'),
  query('model').optional().trim().isLength({ min: 1 }).withMessage('Model cannot be empty'),
  query('minPrice').optional().isNumeric().withMessage('Minimum price must be a number'),
  query('maxPrice').optional().isNumeric().withMessage('Maximum price must be a number'),
  query('minYear').optional().isInt({ min: 1900 }).withMessage('Minimum year must be valid'),
  query('maxYear').optional().isInt({ min: 1900 }).withMessage('Maximum year must be valid'),
  query('fuel').optional().isIn(['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid']),
  query('transmission').optional().isIn(['manual', 'automatic', 'cvt', 'dct', 'amt']),
  query('bodyType').optional().isIn(['sedan', 'suv', 'hatchback', 'muv', 'coupe', 'convertible', 'pickup', 'van', 'luxury']),
  query('kilometers').optional().isNumeric().withMessage('Kilometers must be a number'),
  query('owners').optional().isInt({ min: 1, max: 10 }).withMessage('Owners must be between 1 and 10'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term cannot be empty'),
  query('sort').optional().isIn(['price_asc', 'price_desc', 'year_desc', 'year_asc', 'kilometers_asc', 'kilometers_desc', 'newest', 'popular']),
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  query('radius').optional().isInt({ min: 1, max: 500 }).withMessage('Radius must be between 1 and 500 km')
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

    const {
      page = 1,
      limit = 20,
      make,
      model,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      fuel,
      transmission,
      bodyType,
      kilometers,
      owners,
      search,
      sort = 'newest',
      lat,
      lng,
      radius = 50,
      featured
    } = req.query;

    // Build query
    const query = {
      status: 'active',
      'availability.inStock': true
    };

    // Price range (primary filter as per planning doc)
    if (minPrice || maxPrice) {
      query['pricing.listedPrice'] = {};
      if (minPrice) query['pricing.listedPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.listedPrice'].$lte = parseFloat(maxPrice);
    }

    // Make and model
    if (make) query['specifications.make'] = new RegExp(make, 'i');
    if (model) query['specifications.model'] = new RegExp(model, 'i');

    // Year range
    if (minYear || maxYear) {
      query['specifications.year'] = {};
      if (minYear) query['specifications.year'].$gte = parseInt(minYear);
      if (maxYear) query['specifications.year'].$lte = parseInt(maxYear);
    }

    // Other specifications
    if (fuel) query['specifications.fuel'] = fuel;
    if (transmission) query['specifications.transmission'] = transmission;
    if (bodyType) query['specifications.bodyType'] = bodyType;

    // Condition filters
    if (kilometers) query['condition.kilometers'] = { $lte: parseFloat(kilometers) };
    if (owners) query['condition.owners'] = { $lte: parseInt(owners) };

    // Search term
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { 'specifications.make': new RegExp(search, 'i') },
        { 'specifications.model': new RegExp(search, 'i') },
        { 'specifications.variant': new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') }
      ];
    }

    // Featured vehicles
    if (featured === 'true') {
      query['featured.isFeatured'] = true;
      query['featured.validUntil'] = { $gte: new Date() };
    }

    // Location-based search
    if (lat && lng) {
      query.location = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(radius) / 6371 // Convert km to radians
          ]
        }
      };
    }

    // Sorting
    let sortOptions = {};
    switch (sort) {
      case 'price_asc':
        sortOptions = { 'pricing.listedPrice': 1 };
        break;
      case 'price_desc':
        sortOptions = { 'pricing.listedPrice': -1 };
        break;
      case 'year_desc':
        sortOptions = { 'specifications.year': -1 };
        break;
      case 'year_asc':
        sortOptions = { 'specifications.year': 1 };
        break;
      case 'kilometers_asc':
        sortOptions = { 'condition.kilometers': 1 };
        break;
      case 'kilometers_desc':
        sortOptions = { 'condition.kilometers': -1 };
        break;
      case 'popular':
        sortOptions = { 'analytics.views': -1, 'analytics.contacts': -1 };
        break;
      case 'newest':
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    // Add priority sorting for featured vehicles
    if (featured === 'true') {
      sortOptions.priority = -1;
    }

    // Execute query
    const vehicles = await Vehicle.find(query)
      .populate('showroomId', 'showroomInfo.businessName profile.location.address ratings')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await Vehicle.countDocuments(query);

    // Update view counts for logged-in users
    if (req.user) {
      const vehicleIds = vehicles.map(v => v._id);
      await Vehicle.updateMany(
        { _id: { $in: vehicleIds } },
        { $inc: { 'analytics.views': 1 }, $set: { 'analytics.lastViewed': new Date() } }
      );
    }

    res.json({
      success: true,
      data: {
        vehicles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          make,
          model,
          minPrice,
          maxPrice,
          fuel,
          transmission,
          bodyType,
          search,
          location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng), radius: parseFloat(radius) } : null
        }
      }
    });
  } catch (error) {
    logger.error('Search vehicles error', error);
    res.status(500).json({
      success: false,
      error: 'Server error searching vehicles'
    });
  }
});

// @route   GET /api/vehicles/:id
// @desc    Get vehicle details
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('showroomId', 'showroomInfo.businessName profile.location.address phone email ratings verification');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check if vehicle is active (or user owns it)
    if (vehicle.status !== 'active' && (!req.user || vehicle.showroomId._id.toString() !== req.user._id.toString())) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not available'
      });
    }

    // Update view count
    if (req.user) {
      await Vehicle.findByIdAndUpdate(req.params.id, {
        $inc: { 'analytics.views': 1 },
        $set: { 'analytics.lastViewed': new Date() }
      });
    }

    res.json({
      success: true,
      data: { vehicle }
    });
  } catch (error) {
    logger.error('Get vehicle error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching vehicle'
    });
  }
});

// @route   POST /api/vehicles
// @desc    Create vehicle listing
// @access  Private (Showroom only)
router.post('/', protect, authorize('showroom'), showroomVerificationRequired, [
  body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('specifications.make').trim().isLength({ min: 1 }).withMessage('Make is required'),
  body('specifications.model').trim().isLength({ min: 1 }).withMessage('Model is required'),
  body('specifications.year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Invalid year'),
  body('specifications.fuel').isIn(['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid']).withMessage('Invalid fuel type'),
  body('specifications.transmission').isIn(['manual', 'automatic', 'cvt', 'dct', 'amt']).withMessage('Invalid transmission'),
  body('specifications.bodyType').isIn(['sedan', 'suv', 'hatchback', 'muv', 'coupe', 'convertible', 'pickup', 'van', 'luxury']).withMessage('Invalid body type'),
  body('specifications.engineCapacity').isInt({ min: 1 }).withMessage('Engine capacity is required'),
  body('specifications.mileage').isFloat({ min: 0 }).withMessage('Mileage must be positive'),
  body('condition.kilometers').isInt({ min: 0 }).withMessage('Kilometers must be positive'),
  body('condition.owners').isInt({ min: 1, max: 10 }).withMessage('Owners must be between 1 and 10'),
  body('pricing.listedPrice').isFloat({ min: 0 }).withMessage('Listed price must be positive'),
  body('location.address.city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('location.coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates are required'),
  body('media.photos').isArray({ min: 1 }).withMessage('At least one photo is required')
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

    const {
      title,
      specifications,
      condition,
      pricing,
      location,
      media,
      availability
    } = req.body;

    // Check subscription limits for free tier
    const user = await User.findById(req.user._id);
    const activeVehicles = await Vehicle.countDocuments({
      showroomId: req.user._id,
      status: 'active'
    });

    if (user.subscription.tier === 'free' && activeVehicles >= 5) {
      return res.status(403).json({
        success: false,
        error: 'Free tier limit reached. Upgrade your subscription to list more vehicles.',
        code: 'SUBSCRIPTION_LIMIT'
      });
    }

    // Create vehicle
    const vehicle = new Vehicle({
      showroomId: req.user._id,
      title,
      specifications,
      condition,
      pricing,
      location,
      media,
      availability: availability || {},
      status: 'draft'
    });

    await vehicle.save();

    logger.business('Vehicle created', {
      vehicleId: vehicle._id,
      showroomId: req.user._id,
      make: specifications.make,
      model: specifications.model
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle listing created successfully',
      data: { vehicle }
    });
  } catch (error) {
    logger.error('Create vehicle error', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating vehicle listing'
    });
  }
});

// @route   PUT /api/vehicles/:id
// @desc    Update vehicle listing
// @access  Private (Showroom owner only)
router.put('/:id', protect, authorize('showroom'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check ownership
    if (vehicle.showroomId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this vehicle'
      });
    }

    // Don't allow updates if vehicle is sold
    if (vehicle.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update sold vehicles'
      });
    }

    // Update vehicle
    const updates = { ...req.body, updatedAt: new Date() };
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'showroomId') {
        vehicle[key] = updates[key];
      }
    });

    // If changing price, add to price history
    if (req.body.pricing && req.body.pricing.listedPrice !== vehicle.pricing.listedPrice) {
      vehicle.pricing.priceHistory.push({
        price: vehicle.pricing.listedPrice,
        date: new Date(),
        reason: 'Price update'
      });
    }

    await vehicle.save();

    logger.business('Vehicle updated', {
      vehicleId: vehicle._id,
      showroomId: req.user._id
    });

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: { vehicle }
    });
  } catch (error) {
    logger.error('Update vehicle error', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating vehicle'
    });
  }
});

// @route   POST /api/vehicles/:id/upload-images
// @desc    Upload vehicle images
// @access  Private (Showroom owner only)
router.post('/:id/upload-images', protect, authorize('showroom'), upload.array('photos', 15), [
  body('angles').optional().isArray().withMessage('Angles must be an array')
], async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check ownership
    if (vehicle.showroomId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this vehicle'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images uploaded'
      });
    }

    const { angles = [] } = req.body;

    // Upload photos
    const uploadedPhotos = await uploadVehiclePhotos(req.files, vehicle._id, angles);

    // Add to vehicle media
    vehicle.media.photos.push(...uploadedPhotos);

    // Update status to active if this was the first upload and vehicle is in draft
    if (vehicle.status === 'draft' && vehicle.media.photos.length >= 8) {
      vehicle.status = 'active';
      vehicle.listedAt = new Date();
    }

    await vehicle.save();

    logger.business('Vehicle images uploaded', {
      vehicleId: vehicle._id,
      showroomId: req.user._id,
      count: uploadedPhotos.length
    });

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        photos: uploadedPhotos,
        totalPhotos: vehicle.media.photos.length
      }
    });
  } catch (error) {
    logger.error('Upload vehicle images error', error);
    res.status(500).json({
      success: false,
      error: 'Server error uploading images'
    });
  }
});

// @route   DELETE /api/vehicles/:id
// @desc    Delete vehicle listing
// @access  Private (Showroom owner only)
router.delete('/:id', protect, authorize('showroom'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check ownership
    if (vehicle.showroomId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this vehicle'
      });
    }

    // Don't allow deletion if vehicle is sold
    if (vehicle.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete sold vehicles'
      });
    }

    // Delete associated files from S3
    const filesToDelete = [
      ...vehicle.media.photos.map(p => p.url),
      ...vehicle.media.photos.map(p => p.thumbnail).filter(Boolean),
      ...vehicle.media.videos.map(v => v.url),
      ...vehicle.media.documents.map(d => d.url)
    ].filter(Boolean);

    if (filesToDelete.length > 0) {
      try {
        const { deleteFiles } = require('../services/uploadService');
        await deleteFiles(filesToDelete);
      } catch (error) {
        logger.error('Error deleting vehicle files', error);
      }
    }

    // Delete vehicle
    await Vehicle.findByIdAndDelete(req.params.id);

    logger.business('Vehicle deleted', {
      vehicleId: vehicle._id,
      showroomId: req.user._id
    });

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    logger.error('Delete vehicle error', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting vehicle'
    });
  }
});

// @route   POST /api/vehicles/:id/feature
// @desc    Feature vehicle listing
// @access  Private (Showroom owner only)
router.post('/:id/feature', protect, authorize('showroom'), [
  body('type').isIn(['homepage', 'category', 'urgent_sale', 'price_drop']).withMessage('Invalid feature type'),
  body('duration').isInt({ min: 1, max: 30 }).withMessage('Duration must be between 1 and 30 days')
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

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check ownership
    if (vehicle.showroomId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to feature this vehicle'
      });
    }

    const { type, duration } = req.body;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + duration);

    // Feature the vehicle
    vehicle.featured = {
      isFeatured: true,
      type,
      validUntil
    };

    // Increase priority
    vehicle.priority = Math.min(vehicle.priority + 20, 100);

    await vehicle.save();

    logger.business('Vehicle featured', {
      vehicleId: vehicle._id,
      showroomId: req.user._id,
      type,
      duration
    });

    res.json({
      success: true,
      message: 'Vehicle featured successfully',
      data: {
        featured: vehicle.featured,
        validUntil
      }
    });
  } catch (error) {
    logger.error('Feature vehicle error', error);
    res.status(500).json({
      success: false,
      error: 'Server error featuring vehicle'
    });
  }
});

// @route   GET /api/vehicles/compare
// @desc    Compare vehicles
// @access  Public
router.get('/compare', [
  query('ids').isArray({ min: 2, max: 4 }).withMessage('Please provide 2-4 vehicle IDs to compare')
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

    const { ids } = req.query;

    const vehicles = await Vehicle.find({
      _id: { $in: ids },
      status: 'active'
    }).populate('showroomId', 'showroomInfo.businessName profile.location.address ratings');

    if (vehicles.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 vehicles are required for comparison'
      });
    }

    res.json({
      success: true,
      data: { vehicles }
    });
  } catch (error) {
    logger.error('Compare vehicles error', error);
    res.status(500).json({
      success: false,
      error: 'Server error comparing vehicles'
    });
  }
});

module.exports = router;