const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  showroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    required: true
  },
  specifications: {
    make: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    model: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1
    },
    variant: {
      type: String,
      trim: true
    },
    fuel: {
      type: String,
      enum: ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid'],
      required: true
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic', 'cvt', 'dct', 'amt'],
      required: true
    },
    bodyType: {
      type: String,
      enum: ['sedan', 'suv', 'hatchback', 'muv', 'coupe', 'convertible', 'pickup', 'van', 'luxury'],
      required: true
    },
    engineCapacity: {
      type: Number, // in CC
      required: true
    },
    mileage: {
      type: Number, // km/l or km/charge for electric
      required: true
    },
    power: {
      type: Number, // in PS
      required: true
    },
    torque: {
      type: Number, // in Nm
      required: true
    },
    seatingCapacity: {
      type: Number,
      required: true,
      min: 2,
      max: 8
    },
    color: {
      exterior: String,
      interior: String
    },
    features: {
      safety: [String], // ABS, Airbags, etc.
      interior: [String], // AC, Music System, etc.
      exterior: [String], // Alloy Wheels, Sunroof, etc.
      technology: [String] // Bluetooth, USB, etc.
    }
  },
  condition: {
    kilometers: {
      type: Number,
      required: true,
      min: 0
    },
    owners: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    accidentHistory: {
      type: String,
      enum: ['none', 'minor', 'major'],
      default: 'none'
    },
    serviceHistory: {
      type: Boolean,
      default: false
    },
    warranty: {
      remaining: Boolean,
      monthsLeft: Number,
      kmRemaining: Number
    },
    insurance: {
      valid: Boolean,
      type: String,
      expiryDate: Date,
      coverage: String
    },
    registration: {
      state: String,
      number: String,
      type: {
        type: String,
        enum: ['individual', 'commercial', 'company']
      }
    },
    fitnessCertificate: {
      valid: Boolean,
      expiryDate: Date
    }
  },
  pricing: {
    listedPrice: {
      type: Number,
      required: true,
      min: 0
    },
    negotiable: {
      type: Boolean,
      default: true
    },
    expectedPrice: {
      type: Number,
      min: 0
    },
    discount: {
      amount: { type: Number, default: 0 },
      validUntil: Date
    },
    priceHistory: [{
      price: Number,
      date: { type: Date, default: Date.now },
      reason: String
    }]
  },
  media: {
    photos: [{
      url: String,
      thumbnail: String,
      caption: String,
      isPrimary: { type: Boolean, default: false },
      angle: {
        type: String,
        enum: ['front_exterior', 'rear_exterior', 'side_driver', 'side_passenger',
                'front_interior', 'rear_interior', 'engine_bay', 'odometer', 'trunk', 'other']
      },
      uploadedAt: { type: Date, default: Date.now }
    }],
    videos: [{
      url: String,
      thumbnail: String,
      title: String,
      duration: Number, // in seconds
      type: {
        type: String,
        enum: ['walkthrough', 'test_drive', 'feature_showcase']
      },
      uploadedAt: { type: Date, default: Date.now }
    }],
    documents: [{
      type: {
        type: String,
        enum: ['registration', 'insurance', 'service_history', 'pollution_certificate', 'other']
      },
      url: String,
      fileName: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    inspectionReport: {
      url: String,
      validUntil: Date,
      score: {
        type: Number,
        min: 0,
        max: 100
      }
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: {
      street: String,
      area: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    deliveryOptions: [{
      type: {
        type: String,
        enum: ['showroom_pickup', 'home_delivery', 'nearest_location']
      },
      available: Boolean,
      cost: Number,
      estimatedTime: String
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'reserved', 'sold', 'delisted'],
    default: 'draft'
  },
  featured: {
    isFeatured: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['homepage', 'category', 'urgent_sale', 'price_drop']
    },
    validUntil: Date
  },
  availability: {
    inStock: { type: Boolean, default: true },
    expectedDelivery: {
      type: String,
      default: 'Immediately'
    },
    testDriveAvailable: { type: Boolean, default: true }
  },
  analytics: {
    views: { type: Number, default: 0 },
    contacts: { type: Number, default: 0 },
    testDrives: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    lastViewed: Date
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    canonicalUrl: String
  },
  tags: [String],
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  listedAt: Date,
  soldAt: Date,
  soldTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  commission: {
    percentage: Number,
    amount: Number,
    paid: { type: Boolean, default: false },
    paidAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
vehicleSchema.index({ showroomId: 1 });
vehicleSchema.index({ 'specifications.make': 1, 'specifications.model': 1 });
vehicleSchema.index({ 'specifications.year': -1 });
vehicleSchema.index({ 'pricing.listedPrice': 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ 'location': '2dsphere' });
vehicleSchema.index({ 'specifications.fuel': 1 });
vehicleSchema.index({ 'specifications.transmission': 1 });
vehicleSchema.index({ 'specifications.bodyType': 1 });
vehicleSchema.index({ createdAt: -1 });
vehicleSchema.index({ featured: 1 });
vehicleSchema.index({ 'analytics.views': -1 });
vehicleSchema.index({ slug: 1 });

// Compound indexes for common queries
vehicleSchema.index({
  status: 1,
  'pricing.listedPrice': 1,
  'specifications.year': -1
});
vehicleSchema.index({
  status: 1,
  'location': '2dsphere',
  'specifications.make': 1
});

// Virtual for age of vehicle
vehicleSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.specifications.year;
});

// Virtual for price per kilometer (if applicable)
vehicleSchema.virtual('pricePerKm').get(function() {
  if (this.condition.kilometers > 0) {
    return Math.round(this.pricing.listedPrice / this.condition.kilometers);
  }
  return 0;
});

// Pre-save middleware to generate slug
vehicleSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isNew) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    this.slug = `${baseSlug}-${Date.now()}`;
  }
  next();
});

// Pre-save middleware to update listedAt when status changes to active
vehicleSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'active' && !this.listedAt) {
    this.listedAt = new Date();
  }
  if (this.isModified('status') && this.status === 'sold' && !this.soldAt) {
    this.soldAt = new Date();
  }
  next();
});

// Static methods
vehicleSchema.statics.findByMakeModel = function(make, model) {
  return this.find({
    'specifications.make': new RegExp(make, 'i'),
    'specifications.model': new RegExp(model, 'i'),
    status: 'active'
  });
};

vehicleSchema.statics.findInRadius = function(coordinates, radiusKm, filters = {}) {
  return this.find({
    ...filters,
    location: {
      $geoWithin: {
        $centerSphere: [coordinates, radiusKm / 6371] // radius in radians
      }
    },
    status: 'active'
  });
};

vehicleSchema.statics.searchVehicles = function(searchTerm, filters = {}) {
  const searchRegex = new RegExp(searchTerm, 'i');
  return this.find({
    ...filters,
    $or: [
      { title: searchRegex },
      { 'specifications.make': searchRegex },
      { 'specifications.model': searchRegex },
      { 'specifications.variant': searchRegex },
      { tags: searchRegex }
    ],
    status: 'active'
  });
};

module.exports = mongoose.model('Vehicle', vehicleSchema);