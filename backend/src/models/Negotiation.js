const mongoose = require('mongoose');

const bidHistorySchema = new mongoose.Schema({
  bidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bidderRole: {
    type: String,
    enum: ['BUYER', 'FARMER'],
    required: true
  },
  pricePerUnit: {
    type: Number,
    required: [true, 'Price per unit is required in bid'],
    min: 0.1
  },
  note: {
    type: String,
    trim: true,
    maxlength: 300
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const negotiationSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProduceListing',
      required: [true, 'Negotiation must be linked to a produce listing']
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Negotiation must have a buyer']
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Negotiation must have a farmer']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity requested is required'],
      min: 1
    },
    originalListingPrice: {
      type: Number,
      required: true
    },
    currentOfferedPrice: {
      type: Number,
      required: [true, 'Current offered price is required'],
      min: 0.1
    },
    currentTurn: {
      type: String,
      enum: ['BUYER', 'FARMER'],
      default: 'FARMER'
    },
    status: {
      type: String,
      enum: ['OPEN', 'COUNTER_OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      default: 'OPEN'
    },
    agreedPrice: {
      type: Number,
      default: null
    },
    agreedTotalAmount: {
      type: Number,
      default: null
    },
    bidHistory: [bidHistorySchema],
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 48 * 60 * 60 * 1000) // 48-hour negotiation window
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast lookup
negotiationSchema.index({ listing: 1, buyer: 1 });
negotiationSchema.index({ farmer: 1, status: 1 });
negotiationSchema.index({ buyer: 1, status: 1 });

module.exports = mongoose.model('Negotiation', negotiationSchema);
