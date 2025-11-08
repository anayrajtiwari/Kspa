const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  protect,
  authorize,
  emailVerificationRequired,
  phoneVerificationRequired
} = require('../middleware/auth');
const { sendAppointmentConfirmation } = require('../services/communicationService');

// @route   GET /api/appointments
// @desc    Get user appointments
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['requested', 'scheduled', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('type').optional().isIn(['test_drive', 'showroom_visit', 'inspection', 'delivery']).withMessage('Invalid type')
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
      status,
      type
    } = req.query;

    let appointments;

    if (req.user.userType === 'showroom') {
      appointments = await Appointment.findForShowroom(req.user._id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        type
      });
    } else {
      appointments = await Appointment.findForCustomer(req.user._id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        type
      });
    }

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    logger.error('Get appointments error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching appointments'
    });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get appointment details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('customerId', 'profile.name profile.phone profile.email')
      .populate('showroomId', 'showroomInfo.businessName profile.location.address phone')
      .populate('vehicleId', 'title specifications.make specifications.model specifications.year media.photos.0.url pricing.listedPrice')
      .populate('staff.assignedTo', 'profile.name profile.phone')
      .populate('staff.leadStaff', 'profile.name profile.phone')
      .populate('timeline.updatedBy', 'profile.name');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if user can access this appointment
    if (!appointment.canUserAccess(req.user._id, req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this appointment'
      });
    }

    res.json({
      success: true,
      data: { appointment }
    });
  } catch (error) {
    logger.error('Get appointment error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching appointment'
    });
  }
});

// @route   POST /api/appointments
// @desc    Schedule appointment
// @access  Private
router.post('/', protect, emailVerificationRequired, phoneVerificationRequired, [
  body('vehicleId').isMongoId().withMessage('Valid vehicle ID is required'),
  body('type').isIn(['test_drive', 'showroom_visit', 'inspection', 'delivery']).withMessage('Invalid appointment type'),
  body('scheduledTime').isISO8601().withMessage('Valid scheduled time is required'),
  body('duration').optional().isInt({ min: 15, max: 240 }).withMessage('Duration must be between 15 and 240 minutes'),
  body('location.type').isIn(['showroom', 'customer_address', 'custom']).withMessage('Invalid location type'),
  body('location.address').optional().trim().isLength({ min: 5 }).withMessage('Address is required'),
  body('customerInfo.name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('customerInfo.phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('customerInfo.email').optional().isEmail().withMessage('Valid email is required')
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
      vehicleId,
      type,
      scheduledTime,
      duration = 30,
      location,
      customerInfo
    } = req.body;

    // Get vehicle and showroom
    const vehicle = await Vehicle.findById(vehicleId).populate('showroomId');
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Check if vehicle is available
    if (vehicle.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Vehicle is not available'
      });
    }

    const showroomUser = vehicle.showroomId;

    // Validate scheduled time
    const appointmentTime = new Date(scheduledTime);
    const now = new Date();
    const minTimeAhead = 2 * 60 * 60 * 1000; // 2 hours minimum

    if (appointmentTime <= now) {
      return res.status(400).json({
        success: false,
        error: 'Appointment time must be in the future'
      });
    }

    if (appointmentTime.getTime() - now.getTime() < minTimeAhead) {
      return res.status(400).json({
        success: false,
        error: 'Appointments must be scheduled at least 2 hours in advance'
      });
    }

    // Check for conflicts
    const endTime = new Date(appointmentTime.getTime() + duration * 60 * 1000);
    const conflicts = await Appointment.findConflicts(
      showroomUser._id,
      appointmentTime,
      endTime
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Time slot is not available. Please choose a different time.'
      });
    }

    // Prepare customer info
    const finalCustomerInfo = {
      name: customerInfo.name || req.user.profile.name,
      phone: customerInfo.phone || req.user.phone,
      email: customerInfo.email || req.user.email,
      address: customerInfo.address,
      preferences: customerInfo.preferences || {}
    };

    // Prepare location info
    let finalLocation;
    if (location.type === 'showroom') {
      finalLocation = {
        type: 'showroom',
        address: showroomUser.profile.location.address || {},
        coordinates: showroomUser.profile.location.coordinates || [0, 0]
      };
    } else {
      finalLocation = {
        ...location,
        coordinates: location.coordinates || [0, 0]
      };
    }

    // Create appointment
    const appointment = new Appointment({
      customerId: req.user._id,
      showroomId: showroomUser._id,
      vehicleId,
      type,
      scheduledTime: appointmentTime,
      duration,
      location: finalLocation,
      customerInfo: finalCustomerInfo,
      status: 'requested'
    });

    await appointment.save();

    // Update vehicle analytics
    await Vehicle.findByIdAndUpdate(vehicleId, {
      $inc: { 'analytics.testDrives': 1 }
    });

    // Send confirmation emails
    try {
      // Send to customer
      await sendAppointmentConfirmation(appointment, req.user, showroomUser, vehicle);

      // Send to showroom (in production, would send to showroom staff)
      logger.info(`Appointment notification sent to showroom ${showroomUser._id}`);
    } catch (emailError) {
      logger.error('Failed to send appointment confirmation', emailError);
    }

    logger.business('Appointment scheduled', {
      appointmentId: appointment._id,
      customerId: req.user._id,
      showroomId: showroomUser._id,
      vehicleId,
      type
    });

    res.status(201).json({
      success: true,
      message: 'Appointment scheduled successfully',
      data: { appointment }
    });
  } catch (error) {
    logger.error('Schedule appointment error', error);
    res.status(500).json({
      success: false,
      error: 'Server error scheduling appointment'
    });
  }
});

// @route   PUT /api/appointments/:id/confirm
// @desc    Confirm appointment
// @access  Private (Showroom only)
router.put('/:id/confirm', protect, authorize('showroom'), [
  body('staffAssigned').optional().isArray().withMessage('Staff assigned must be an array'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
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

    const { staffAssigned, notes } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if user can access this appointment
    if (appointment.showroomId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment can be confirmed
    if (!['requested', 'rescheduled'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot confirm appointment with status: ${appointment.status}`
      });
    }

    // Update appointment
    if (staffAssigned) {
      appointment.staff.assignedTo = staffAssigned;
    }

    await appointment.updateStatus('confirmed', req.user._id, notes);

    // Add reminder
    await appointment.addReminder('email', new Date(appointment.scheduledTime.getTime() - 24 * 60 * 60 * 1000), 'Appointment reminder - 24 hours before');
    await appointment.addReminder('sms', new Date(appointment.scheduledTime.getTime() - 2 * 60 * 60 * 1000), 'Appointment reminder - 2 hours before');

    logger.business('Appointment confirmed', {
      appointmentId: appointment._id,
      showroomId: req.user._id,
      customerId: appointment.customerId
    });

    res.json({
      success: true,
      message: 'Appointment confirmed successfully',
      data: { appointment }
    });
  } catch (error) {
    logger.error('Confirm appointment error', error);
    res.status(500).json({
      success: false,
      error: 'Server error confirming appointment'
    });
  }
});

// @route   PUT /api/appointments/:id/reschedule
// @desc    Reschedule appointment
// @access  Private
router.put('/:id/reschedule', protect, [
  body('newTime').isISO8601().withMessage('Valid new time is required'),
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

    const { newTime, reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if user can access this appointment
    if (!appointment.canUserAccess(req.user._id, req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment can be rescheduled
    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot reschedule appointment with status: ${appointment.status}`
      });
    }

    // Validate new time
    const newAppointmentTime = new Date(newTime);
    const now = new Date();
    const minTimeAhead = 2 * 60 * 60 * 1000; // 2 hours minimum

    if (newAppointmentTime <= now) {
      return res.status(400).json({
        success: false,
        error: 'New appointment time must be in the future'
      });
    }

    if (newAppointmentTime.getTime() - now.getTime() < minTimeAhead) {
      return res.status(400).json({
        success: false,
        error: 'Appointments must be scheduled at least 2 hours in advance'
      });
    }

    // Check for conflicts
    const endTime = new Date(newAppointmentTime.getTime() + appointment.duration * 60 * 1000);
    const conflicts = await Appointment.findConflicts(
      appointment.showroomId,
      newAppointmentTime,
      endTime,
      appointment._id
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'New time slot is not available. Please choose a different time.'
      });
    }

    // Reschedule appointment
    await appointment.reschedule(newAppointmentTime, req.user._id, reason);

    logger.business('Appointment rescheduled', {
      appointmentId: appointment._id,
      userId: req.user._id,
      oldTime: appointment.scheduledTime,
      newTime: newAppointmentTime,
      reason
    });

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: { appointment }
    });
  } catch (error) {
    logger.error('Reschedule appointment error', error);
    res.status(500).json({
      success: false,
      error: 'Server error rescheduling appointment'
    });
  }
});

// @route   PUT /api/appointments/:id/cancel
// @desc    Cancel appointment
// @access  Private
router.put('/:id/cancel', protect, [
  body('reason').trim().isLength({ min: 5, max: 200 }).withMessage('Cancellation reason is required')
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

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if user can access this appointment
    if (!appointment.canUserAccess(req.user._id, req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to manage this appointment'
      });
    }

    // Check if appointment can be cancelled
    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel appointment with status: ${appointment.status}`
      });
    }

    // Cancel appointment
    await appointment.cancel(req.user._id, reason);

    logger.business('Appointment cancelled', {
      appointmentId: appointment._id,
      userId: req.user._id,
      reason
    });

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel appointment error', error);
    res.status(500).json({
      success: false,
      error: 'Server error cancelling appointment'
    });
  }
});

// @route   GET /api/appointments/availability
// @desc    Check availability for appointments
// @access  Private (Showroom only)
router.get('/availability', protect, authorize('showroom'), [
  query('date').isISO8601().withMessage('Valid date is required'),
  query('duration').optional().isInt({ min: 15, max: 240 }).withMessage('Duration must be between 15 and 240 minutes')
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

    const { date, duration = 30 } = req.query;

    const requestedDate = new Date(date);
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(9, 0, 0, 0); // 9 AM

    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(18, 0, 0, 0); // 6 PM

    // Generate time slots
    const timeSlots = [];
    const slotDuration = 30; // 30-minute slots
    let currentTime = startOfDay;

    while (currentTime < endOfDay) {
      const slotEndTime = new Date(currentTime.getTime() + duration * 60 * 1000);

      if (slotEndTime <= endOfDay) {
        // Check for conflicts
        const conflicts = await Appointment.findConflicts(
          req.user._id,
          currentTime,
          slotEndTime
        );

        timeSlots.push({
          time: currentTime.toISOString(),
          available: conflicts.length === 0,
          conflicts: conflicts.map(c => ({
            id: c._id,
            type: c.type,
            duration: c.duration
          }))
        });
      }

      currentTime = new Date(currentTime.getTime() + slotDuration * 60 * 1000);
    }

    res.json({
      success: true,
      data: {
        date: requestedDate,
        timeSlots,
        duration
      }
    });
  } catch (error) {
    logger.error('Check availability error', error);
    res.status(500).json({
      success: false,
      error: 'Server error checking availability'
    });
  }
});

// @route   GET /api/appointments/upcoming
// @desc    Get upcoming appointments
// @access  Private (Showroom only)
router.get('/upcoming', protect, authorize('showroom'), [
  query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1 and 168')
], async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const appointments = await Appointment.getUpcomingForShowroom(req.user._id, parseInt(hours));

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    logger.error('Get upcoming appointments error', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching upcoming appointments'
    });
  }
});

module.exports = router;