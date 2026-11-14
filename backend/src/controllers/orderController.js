const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Order = require('../models/Order');
const Negotiation = require('../models/Negotiation');
const ProduceListing = require('../models/ProduceListing');

// Generate human-readable order number
const generateOrderNumber = () => `CGM-${randomUUID().toUpperCase()}`;

class OrderError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Create an order and reserve its inventory in one MongoDB transaction. */
const createOrder = async (req, res, next) => {
  let session;
  try {
    const { negotiationId, listingId, quantity: requestedQuantity, deliveryAddress, paymentMethod, notes } = req.body;
    if (!negotiationId && !listingId) throw new OrderError(400, 'Provide a negotiation or listing ID');
    if (negotiationId && listingId) throw new OrderError(400, 'Provide only one order source');
    if (!['BUYER_RETAIL', 'BUYER_WHOLESALE', 'ADMIN'].includes(req.user.role)) throw new OrderError(403, 'Only buyers can place orders');

    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      // The callback can be retried by MongoDB, so do not send responses here.
      let negotiation, listing, quantity, unitPrice;
      const orderId = new mongoose.Types.ObjectId();
      if (negotiationId) {
        negotiation = await Negotiation.findById(negotiationId).session(session);
        if (!negotiation) throw new OrderError(404, 'Negotiation not found');
        if (String(negotiation.buyer) !== String(req.user._id)) throw new OrderError(403, 'Only the buyer in this negotiation can create its order');
        if (negotiation.status !== 'ACCEPTED') throw new OrderError(409, 'The negotiation must be accepted first');
        const existing = await Order.findOne({ negotiation: negotiationId }).session(session);
        if (existing) { result = { order: existing, created: false }; return; }
        const claimed = await Negotiation.findOneAndUpdate(
          { _id: negotiationId, status: 'ACCEPTED', order: null },
          { $set: { order: orderId } }, { new: true, session }
        );
        if (!claimed) throw new OrderError(409, 'This negotiation already has an order');
        listing = await ProduceListing.findById(negotiation.listing).session(session);
        quantity = Number(negotiation.quantity);
        unitPrice = Number(negotiation.agreedPrice);
      } else {
        listing = await ProduceListing.findById(listingId).session(session);
        quantity = requestedQuantity === undefined ? Number(listing?.quantity) : Number(requestedQuantity);
        unitPrice = Number(listing?.pricePerUnit);
      }
      if (!listing) throw new OrderError(404, 'Produce listing not found');
      if (listing.deletionPending) throw new OrderError(409, 'Produce listing is currently being deleted or unavailable');
      if (String(listing.farmer) === String(req.user._id)) throw new OrderError(403, 'You cannot order your own produce');
      if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0.1) throw new OrderError(400, 'Enter a valid quantity and price');
      const totalAmount = Math.round(unitPrice * quantity * 100) / 100;
      if (!Number.isFinite(totalAmount)) throw new OrderError(400, 'Invalid order total');

      // Reserve conditionally, including legacy UNDER_NEGOTIATION listings.
      const reserved = await ProduceListing.findOneAndUpdate(
        { _id: listing._id, status: { $in: ['AVAILABLE', 'UNDER_NEGOTIATION'] }, deletionPending: { $ne: true }, quantity: { $gte: quantity } },
        [{ $set: { quantity: { $subtract: ['$quantity', quantity] }, status: { $cond: [{ $lte: [{ $subtract: ['$quantity', quantity] }, 0] }, 'SOLD', '$status'] } } }],
        { new: true, session }
      );
      if (!reserved) throw new OrderError(409, 'The produce is unavailable or the requested quantity exceeds remaining stock');
      const orderNumber = generateOrderNumber();
      const [order] = await Order.create([{
        _id: orderId, orderNumber, negotiation: negotiation?._id || null, listing: listing._id,
        buyer: req.user._id, farmer: listing.farmer, cropName: listing.cropName, quantity,
        unit: listing.unit, unitPrice, totalAmount, middlemanFeeSaved: Math.round(totalAmount * 0.1),
        stockReserved: true, orderStatus: 'PLACED', paymentStatus: 'PENDING', paymentDetails: { paymentMethod: paymentMethod || 'UPI' },
        deliveryAddress: deliveryAddress || { village: req.user.location?.village || '', district: req.user.location?.district || '', state: req.user.location?.state || '', pincode: req.user.location?.pincode || '', contactPhone: req.user.phone },
        timeline: [{ status: 'PLACED', note: notes || `Order ${orderNumber} placed at ₹${unitPrice}/${listing.unit}`, timestamp: new Date(), updatedBy: req.user._id }]
      }], { session });
      result = { order, created: true };
    });
    return res.status(result.created ? 201 : 200).json({ success: true, message: result.created ? 'Order created successfully' : 'Order already exists', order: result.order, created: result.created });
  } catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 20 || /Transaction numbers are only allowed/i.test(error.message)) return res.status(503).json({ success: false, message: 'Order creation requires a MongoDB replica set or Atlas cluster' });
    next(error);
  } finally {
    if (session) await session.endSession();
  }
};

/**
 * @desc    Transition order state (State Machine Engine)
 * @route   PUT /api/orders/:id/status
 * @access  Private (Buyer, Farmer, Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { nextStatus: rawNextStatus, status, note, transactionId } = req.body;
    const nextStatus = rawNextStatus || status;

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'Please provide nextStatus to transition order'
      });
    }

    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name phone')
      .populate('farmer', 'name phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = order.buyer._id.toString() === userId;
    const isFarmer = order.farmer._id.toString() === userId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isBuyer && !isFarmer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }

    const currentStatus = order.orderStatus;

    // Define valid state machine transitions and authorized roles
    const validTransitions = {
      PLACED: ['ESCROW_HELD', 'CANCELLED'],
      ESCROW_HELD: ['DISPATCHED', 'CANCELLED'],
      DISPATCHED: ['DELIVERED'],
      DELIVERED: ['SETTLED'],
      SETTLED: [],
      CANCELLED: []
    };

    if (!validTransitions[currentStatus]?.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid state transition from ${currentStatus} to ${nextStatus}. Allowed: ${validTransitions[currentStatus]?.join(', ') || 'None'}`
      });
    }

    if (nextStatus === 'CANCELLED') {
      let session;
      try {
        session = await mongoose.startSession();
        let cancelled;
        await session.withTransaction(async () => {
          cancelled = await Order.findOneAndUpdate(
            { _id: order._id, orderStatus: currentStatus, __v: order.__v ?? 0 },
            { $set: { orderStatus: 'CANCELLED', paymentStatus: order.paymentStatus === 'ESCROW_SECURED' ? 'REFUNDED' : 'PENDING' }, $push: { timeline: { status: 'CANCELLED', note: note || `Order cancelled from ${currentStatus}`, timestamp: new Date(), updatedBy: req.user._id } }, $inc: { __v: 1 } },
            { new: true, session, runValidators: true }
          );
          if (!cancelled) throw new OrderError(409, 'Order changed. Refresh and try again.');
          if (!order.stockReserved) return; // Older or seeded orders have no confirmed reservation.
          const restored = await ProduceListing.findOneAndUpdate(
            { _id: order.listing },
            [{ $set: { quantity: { $add: ['$quantity', order.quantity] }, status: { $cond: [{ $eq: ['$status', 'SOLD'] }, 'AVAILABLE', '$status'] } } }],
            { new: true, session }
          );
          if (!restored) throw new OrderError(409, 'Produce listing is missing; cancellation could not restore stock');
        });
        return res.status(200).json({ success: true, message: order.stockReserved ? 'Order cancelled and stock restored' : 'Order cancelled; no recorded stock reservation to restore', order: cancelled });
      } catch (error) {
        if (error instanceof OrderError) return res.status(error.status).json({ success: false, message: error.message });
        if (error.code === 20 || /Transaction numbers are only allowed/i.test(error.message)) return res.status(503).json({ success: false, message: 'Cancellation requires a MongoDB replica set or Atlas cluster' });
        throw error;
      } finally {
        if (session) await session.endSession();
      }
    }

    // Role-specific transition rules
    const now = new Date();
    const updateDoc = {
      $set: {
        orderStatus: nextStatus
      },
      $push: {
        timeline: {
          status: nextStatus,
          note: note || `Order transitioned from ${currentStatus} to ${nextStatus}`,
          timestamp: now,
          updatedBy: req.user._id
        }
      },
      $inc: { __v: 1 }
    };

    if (nextStatus === 'ESCROW_HELD') {
      if (!isBuyer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the buyer can make escrow payment'
        });
      }
      updateDoc.$set.paymentStatus = 'ESCROW_SECURED';
      updateDoc.$set['paymentDetails.escrowSecuredAt'] = now;
      if (transactionId) {
        updateDoc.$set['paymentDetails.transactionId'] = String(transactionId).trim();
      }
    } else if (nextStatus === 'DISPATCHED') {
      if (!isFarmer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the farmer can dispatch produce'
        });
      }
      if (order.paymentStatus !== 'ESCROW_SECURED') {
        return res.status(409).json({
          success: false,
          message: 'Payment must be secured in escrow before dispatching produce'
        });
      }
    } else if (nextStatus === 'DELIVERED') {
      if (!isBuyer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the buyer can confirm delivery of produce'
        });
      }
    } else if (nextStatus === 'SETTLED') {
      if (!isBuyer && !isAdmin) return res.status(403).json({ success: false, message: 'Only the buyer or an admin can mark settlement' });
      if (order.paymentStatus !== 'ESCROW_SECURED') {
        return res.status(409).json({
          success: false,
          message: 'Payment must be secured in escrow before order can be settled'
        });
      }
      // Simulated settlement; no payment is transferred.
      updateDoc.$set.paymentStatus = 'PAID_TO_FARMER';
      updateDoc.$set['paymentDetails.settledAt'] = now;
    }

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: currentStatus, __v: order.__v ?? 0 },
      updateDoc,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Order changed. Refresh and try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order transitioned to ${nextStatus} successfully`,
      order: updated
    });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'Order changed. Refresh and try again.' });
    next(error);
  }
};

/**
 * @desc    Get order details by ID
 * @route   GET /api/orders/:id
 * @access  Private (Participants & Admin)
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('listing')
      .populate('buyer', 'name phone location isVerified')
      .populate('farmer', 'name phone location isVerified')
      .populate('timeline.updatedBy', 'name role');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = order.buyer._id.toString() === userId;
    const isFarmer = order.farmer._id.toString() === userId;

    if (!isBuyer && !isFarmer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's orders (Purchases for Buyer, Sales for Farmer)
 * @route   GET /api/orders/my-orders
 * @access  Private
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { status, role = 'all' } = req.query;
    const userId = req.user._id;

    // Validate and parse pagination parameters
    let page = 1;
    let limit = 50;

    if (req.query.page !== undefined) {
      const pageStr = String(req.query.page).trim();
      const pageNum = Number(pageStr);
      if (!/^\d+$/.test(pageStr) || !Number.isInteger(pageNum) || pageNum < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid page number. Page must be a positive integer greater than or equal to 1'
        });
      }
      page = pageNum;
    }

    if (req.query.limit !== undefined) {
      const limitStr = String(req.query.limit).trim();
      const limitNum = Number(limitStr);
      if (!/^\d+$/.test(limitStr) || !Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit. Limit must be a positive integer between 1 and 100'
        });
      }
      limit = limitNum;
    }

    const query = {};

    if (req.user.role === 'ADMIN') {
      // Mandi Regulatory Admin monitors all orders across the APMC market
    } else if (role === 'buyer') {
      query.buyer = userId;
    } else if (role === 'farmer') {
      query.farmer = userId;
    } else {
      query.$or = [{ buyer: userId }, { farmer: userId }];
    }

    if (status) {
      query.orderStatus = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .populate('buyer', 'name phone location')
        .populate('farmer', 'name phone location')
        .populate('listing', 'cropName category expectedPrice pricePerUnit location')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
    ]);

    const pages = total > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      pages,
      orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Farmer Digital Ledger (Khata) with financial statistics & earnings
 * @route   GET /api/orders/farmer-ledger
 * @access  Private (FARMER only)
 */
const getFarmerLedger = async (req, res, next) => {
  try {
    const farmerId = req.user._id;
    const farmerObjectId =
      farmerId instanceof mongoose.Types.ObjectId
        ? farmerId
        : mongoose.Types.ObjectId.isValid(farmerId)
        ? new mongoose.Types.ObjectId(farmerId.toString())
        : farmerId;

    const [aggResult, recentOrders] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            farmer: farmerObjectId,
            orderStatus: { $in: ['SETTLED', 'PLACED', 'ESCROW_HELD', 'DISPATCHED', 'DELIVERED'] }
          }
        },
        {
          $project: {
            orderStatus: 1,
            paymentStatus: 1,
            totalAmount: 1,
            volumeKg: {
              $switch: {
                branches: [
                  { case: { $eq: ['$unit', 'QUINTAL'] }, then: { $multiply: ['$quantity', 100] } },
                  { case: { $eq: ['$unit', 'TON'] }, then: { $multiply: ['$quantity', 1000] } }
                ],
                default: '$quantity'
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: {
              $sum: {
                $cond: [{ $eq: ['$orderStatus', 'SETTLED'] }, '$totalAmount', 0]
              }
            },
            settledOrdersCount: {
              $sum: {
                $cond: [{ $eq: ['$orderStatus', 'SETTLED'] }, 1, 0]
              }
            },
            activeOrdersCount: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['PLACED', 'ESCROW_HELD', 'DISPATCHED', 'DELIVERED']] },
                  1,
                  0
                ]
              }
            },
            pendingEscrowAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$orderStatus', ['PLACED', 'ESCROW_HELD', 'DISPATCHED', 'DELIVERED']] },
                      { $eq: ['$paymentStatus', 'ESCROW_SECURED'] }
                    ]
                  },
                  '$totalAmount',
                  0
                ]
              }
            },
            totalVolumeKg: {
              $sum: '$volumeKg'
            }
          }
        }
      ]),
      Order.find({ farmer: farmerId })
        .select('_id orderNumber cropName quantity unit totalAmount buyer orderStatus paymentStatus createdAt')
        .populate('buyer', 'name phone')
        .sort('-createdAt')
        .limit(10)
        .lean()
    ]);

    const stats = (aggResult && aggResult[0]) || {
      totalEarnings: 0,
      settledOrdersCount: 0,
      activeOrdersCount: 0,
      pendingEscrowAmount: 0,
      totalVolumeKg: 0
    };

    const totalEarnings = stats.totalEarnings || 0;
    const settledOrdersCount = stats.settledOrdersCount || 0;
    const activeOrdersCount = stats.activeOrdersCount || 0;
    const pendingEscrowAmount = stats.pendingEscrowAmount || 0;
    const totalVolumeKg = stats.totalVolumeKg || 0;

    // Traditional supply chain cuts ~10% intermediary commission
    const estimatedMiddlemanSavings = Math.round(totalEarnings * 0.1);

    const totalQuintals = Math.round((totalVolumeKg / 100) * 10) / 10;
    const averageRatePerQuintal =
      totalVolumeKg > 0 ? Math.round(totalEarnings / (totalVolumeKg / 100)) : 2525;

    const recentTransactions = (recentOrders || []).map((order) => ({
      orderId: order._id,
      orderNumber: order.orderNumber,
      cropName: order.cropName,
      quantity: `${order.quantity} ${order.unit}`,
      amount: order.totalAmount,
      buyerName: order.buyer ? order.buyer.name : 'Unknown Buyer',
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      date: order.createdAt
    }));

    return res.status(200).json({
      success: true,
      ledger: {
        totalRevenue: Math.round(totalEarnings * 100) / 100,
        totalMiddlemanSaved: estimatedMiddlemanSavings,
        totalTransactions: settledOrdersCount,
        totalQuintals,
        averageRatePerQuintal,
        fairPriceComplianceRate: '100%',
        pendingEscrowAmount: Math.round(pendingEscrowAmount * 100) / 100,
        currency: 'INR'
      },
      ledgerSummary: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingEscrowAmount: Math.round(pendingEscrowAmount * 100) / 100,
        totalVolumeKg,
        settledOrdersCount,
        activeOrdersCount,
        estimatedMiddlemanSavings,
        currency: 'INR'
      },
      recentTransactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate printable digital invoice / receipt slip for an order
 * @route   GET /api/orders/:id/receipt
 * @access  Private (Participants & Admin)
 */
const getOrderReceipt = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name phone location')
      .populate('farmer', 'name phone location');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = order.buyer._id.toString() === userId;
    const isFarmer = order.farmer._id.toString() === userId;

    if (!isBuyer && !isFarmer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view receipt for this order'
      });
    }

    const receipt = {
      receiptNumber: `REC-${order.orderNumber}`,
      issueDate: new Date(),
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentDetails?.paymentMethod || null,
      transactionId: order.paymentDetails?.transactionId || null,
      simulated: true,
      seller: {
        role: 'FARMER',
        name: order.farmer?.name || 'Unknown',
        phone: order.farmer?.phone || '',
        location: `${order.farmer?.location?.village || ''}, ${order.farmer?.location?.district || ''}, ${order.farmer?.location?.state || ''}`.replace(/^, |, $/g, '').trim(),
        fpoAffiliation: order.farmer?.fpoAffiliation || null
      },
      buyer: {
        role: 'BUYER',
        name: order.buyer?.name || 'Unknown',
        phone: order.buyer?.phone || '',
        deliveryAddress: `${order.deliveryAddress?.village || ''}, ${order.deliveryAddress?.district || ''}, ${order.deliveryAddress?.state || ''}`.replace(/^, |, $/g, '').trim()
      },
      items: [
        {
          description: order.cropName,
          quantity: order.quantity,
          unit: order.unit,
          unitRate: order.unitPrice,
          total: order.totalAmount
        }
      ],
      financialBreakdown: {
        subtotal: order.totalAmount,
        intermediaryCommissionFee: 0,
        estimatedIntermediarySaving: Math.round(order.totalAmount * 0.10),
        tax: 0,
        grandTotal: order.totalAmount
      },
      title: 'Demo order receipt',
      declaration: 'Demo only: payment statuses are simulated and do not confirm a transfer.',
      language: req.language || 'en'
    };

    return res.status(200).json({
      success: true,
      receipt
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  updateOrderStatus,
  getOrderById,
  getMyOrders,
  getFarmerLedger,
  getOrderReceipt
};
