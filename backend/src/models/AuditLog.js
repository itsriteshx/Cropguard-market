const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'DEAL_NEGOTIATED',
        'ORDER_CREATED',
        'ESCROW_SECURED',
        'DISPATCH_CONFIRMED',
        'DELIVERY_VERIFIED',
        'SETTLEMENT_RELEASED',
        'COMMISSION_EXEMPTION_APPLIED',
        'APMC_BENCHMARK_VERIFIED',
        'LANGUAGE_UPDATED'
      ]
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorRole: {
      type: String,
      enum: ['FARMER', 'BUYER_RETAIL', 'BUYER_WHOLESALE', 'ADMIN'],
      required: true
    },
    targetEntity: {
      type: String,
      enum: ['ORDER', 'NEGOTIATION', 'PRODUCE_LISTING', 'USER', 'MANDI_RATE'],
      required: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    financialSnapshot: {
      dealAmount: { type: Number, default: 0 },
      middlemanFeeSaved: { type: Number, default: 0 }, // 10% direct farmer retention
      apmcBenchmarkRate: { type: Number, default: 0 },
      settlementStatus: { type: String, default: 'SECURED' }
    },
    complianceAuthority: {
      type: String,
      default: 'UASD APMC Cell & ICAR Protocol'
    },
    isVerified: {
      type: Boolean,
      default: true
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for audit queries
auditLogSchema.index({ targetEntity: 1, targetId: 1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
