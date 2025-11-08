const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  showroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  type: {
    type: String,
    enum: ['test_drive', 'showroom_visit', 'inspection', 'delivery', 'document_verification'],
    required: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    default: 30
  },
  location: {
    type: {
      type: String,
      enum: ['showroom', 'customer_address', 'custom'],
      required: true
    },
    address: {
      street: String,
      area: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    instructions: String
  },
  status: {
    type: String,
    enum: ['requested', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'],
    default: 'requested'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  customerInfo: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    address: String,
    drivingLicense: String,
    preferences: {
      preferredTime: String,
      transportation: {
        type: String,
        enum: ['own_vehicle', 'showroom_pickup', 'taxi']
      },
      specialRequirements: String
    }
  },
  vehicleInfo: {
    ensureAvailability: { type: Boolean, default: true },
    preparationNotes: String,
    fuelLevel: {
      type: String,
      enum: ['full', 'half', 'quarter', 'low']
    },
    cleaningRequired: { type: Boolean, default: true }
  },
  staff: {
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    leadStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requirements: {
      skills: [String],
      experience: String,
      certifications: [String]
    }
  },
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    attachments: [{
      type: {
        type: String,
        enum: ['photo', 'document', 'video']
      },
      url: String,
      description: String
    }]
  }],
  feedback: {
    customerRating: {
      type: Number,
      min: 1,
      max: 5
    },
    customerReview: String,
    showroomRating: {
      type: Number,
      min: 1,
      max: 5
    },
    showroomReview: String,
    issues: [{
      type: {
        type: String,
        enum: ['late_arrival', 'vehicle_condition', 'staff_behavior', 'location_issue', 'other']
      },
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      }
    }],
    recommendations: String,
    collectedAt: Date
  },
  outcome: {
    successful: Boolean,
    nextSteps: {
      type: String,
      enum: ['schedule_another_test_drive', 'negotiation', 'documentation', 'payment', 'lost_interest']
    },
    estimatedPurchaseTime: Date,
    dealValue: Number,
    commissionAmount: Number,
    notes: String
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'push', 'call']
    },
    scheduledFor: Date,
    sent: { type: Boolean, default: false },
    sentAt: Date,
    content: String
  }],
  rescheduleHistory: [{
    originalTime: Date,
    newTime: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    requestedAt: { type: Date, default: Date.now }
  }],
  cancelReason: {
    reason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: Date,
    refundable: { type: Boolean, default: false },
    refundAmount: Number,
    refundProcessed: Boolean
  },
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    isInternal: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  }],
  tags: [String],
  source: {
    type: String,
    enum: ['website', 'mobile_app', 'phone', 'email', 'walk_in', 'referral'],
    default: 'website'
  },
  campaignId: String,
  metadata: {
    device: String,
    browser: String,
    ip: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
appointmentSchema.index({ customerId: 1 });
appointmentSchema.index({ showroomId: 1 });
appointmentSchema.index({ vehicleId: 1 });
appointmentSchema.index({ scheduledTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ type: 1 });
appointmentSchema.index({ createdAt: -1 });

// Compound indexes
appointmentSchema.index([
  { showroomId: 1, scheduledTime: 1, status: 1 }
]);
appointmentSchema.index([
  { customerId: 1, scheduledTime: -1 }
]);
appointmentSchema.index([
  { vehicleId: 1, status: 1, scheduledTime: -1 }
]);

// Virtual for checking if appointment is in the past
appointmentSchema.virtual('isPast').get(function() {
  return this.scheduledTime < new Date();
});

// Virtual for time until appointment
appointmentSchema.virtual('timeUntil').get(function() {
  return this.scheduledTime - new Date();
});

// Pre-save middleware to add initial timeline entry
appointmentSchema.pre('save', function(next) {
  if (this.isNew) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      notes: 'Appointment created'
    });
  }
  next();
});

// Instance methods
appointmentSchema.methods.updateStatus = function(newStatus, updatedBy, notes = '') {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy,
    notes
  });

  return this.save();
};

appointmentSchema.methods.addReminder = function(type, scheduledFor, content) {
  this.reminders.push({
    type,
    scheduledFor,
    content
  });

  return this.save();
};

appointmentSchema.methods.reschedule = function(newTime, requestedBy, reason = '') {
  this.rescheduleHistory.push({
    originalTime: this.scheduledTime,
    newTime,
    requestedBy,
    reason
  });

  this.scheduledTime = newTime;
  this.status = 'rescheduled';

  this.timeline.push({
    status: 'rescheduled',
    timestamp: new Date(),
    updatedBy: requestedBy,
    notes: `Rescheduled from ${this.scheduledTime} to ${newTime}. Reason: ${reason}`
  });

  return this.save();
};

appointmentSchema.methods.cancel = function(cancelledBy, reason = '') {
  this.status = 'cancelled';
  this.cancelReason = {
    reason,
    cancelledBy,
    cancelledAt: new Date()
  };

  this.timeline.push({
    status: 'cancelled',
    timestamp: new Date(),
    updatedBy: cancelledBy,
    notes: `Cancelled. Reason: ${reason}`
  });

  return this.save();
};

appointmentSchema.methods.addFeedback = function(feedbackData) {
  this.feedback = {
    ...feedbackData,
    collectedAt: new Date()
  };

  return this.save();
};

appointmentSchema.methods.canUserAccess = function(userId, userRole) {
  if (this.customerId.toString() === userId || this.showroomId.toString() === userId) {
    return true;
  }

  // Check if user is assigned staff
  return this.staff.assignedTo.some(staffId => staffId.toString() === userId);
};

// Static methods
appointmentSchema.statics.findForShowroom = function(showroomId, options = {}) {
  const {
    startDate,
    endDate,
    status,
    type,
    page = 1,
    limit = 20
  } = options;

  const query = { showroomId };

  if (startDate || endDate) {
    query.scheduledTime = {};
    if (startDate) query.scheduledTime.$gte = new Date(startDate);
    if (endDate) query.scheduledTime.$lte = new Date(endDate);
  }

  if (status) query.status = status;
  if (type) query.type = type;

  return this.find(query)
    .populate('customerId', 'profile.name profile.phone profile.email')
    .populate('vehicleId', 'title specifications.make specifications.model specifications.year pricing.listedPrice')
    .populate('staff.assignedTo', 'profile.name')
    .sort({ scheduledTime: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

appointmentSchema.statics.findForCustomer = function(customerId, options = {}) {
  const {
    status,
    type,
    page = 1,
    limit = 20
  } = options;

  const query = { customerId };
  if (status) query.status = status;
  if (type) query.type = type;

  return this.find(query)
    .populate('showroomId', 'showroomInfo.businessName profile.location.address')
    .populate('vehicleId', 'title specifications.make specifications.model specifications.year media.photos.0.url pricing.listedPrice')
    .sort({ scheduledTime: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

appointmentSchema.statics.findConflicts = function(showroomId, startTime, endTime, excludeId = null) {
  const query = {
    showroomId,
    status: { $nin: ['cancelled', 'completed'] },
    $or: [
      {
        scheduledTime: { $lt: endTime },
        $expr: { $lte: [{ $add: ['$scheduledTime', { $multiply: ['$duration', 60000] }] }, startTime] }
      },
      {
        scheduledTime: { $gte: startTime },
        scheduledTime: { $lt: endTime }
      }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return this.find(query);
};

appointmentSchema.statics.getUpcomingForShowroom = function(showroomId, hours = 24) {
  const startTime = new Date();
  const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);

  return this.find({
    showroomId,
    scheduledTime: { $gte: startTime, $lte: endTime },
    status: { $in: ['scheduled', 'confirmed'] }
  })
    .populate('customerId', 'profile.name profile.phone')
    .populate('vehicleId', 'title specifications.make specifications.model')
    .sort({ scheduledTime: 1 });
};

module.exports = mongoose.model('Appointment', appointmentSchema);