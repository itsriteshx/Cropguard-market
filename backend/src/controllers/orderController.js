const Order = require('../models/Order');
const Negotiation = require('../models/Negotiation');
const ProduceListing = require('../models/ProduceListing');

// Generate human-readable order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CGM-${timestamp}-${random}`;
};

/**
 * @desc    Create a new order from an agreed negotiation
 * @route   POST /api/orders
 * @access  Private (BUYER or FARMER participant)
 */
const createOrder = async (req, res, next) => {
  try {
    const { negotiationId, deliveryAddress, paymentMethod } = req.body;

    if (!negotiationId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an agreed negotiationId to create an order'
      });
    }

    const negotiation = await Negotiation.findById(negotiationId).populate('listing');
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation not found'
      });
    }

    // Must be in ACCEPTED state
    if (negotiation.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        message: `Cannot create order. Negotiation status is ${negotiation.status}, not ACCEPTED.`
      });
    }

    // Check if order already exists for this negotiation
    const existingOrder = await Order.findOne({ negotiation: negotiationId });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'An order has already been created for this negotiation',
        orderId: existingOrder._id,
        orderNumber: existingOrder.orderNumber
      });
    }

    const listing = negotiation.listing;
    const quantity = negotiation.quantity;
    const unitPrice = negotiation.agreedPrice || negotiation.currentOfferedPrice;
    const totalAmount = negotiation.agreedTotalAmount || Math.round(unitPrice * quantity * 100) / 100;

    const orderNumber = generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      negotiation: negotiation._id,
      listing: listing._id,
      buyer: negotiation.buyer,
      farmer: negotiation.farmer,
      cropName: listing.cropName,
      quantity,
      unit: listing.unit,
      unitPrice,
      totalAmount,
      orderStatus: 'PLACED',
      paymentStatus: 'PENDING',
      paymentDetails: {
        paymentMethod: paymentMethod || 'UPI'
      },
      deliveryAddress: deliveryAddress || {
        village: req.user.location?.village || '',
        district: req.user.location?.district || '',
        state: req.user.location?.state || '',
        pincode: req.user.location?.pincode || '',
        contactPhone: req.user.phone
      },
      timeline: [
        {
          status: 'PLACED',
          note: `Order ${orderNumber} created from agreed negotiation at ₹${unitPrice}/${listing.unit}`,
          timestamp: new Date(),
          updatedBy: req.user._id
        }
      ]
    });

    // Update listing inventory
    const newQty = Math.max(0, listing.quantity - quantity);
    listing.quantity = newQty;
    if (newQty === 0) {
      listing.status = 'SOLD';
    }
    await listing.save();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully from negotiated deal',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Transition order state (State Machine Engine)
 * @route   PUT /api/orders/:id/status
 * @access  Private (Buyer, Farmer, Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { nextStatus, note, transactionId } = req.body;

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

    // Role-specific transition rules
    if (nextStatus === 'ESCROW_HELD') {
      if (!isBuyer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the buyer can make escrow payment'
        });
      }
      order.paymentStatus = 'ESCROW_SECURED';
      order.paymentDetails.escrowSecuredAt = new Date();
      if (transactionId) {
        order.paymentDetails.transactionId = transactionId;
      }
    } else if (nextStatus === 'DISPATCHED') {
      if (!isFarmer && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the farmer can dispatch produce'
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
      // Platform automated release or Admin settlement
      order.paymentStatus = 'PAID_TO_FARMER';
      order.paymentDetails.settledAt = new Date();
    } else if (nextStatus === 'CANCELLED') {
      order.paymentStatus = order.paymentStatus === 'ESCROW_SECURED' ? 'REFUNDED' : 'PENDING';
    }

    order.orderStatus = nextStatus;
    order.timeline.push({
      status: nextStatus,
      note: note || `Order transitioned from ${currentStatus} to ${nextStatus}`,
      timestamp: new Date(),
      updatedBy: req.user._id
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order transitioned to ${nextStatus} successfully`,
      order
    });
  } catch (error) {
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

    const query = {};

    if (role === 'buyer') {
      query.buyer = userId;
    } else if (role === 'farmer') {
      query.farmer = userId;
    } else {
      query.$or = [{ buyer: userId }, { farmer: userId }];
    }

    if (status) {
      query.orderStatus = status.toUpperCase();
    }

    const orders = await Order.find(query)
      .populate('buyer', 'name phone')
      .populate('farmer', 'name phone')
      .sort('-createdAt');

    return res.status(200).json({
      success: true,
      count: orders.length,
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

    // Fetch all orders for this farmer
    const orders = await Order.find({ farmer: farmerId })
      .populate('buyer', 'name phone')
      .sort('-createdAt');

    let totalEarnings = 0;
    let pendingEscrowAmount = 0;
    let totalVolumeKg = 0;
    let settledOrdersCount = 0;
    let activeOrdersCount = 0;

    orders.forEach((order) => {
      // Calculate volumes (normalize Quintal to Kg for metrics: 1 Quintal = 100 Kg)
      const volumeInKg = order.unit === 'QUINTAL' ? order.quantity * 100 : order.quantity;

      if (order.orderStatus === 'SETTLED') {
        totalEarnings += order.totalAmount;
        settledOrdersCount += 1;
        totalVolumeKg += volumeInKg;
      } else if (['PLACED', 'ESCROW_HELD', 'DISPATCHED', 'DELIVERED'].includes(order.orderStatus)) {
        if (order.paymentStatus === 'ESCROW_SECURED') {
          pendingEscrowAmount += order.totalAmount;
        }
        activeOrdersCount += 1;
        totalVolumeKg += volumeInKg;
      }
    });

    // Traditional supply chain cuts ~10% intermediary commission
    const estimatedMiddlemanSavings = Math.round(totalEarnings * 0.1);

    const recentTransactions = orders.slice(0, 10).map((order) => ({
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
      paymentMethod: order.paymentDetails?.paymentMethod || 'UPI',
      seller: {
        role: 'FARMER',
        name: order.farmer.name,
        phone: order.farmer.phone,
        location: `${order.farmer.location?.village || ''}, ${order.farmer.location?.district || ''}, ${order.farmer.location?.state || ''}`
      },
      buyer: {
        role: 'BUYER',
        name: order.buyer.name,
        phone: order.buyer.phone,
        deliveryAddress: `${order.deliveryAddress?.village || ''}, ${order.deliveryAddress?.district || ''}, ${order.deliveryAddress?.state || ''}`
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
        tax: 0,
        grandTotal: order.totalAmount
      },
      declaration: 'Certified 100% direct farmer-to-buyer transaction under Ministry of Agriculture & UASD Dharwad Direct Market Access guidelines.'
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
