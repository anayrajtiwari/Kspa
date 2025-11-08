const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Account is deactivated'
        });
      }

      if (user.isBlocked) {
        return res.status(401).json({
          success: false,
          error: `Account blocked: ${user.blockedReason || 'Contact support'}`
        });
      }

      // Check if account is locked due to too many login attempts
      if (user.isLocked()) {
        return res.status(423).json({
          success: false,
          error: 'Account is temporarily locked due to too many failed login attempts'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.auth('Token verification failed', null, { error: error.message });
      return res.status(401).json({
        success: false,
        error: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no token'
    });
  }
};

// Authorize specific user types
const authorize = (...userTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!userTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }

    next();
  };
};

// Check if user owns the resource or is admin
const resourceOwner = (resourceField = 'userId') => {
  return async (req, res, next) => {
    try {
      // Admin can access any resource
      if (req.user.userType === 'admin') {
        return next();
      }

      // Check ownership based on the resource field
      const resourceId = req.params.id || req.params.vehicleId || req.params.messageId;
      const resourceModel = getResourceModel(req.route.path);

      if (!resourceModel) {
        return next();
      }

      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      const resourceUserId = getNestedProperty(resource, resourceField);

      if (resourceUserId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this resource'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Resource owner check failed', error);
      return res.status(500).json({
        success: false,
        error: 'Server error during authorization'
      });
    }
  };
};

// Verify email ownership
const emailVerificationRequired = async (req, res, next) => {
  if (!req.user.verification.email) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};

// Phone verification required for certain actions
const phoneVerificationRequired = async (req, res, next) => {
  if (!req.user.verification.phone) {
    return res.status(403).json({
      success: false,
      error: 'Phone verification required',
      code: 'PHONE_NOT_VERIFIED'
    });
  }
  next();
};

// Check showroom verification status
const showroomVerificationRequired = async (req, res, next) => {
  if (req.user.userType === 'showroom') {
    const isVerified = req.user.verification.documents.length > 0 &&
      req.user.verification.documents.every(doc => doc.verified);

    if (!isVerified) {
      return res.status(403).json({
        success: false,
        error: 'Showroom verification required',
        code: 'SHOWROOM_NOT_VERIFIED'
      });
    }
  }
  next();
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (user && user.isActive && !user.isBlocked() && !user.isLocked()) {
        req.user = user;
      }
    } catch (error) {
      // Silently ignore token errors for optional auth
      logger.debug('Optional auth token invalid', { error: error.message });
    }
  }
  next();
};

// Helper function to determine model based on route
const getResourceModel = (path) => {
  if (path.includes('/vehicles')) {
    return require('../models/Vehicle');
  }
  if (path.includes('/messages')) {
    return require('../models/Message');
  }
  if (path.includes('/appointments')) {
    return require('../models/Appointment');
  }
  return null;
};

// Helper function to get nested property
const getNestedProperty = (obj, path) => {
  return path.split('.').reduce((current, key) => current && current[key], obj);
};

// Refresh token middleware
const refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token required'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive || user.isBlocked()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    req.newToken = newAccessToken;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
};

module.exports = {
  protect,
  authorize,
  resourceOwner,
  emailVerificationRequired,
  phoneVerificationRequired,
  showroomVerificationRequired,
  optionalAuth,
  refreshToken
};