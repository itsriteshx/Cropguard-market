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

const chatMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['BUYER', 'FARMER'],
    required: true
  },
  senderName: {
    type: String,
    trim: true,
    default: 'Participant'
  },
  text: {
    type: String,
    required: [true, 'Message text is required'],
    trim: true,
    maxlength: 500
  },
  isVoice: {
    type: Boolean,
    default: false
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
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    agreedPrice: {
      type: Number,
      default: null
    },
    agreedTotalAmount: {
      type: Number,
      default: null
    },
    bidHistory: [bidHistorySchema],
    messages: [chatMessageSchema],
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
// Partial unique index preventing duplicate active negotiations per listing/buyer
negotiationSchema.index(
  { listing: 1, buyer: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['OPEN', 'COUNTER_OFFERED'] } },
    name: 'active_negotiation_listing_buyer_unique'
  }
);
negotiationSchema.index({ listing: 1, status: 1 });
negotiationSchema.index({ farmer: 1, status: 1 });
negotiationSchema.index({ buyer: 1, status: 1 });

module.exports = mongoose.model('Negotiation', negotiationSchema);
