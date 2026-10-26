const mongoose = require('mongoose');

const produceListingSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Produce listing must belong to a farmer']
    },
    cropName: {
      type: String,
      required: [true, 'Please specify the crop name'],
      trim: true,
      maxlength: [100, 'Crop name cannot exceed 100 characters']
    },
    category: {
      type: String,
      required: [true, 'Please select a crop category'],
      enum: {
        values: [
          'GRAINS',
          'PULSES',
          'VEGETABLES',
          'FRUITS',
          'OILSEEDS',
          'SPICES',
          'OTHER'
        ],
        message: '{VALUE} is not a valid crop category'
      }
    },
    quantity: {
      type: Number,
      required: [true, 'Please provide the quantity'],
      min: [1, 'Quantity must be at least 1']
    },
    unit: {
      type: String,
      enum: ['KG', 'QUINTAL', 'TON'],
      default: 'KG'
    },
    pricePerUnit: {
      type: Number,
      required: [true, 'Please specify expected price per unit in ₹'],
      min: [1, 'Price per unit must be at least ₹1']
    },
    qualityGrade: {
      type: String,
      enum: ['GRADE_A', 'GRADE_B', 'GRADE_C', 'ORGANIC'],
      default: 'GRADE_A'
    },
    harvestDate: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    images: {
      type: [String],
      default: []
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      },
      village: { type: String, trim: true },
      taluk: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'UNDER_NEGOTIATION', 'SOLD', 'EXPIRED'],
      default: 'AVAILABLE'
    }
  },
  {
    timestamps: true
  }
);

// Geospatial index for hyper-local nearby radius search
produceListingSchema.index({ 'location.coordinates': '2dsphere' });

// Compound indexes for marketplace queries & farmer dashboard
produceListingSchema.index({ category: 1, status: 1 });
produceListingSchema.index({ farmer: 1, status: 1 });
produceListingSchema.index({ cropName: 'text', description: 'text' });

module.exports = mongoose.model('ProduceListing', produceListingSchema);
