const Negotiation = require('../models/Negotiation');
const ProduceListing = require('../models/ProduceListing');

/**
 * @desc    Start a new price negotiation / bid on a produce listing
 * @route   POST /api/negotiations
 * @access  Private (BUYER_RETAIL, BUYER_WHOLESALE)
 */
const startNegotiation = async (req, res, next) => {
  try {
    const { listingId, offeredPrice, quantity, note } = req.body;

    if (!listingId || !offeredPrice || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide listing ID, offered price per unit, and quantity'
      });
    }

    const listing = await ProduceListing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Produce listing not found'
      });
    }

    // Farmer cannot bid on their own produce
    if (listing.farmer.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Farmers cannot start negotiations on their own produce'
      });
    }

    // Check if produce is still available
    if (listing.status === 'SOLD' || listing.status === 'EXPIRED') {
      return res.status(400).json({
        success: false,
        message: 'This produce listing is no longer available for bidding'
      });
    }

    // Check if buyer already has an active negotiation on this listing
    let existingNeg = await Negotiation.findOne({
      listing: listingId,
      buyer: req.user._id,
      status: { $in: ['OPEN', 'COUNTER_OFFERED'] }
    });

    if (existingNeg) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active negotiation on this produce. Please submit a counter-offer.',
        negotiationId: existingNeg._id
      });
    }

    const initialBid = {
      bidder: req.user._id,
      bidderRole: 'BUYER',
      pricePerUnit: Number(offeredPrice),
      note: note || `Initial purchase offer of ₹${offeredPrice}/${listing.unit}`,
      timestamp: new Date()
    };

    const negotiation = await Negotiation.create({
      listing: listingId,
      buyer: req.user._id,
      farmer: listing.farmer,
      quantity: Number(quantity),
      originalListingPrice: listing.pricePerUnit,
      currentOfferedPrice: Number(offeredPrice),
      currentTurn: 'FARMER',
      status: 'OPEN',
      bidHistory: [initialBid]
    });

    // Update listing status to UNDER_NEGOTIATION if currently AVAILABLE
    if (listing.status === 'AVAILABLE') {
      listing.status = 'UNDER_NEGOTIATION';
      await listing.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Negotiation offer submitted successfully to farmer',
      negotiation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit a counter-offer (Buyer or Farmer)
 * @route   POST /api/negotiations/:id/counter
 * @access  Private (Participants only)
 */
const counterOffer = async (req, res, next) => {
  try {
    const { counterPrice, note } = req.body;

    if (!counterPrice) {
      return res.status(400).json({
        success: false,
        message: 'Please provide counter price per unit'
      });
    }

    const negotiation = await Negotiation.findById(req.params.id);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation session not found'
      });
    }

    // Verify session is active
    if (!['OPEN', 'COUNTER_OFFERED'].includes(negotiation.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot counter-offer. Negotiation is already ${negotiation.status}`
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = negotiation.buyer.toString() === userId;
    const isFarmer = negotiation.farmer.toString() === userId;

    if (!isBuyer && !isFarmer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to participate in this negotiation session'
      });
    }

    const role = isBuyer ? 'BUYER' : 'FARMER';
    const nextTurn = isBuyer ? 'FARMER' : 'BUYER';

    const newBid = {
      bidder: req.user._id,
      bidderRole: role,
      pricePerUnit: Number(counterPrice),
      note: note || `Counter-offer of ₹${counterPrice}`,
      timestamp: new Date()
    };

    negotiation.currentOfferedPrice = Number(counterPrice);
    negotiation.currentTurn = nextTurn;
    negotiation.status = 'COUNTER_OFFERED';
    negotiation.bidHistory.push(newBid);

    await negotiation.save();

    return res.status(200).json({
      success: true,
      message: 'Counter-offer submitted successfully',
      negotiation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept agreed deal price and lock digital agreement
 * @route   POST /api/negotiations/:id/accept
 * @access  Private (Participants only)
 */
const acceptDeal = async (req, res, next) => {
  try {
    const negotiation = await Negotiation.findById(req.params.id)
      .populate('listing')
      .populate('buyer', 'name phone')
      .populate('farmer', 'name phone');

    if (!negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation session not found'
      });
    }

    if (!['OPEN', 'COUNTER_OFFERED'].includes(negotiation.status)) {
      return res.status(400).json({
        success: false,
        message: `Negotiation is already ${negotiation.status}`
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = negotiation.buyer._id.toString() === userId;
    const isFarmer = negotiation.farmer._id.toString() === userId;

    if (!isBuyer && !isFarmer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this deal'
      });
    }

    const agreedPrice = negotiation.currentOfferedPrice;
    const agreedTotalAmount = Math.round(agreedPrice * negotiation.quantity * 100) / 100;

    negotiation.status = 'ACCEPTED';
    negotiation.agreedPrice = agreedPrice;
    negotiation.agreedTotalAmount = agreedTotalAmount;

    await negotiation.save();

    return res.status(200).json({
      success: true,
      message: 'Deal locked and accepted! Proceeding to order creation.',
      dealSummary: {
        negotiationId: negotiation._id,
        crop: negotiation.listing.cropName,
        quantity: negotiation.quantity,
        agreedPricePerUnit: agreedPrice,
        agreedTotalAmount,
        farmer: negotiation.farmer.name,
        buyer: negotiation.buyer.name,
        status: 'ACCEPTED'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject / Close negotiation
 * @route   POST /api/negotiations/:id/reject
 * @access  Private (Participants only)
 */
const rejectDeal = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const negotiation = await Negotiation.findById(req.params.id);

    if (!negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation session not found'
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = negotiation.buyer.toString() === userId;
    const isFarmer = negotiation.farmer.toString() === userId;

    if (!isBuyer && !isFarmer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this deal'
      });
    }

    negotiation.status = 'REJECTED';
    negotiation.bidHistory.push({
      bidder: req.user._id,
      bidderRole: isBuyer ? 'BUYER' : 'FARMER',
      pricePerUnit: negotiation.currentOfferedPrice,
      note: reason ? `Rejected: ${reason}` : 'Negotiation closed without agreement',
      timestamp: new Date()
    });

    await negotiation.save();

    return res.status(200).json({
      success: true,
      message: 'Negotiation rejected and closed'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active/past negotiations for current user
 * @route   GET /api/negotiations/my
 * @access  Private
 */
const getMyNegotiations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const negotiations = await Negotiation.find({
      $or: [{ buyer: userId }, { farmer: userId }]
    })
      .populate('listing', 'cropName category unit pricePerUnit location')
      .populate('buyer', 'name phone isVerified')
      .populate('farmer', 'name phone isVerified')
      .sort('-updatedAt');

    return res.status(200).json({
      success: true,
      count: negotiations.length,
      negotiations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single negotiation room details
 * @route   GET /api/negotiations/:id
 * @access  Private (Participants only)
 */
const getNegotiationById = async (req, res, next) => {
  try {
    const negotiation = await Negotiation.findById(req.params.id)
      .populate('listing')
      .populate('buyer', 'name phone isVerified location')
      .populate('farmer', 'name phone isVerified location')
      .populate('bidHistory.bidder', 'name role');

    if (!negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation session not found'
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = negotiation.buyer._id.toString() === userId;
    const isFarmer = negotiation.farmer._id.toString() === userId;

    if (!isBuyer && !isFarmer && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this negotiation'
      });
    }

    return res.status(200).json({
      success: true,
      negotiation
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startNegotiation,
  counterOffer,
  acceptDeal,
  rejectDeal,
  getMyNegotiations,
  getNegotiationById
};
