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

module.exports = {
  createOrder,
  updateOrderStatus,
  getOrderById,
  getMyOrders
};
