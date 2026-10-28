const mongoose = require('mongoose');

const orderTimelineSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    trim: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    negotiation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negotiation'
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProduceListing',
      required: [true, 'Order must belong to a produce listing']
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must have a buyer']
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must have a farmer']
    },
    cropName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: [true, 'Order quantity is required'],
      min: 1
    },
    unit: {
      type: String,
      default: 'KG'
    },
    unitPrice: {
      type: Number,
      required: [true, 'Agreed unit price is required'],
      min: 0.1
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0.1
    },
    orderStatus: {
      type: String,
      enum: {
        values: [
          'PLACED',
          'ESCROW_HELD',
          'DISPATCHED',
          'DELIVERED',
          'SETTLED',
          'CANCELLED'
        ],
        message: '{VALUE} is not a valid order status'
      },
      default: 'PLACED'
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'ESCROW_SECURED', 'PAID_TO_FARMER', 'REFUNDED'],
      default: 'PENDING'
    },
    paymentDetails: {
      paymentMethod: {
        type: String,
        enum: ['UPI', 'NETBANKING', 'CASH_ON_DELIVERY'],
        default: 'UPI'
      },
      transactionId: {
        type: String,
        default: ''
      },
      escrowSecuredAt: Date,
      settledAt: Date
    },
    deliveryAddress: {
      street: { type: String, trim: true },
      village: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      contactPhone: { type: String, trim: true }
    },
    timeline: [orderTimelineSchema]
  },
  {
    timestamps: true
  }
);

// Compound indexes for user query performance
orderSchema.index({ buyer: 1, orderStatus: 1 });
orderSchema.index({ farmer: 1, orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
