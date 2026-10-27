const mongoose = require('mongoose');

const mandiRateSchema = new mongoose.Schema(
  {
    commodity: {
      type: String,
      required: [true, 'Please provide commodity name'],
      trim: true,
      uppercase: true,
      index: true
    },
    category: {
      type: String,
      enum: ['VEGETABLES', 'GRAINS', 'PULSES', 'FRUITS', 'OILSEEDS', 'SPICES', 'FIBRES'],
      required: true
    },
    state: {
      type: String,
      required: [true, 'Please provide state name'],
      trim: true,
      uppercase: true,
      index: true
    },
    district: {
      type: String,
      required: [true, 'Please provide district name'],
      trim: true,
      uppercase: true,
      index: true
    },
    marketCenter: {
      type: String,
      required: [true, 'Please provide APMC mandi center name'],
      trim: true
    },
    minPrice: {
      type: Number,
      required: [true, 'Minimum price is required'],
      min: 0
    },
    maxPrice: {
      type: Number,
      required: [true, 'Maximum price is required'],
      min: 0
    },
    modalPrice: {
      type: Number,
      required: [true, 'Modal (average market) price is required'],
      min: 0
    },
    unit: {
      type: String,
      default: 'QUINTAL' // ₹ per Quintal (100 Kg standard APMC unit)
    },
    arrivalQuantity: {
      type: Number,
      default: 0 // In Quintals
    },
    priceDate: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for sub-second APMC rate lookups by commodity and district
mandiRateSchema.index({ commodity: 1, district: 1, priceDate: -1 });

module.exports = mongoose.model('MandiRate', mandiRateSchema);
