const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const Message = require('../models/Message');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  protect,
  authorize,
  resourceOwner
} = require('../middleware/auth');
const { uploadDocument } = require('../services/uploadService');
const { sendInquiryNotification } = require('../services/communicationService');

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// @route   GET /api/messages
// @desc    Get user conversations
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['active', 'archived']).withMessage('Invalid status')
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
      status = 'active',
      unread = false
    } = req.query;

    const conversations = await Message.findConversationsForUser(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    // Update unread count for each conversation
    const conversationsWithUnread = conversations.map(conv => {
      const convObj = conv.toObject();
      convObj.unreadCount = conv.getUnreadCount(req.user._id);
      return convObj;
    });

    // Filter by unread if requested
    let filteredConversations = conversationsWithUnread;
    if (unread === 'true') {
      filteredConversations = conversationsWithUnread.filter(conv => conv.unreadCount > 0);
    }

    // Get total unread count
    const totalUnreadResult = await Message.findUnreadCount(req.user._id);
    const totalUnread = totalUnreadResult[0]?.totalUnread || 0;

    res.json({
      success: true,
      data: {
        conversations: filteredConversations,
        totalUnread,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: conversations.length
        }
      }
    });
  } catch (error) {
    logger.error('Get conversations error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching conversations'
    });
  }
});

// @route   GET /api/messages/:conversationId
// @desc    Get conversation messages
// @access  Private
router.get('/:conversationId', protect, async (req, res) => {
  try {
    const conversation = await Message.findById(req.params.conversationId)
      .populate('participants.user', 'profile.name profile.photo userType')
      .populate('messages.sender', 'profile.name profile.photo')
      .populate('vehicleId', 'title specifications.make specifications.model specifications.year media.photos.0.url');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check if user can access this conversation
    if (!conversation.canUserAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this conversation'
      });
    }

    // Mark messages as read
    await conversation.markAsRead(req.user._id);

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error) {
    logger.error('Get conversation error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching conversation'
    });
  }
});

// @route   POST /api/messages
// @desc    Send message or start new conversation
// @access  Private
router.post('/', protect, upload.array('attachments', 5), [
  body('vehicleId').isMongoId().withMessage('Valid vehicle ID is required'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message content is required'),
  body('type').optional().isIn(['inquiry', 'response', 'appointment_request', 'negotiation', 'general']).withMessage('Invalid message type')
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

    const { vehicleId, content, type = 'general' } = req.body;

    // Get vehicle
    const vehicle = await Vehicle.findById(vehicleId).populate('showroomId');
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check if vehicle is active
    if (vehicle.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Vehicle is not available for conversation'
      });
    }

    // Get showroom user
    const showroomUser = vehicle.showroomId;
    if (!showroomUser || showroomUser.userType !== 'showroom') {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle owner'
      });
    }

    // Check if conversation already exists
    let conversation = await Message.findOne({
      vehicleId,
      'participants.user': { $in: [req.user._id, showroomUser._id] },
      'participants.user': { $all: [req.user._id, showroomUser._id] }
    });

    if (!conversation) {
      // Create new conversation
      conversation = new Message({
        participants: [
          {
            user: req.user._id,
            role: req.user.userType,
            lastReadAt: new Date()
          },
          {
            user: showroomUser._id,
            role: showroomUser.userType
          }
        ],
        vehicleId,
        status: 'active'
      });
    }

    // Process attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadDocument(file, 'message_attachment', req.user._id);
          attachments.push({
            type: file.mimetype.startsWith('image/') ? 'image' : 'document',
            url: result.url,
            fileName: file.originalname,
            fileSize: file.size
          });
        } catch (uploadError) {
          logger.error('Message attachment upload error', uploadError);
        }
      }
    }

    // Add message
    const messageData = {
      sender: req.user._id,
      content,
      type,
      attachments,
      status: 'sent'
    };

    await conversation.addMessage(messageData);

    // Update vehicle analytics
    await Vehicle.findByIdAndUpdate(vehicleId, {
      $inc: { 'analytics.contacts': 1 }
    });

    // Send notification to showroom if this is a customer inquiry
    if (req.user.userType === 'customer' && type === 'inquiry') {
      try {
        await sendInquiryNotification(showroomUser, req.user, vehicle, content);
      } catch (notificationError) {
        logger.error('Failed to send inquiry notification', notificationError);
      }
    }

    // Emit real-time message via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const roomName = `conversation_${conversation._id}`;
      io.to(roomName).emit('new_message', {
        conversationId: conversation._id,
        message: conversation.messages[conversation.messages.length - 1],
        sender: {
          _id: req.user._id,
          profile: { name: req.user.profile.name }
        }
      });
    }

    logger.business('Message sent', {
      conversationId: conversation._id,
      senderId: req.user._id,
      vehicleId,
      type
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        conversation,
        message: conversation.messages[conversation.messages.length - 1]
      }
    });
  } catch (error) {
    logger.error('Send message error', error);
    res.status(500).json({
      success: false,
      error: 'Server error sending message'
    });
  }
});

// @route   PUT /api/messages/:conversationId/read
// @desc    Mark conversation as read
// @access  Private
router.put('/:conversationId/read', protect, async (req, res) => {
  try {
    const conversation = await Message.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check if user can access this conversation
    if (!conversation.canUserAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this conversation'
      });
    }

    await conversation.markAsRead(req.user._id);

    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    logger.error('Mark conversation as read error', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating conversation'
    });
  }
});

// @route   PUT /api/messages/:conversationId/archive
// @desc    Archive conversation
// @access  Private
router.put('/:conversationId/archive', protect, async (req, res) => {
  try {
    const conversation = await Message.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check if user can access this conversation
    if (!conversation.canUserAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this conversation'
      });
    }

    conversation.status = 'archived';
    await conversation.save();

    logger.business('Conversation archived', {
      conversationId: conversation._id,
      userId: req.user._id
    });

    res.json({
      success: true,
      message: 'Conversation archived successfully'
    });
  } catch (error) {
    logger.error('Archive conversation error', error);
    res.status(500).json({
      success: false,
      error: 'Server error archiving conversation'
    });
  }
});

// @route   POST /api/messages/:conversationId/notes
// @desc    Add internal note to conversation
// @access  Private (Showroom only)
router.post('/:conversationId/notes', protect, authorize('showroom'), [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Note content is required'),
  body('isInternal').optional().isBoolean().withMessage('isInternal must be boolean')
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

    const { content, isInternal = true } = req.body;

    const conversation = await Message.findById(req.params.conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check if user can access this conversation
    if (!conversation.canUserAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this conversation'
      });
    }

    // Add note
    conversation.notes.push({
      author: req.user._id,
      content,
      isInternal,
      createdAt: new Date()
    });

    await conversation.save();

    logger.business('Note added to conversation', {
      conversationId: conversation._id,
      authorId: req.user._id,
      isInternal
    });

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: {
        note: conversation.notes[conversation.notes.length - 1]
      }
    });
  } catch (error) {
    logger.error('Add note error', error);
    res.status(500).json({
      success: false,
      error: 'Server error adding note'
    });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const totalUnreadResult = await Message.findUnreadCount(req.user._id);
    const totalUnread = totalUnreadResult[0]?.totalUnread || 0;

    res.json({
      success: true,
      data: { totalUnread }
    });
  } catch (error) {
    logger.error('Get unread count error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching unread count'
    });
  }
});

module.exports = router;