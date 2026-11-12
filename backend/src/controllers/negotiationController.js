const Negotiation = require('../models/Negotiation');
const ProduceListing = require('../models/ProduceListing');

// Broadcast only after a successful database write. Personal rooms notify users
// about new offers even when they have not opened a negotiation room yet.
const notify = (req, negotiation, event, payload) => {
  const io = req.app.get('io');
  if (!io) return;
  const buyerId = negotiation.buyer._id || negotiation.buyer;
  const farmerId = negotiation.farmer._id || negotiation.farmer;
  io.of('/negotiation')
    .to(`user_${buyerId}`)
    .to(`user_${farmerId}`)
    .to(`room_${negotiation._id}`)
    .emit(event, payload);
};
const active = ['OPEN', 'COUNTER_OFFERED'];
const revision = (negotiation) => ({ _id: negotiation._id, __v: negotiation.__v ?? 0, status: { $in: active } });

/**
 * @desc    Start a new price negotiation / bid on a produce listing
 * @route   POST /api/negotiations
 * @access  Private (BUYER_RETAIL, BUYER_WHOLESALE)
 */
const startNegotiation = async (req, res, next) => {
  try {
    const { listingId, offeredPrice, quantity, note } = req.body;

    if (!['BUYER_RETAIL', 'BUYER_WHOLESALE'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only buyers can submit offers' });
    }

    if (!listingId || !Number.isFinite(Number(offeredPrice)) || Number(offeredPrice) < 0.1 || !Number.isFinite(Number(quantity)) || Number(quantity) < 1) {
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

    if (Number(quantity) > listing.quantity) {
      return res.status(400).json({ success: false, message: 'Requested quantity exceeds available produce' });
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

    const now = new Date();
    // Expire stale sessions for this listing and buyer before checking for existing active negotiation
    // Records with null or missing expiresAt must NOT be expired
    await Negotiation.updateMany(
      {
        listing: listingId,
        buyer: req.user._id,
        status: { $in: ['OPEN', 'COUNTER_OFFERED'] },
        expiresAt: { $exists: true, $ne: null, $lte: now }
      },
      {
        $set: { status: 'EXPIRED' }
      }
    );

    // Check if buyer already has an active negotiation on this listing
    const existingNeg = await Negotiation.findOne({
      listing: listingId,
      buyer: req.user._id,
      status: { $in: ['OPEN', 'COUNTER_OFFERED'] }
    });

    if (existingNeg) {
      return res.status(409).json({
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
      timestamp: now
    };

    let negotiation;
    try {
      negotiation = await Negotiation.create({
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
    } catch (createErr) {
      if (createErr.code === 11000 || (createErr.message && createErr.message.includes('E11000'))) {
        return res.status(409).json({
          success: false,
          message: 'An active negotiation already exists for this listing and buyer.'
        });
      }
      throw createErr;
    }

    notify(req, negotiation, 'negotiation_created', { negotiationId: String(negotiation._id) });

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

    if (!Number.isFinite(Number(counterPrice)) || Number(counterPrice) < 0.1) {
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

    const userId = req.user._id.toString();
    const isBuyer = (negotiation.buyer._id || negotiation.buyer).toString() === userId;
    const isFarmer = (negotiation.farmer._id || negotiation.farmer).toString() === userId;

    if (!isBuyer && !isFarmer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to participate in this negotiation session'
      });
    }

    // Verify session is active
    if (!['OPEN', 'COUNTER_OFFERED'].includes(negotiation.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot counter-offer. Negotiation is already ${negotiation.status}`
      });
    }

    // Check expiry only after participant authorization
    const now = new Date();
    if (negotiation.expiresAt && new Date(negotiation.expiresAt) <= now) {
      await Negotiation.findOneAndUpdate(
        { ...revision(negotiation) },
        { $set: { status: 'EXPIRED' }, $inc: { __v: 1 } }
      );
      return res.status(409).json({ success: false, message: 'Negotiation has expired' });
    }

    const role = isBuyer ? 'BUYER' : 'FARMER';
    const nextTurn = isBuyer ? 'FARMER' : 'BUYER';
    if (negotiation.currentTurn !== role) return res.status(409).json({ success: false, message: 'Please wait for the other participant to respond' });

    const newBid = {
      bidder: req.user._id,
      bidderRole: role,
      pricePerUnit: Number(counterPrice),
      note: note || `Counter-offer of ₹${counterPrice}`,
      timestamp: now
    };

    const updateFilter = {
      ...revision(negotiation),
      currentTurn: role,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }, { expiresAt: { $exists: false } }]
    };

    const updated = await Negotiation.findOneAndUpdate(
      updateFilter,
      { $set: { currentOfferedPrice: Number(counterPrice), currentTurn: nextTurn, status: 'COUNTER_OFFERED' }, $push: { bidHistory: newBid }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      const latest = await Negotiation.findById(req.params.id);
      if (latest && latest.expiresAt && new Date(latest.expiresAt) <= now && active.includes(latest.status)) {
        await Negotiation.findOneAndUpdate(
          { ...revision(latest) },
          { $set: { status: 'EXPIRED' }, $inc: { __v: 1 } }
        );
        return res.status(409).json({ success: false, message: 'Negotiation has expired' });
      }
      return res.status(409).json({ success: false, message: 'The offer changed. Refresh and try again.' });
    }
    notify(req, updated, 'counter_offer_received', { success: true, negotiationId: String(updated._id), latestBid: newBid, currentOfferedPrice: updated.currentOfferedPrice, currentTurn: updated.currentTurn, status: updated.status, bidHistory: updated.bidHistory });

    return res.status(200).json({
      success: true,
      message: 'Counter-offer submitted successfully',
      negotiation: updated
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

    const userId = req.user._id.toString();
    const isBuyer = (negotiation.buyer._id || negotiation.buyer).toString() === userId;
    const isFarmer = (negotiation.farmer._id || negotiation.farmer).toString() === userId;

    if (!isBuyer && !isFarmer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this deal'
      });
    }

    if (!['OPEN', 'COUNTER_OFFERED'].includes(negotiation.status)) {
      return res.status(400).json({
        success: false,
        message: `Negotiation is already ${negotiation.status}`
      });
    }

    // Check expiry only after participant authorization
    const now = new Date();
    if (negotiation.expiresAt && new Date(negotiation.expiresAt) <= now) {
      await Negotiation.findOneAndUpdate(
        { ...revision(negotiation) },
        { $set: { status: 'EXPIRED' }, $inc: { __v: 1 } }
      );
      return res.status(409).json({ success: false, message: 'Negotiation has expired' });
    }

    const role = isBuyer ? 'BUYER' : 'FARMER';
    if (negotiation.currentTurn !== role) return res.status(409).json({ success: false, message: 'Only the participant whose turn it is may accept' });

    const agreedPrice = negotiation.currentOfferedPrice;
    if (!Number.isFinite(Number(req.body?.expectedPrice)) || Number(req.body.expectedPrice) !== agreedPrice) {
      return res.status(409).json({ success: false, message: 'The price has changed. Refresh the negotiation before accepting.' });
    }
    const agreedTotalAmount = Math.round(agreedPrice * negotiation.quantity * 100) / 100;

    const updateFilter = {
      ...revision(negotiation),
      currentTurn: role,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }, { expiresAt: { $exists: false } }]
    };

    const updated = await Negotiation.findOneAndUpdate(
      updateFilter,
      { $set: { status: 'ACCEPTED', agreedPrice, agreedTotalAmount }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      const latest = await Negotiation.findById(req.params.id);
      if (latest && latest.expiresAt && new Date(latest.expiresAt) <= now && active.includes(latest.status)) {
        await Negotiation.findOneAndUpdate(
          { ...revision(latest) },
          { $set: { status: 'EXPIRED' }, $inc: { __v: 1 } }
        );
        return res.status(409).json({ success: false, message: 'Negotiation has expired' });
      }
      return res.status(409).json({ success: false, message: 'The offer changed. Refresh and try again.' });
    }
    const dealSummary = {
      negotiationId: String(negotiation._id), crop: negotiation.listing?.cropName || 'Produce',
      unit: negotiation.listing?.unit, quantity: negotiation.quantity, agreedPricePerUnit: agreedPrice,
      agreedTotalAmount, farmer: negotiation.farmer?.name, buyer: negotiation.buyer?.name, status: 'ACCEPTED'
    };
    notify(req, updated, 'deal_locked', { success: true, dealSummary });

    return res.status(200).json({
      success: true,
      message: 'Deal locked and accepted! Proceeding to order creation.',
      dealSummary
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
    const isBuyer = (negotiation.buyer._id || negotiation.buyer).toString() === userId;
    const isFarmer = (negotiation.farmer._id || negotiation.farmer).toString() === userId;

    if (!isBuyer && !isFarmer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this deal'
      });
    }

    if (!active.includes(negotiation.status)) return res.status(409).json({ success: false, message: `Negotiation is already ${negotiation.status}` });
    const updated = await Negotiation.findOneAndUpdate(
      revision(negotiation),
      { $set: { status: 'REJECTED' }, $push: { bidHistory: { bidder: req.user._id, bidderRole: isBuyer ? 'BUYER' : 'FARMER', pricePerUnit: negotiation.currentOfferedPrice, note: reason ? `Rejected: ${reason}` : 'Negotiation closed without agreement', timestamp: new Date() } }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ success: false, message: 'The offer changed. Refresh and try again.' });
    notify(req, updated, 'deal_rejected', { success: true, negotiationId: String(updated._id), reason: reason || 'Offer not accepted' });

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
    const isBuyer = (negotiation.buyer._id || negotiation.buyer).toString() === userId;
    const isFarmer = (negotiation.farmer._id || negotiation.farmer).toString() === userId;

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

/**
 * @desc    Send a free-text or voice-transcribed chat message inside negotiation (does not consume price turn)
 * @route   POST /api/negotiations/:id/message
 * @access  Private (Participants only)
 */
const sendNegotiationMessage = async (req, res, next) => {
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const isVoice = Boolean(req.body?.isVoice);

    if (!rawText || rawText.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Message text must be between 1 and 500 characters'
      });
    }

    const negotiation = await Negotiation.findById(req.params.id);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation session not found'
      });
    }

    const userId = req.user._id.toString();
    const isBuyer = (negotiation.buyer._id || negotiation.buyer).toString() === userId;
    const isFarmer = (negotiation.farmer._id || negotiation.farmer).toString() === userId;

    if (!isBuyer && !isFarmer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to message in this negotiation'
      });
    }

    if (['REJECTED', 'EXPIRED'].includes(negotiation.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot send messages after negotiation is ${negotiation.status}`
      });
    }

    const chatMsg = {
      sender: req.user._id,
      senderRole: isBuyer ? 'BUYER' : 'FARMER',
      senderName: req.user.name || (isBuyer ? 'Buyer' : 'Farmer'),
      text: rawText,
      isVoice,
      timestamp: new Date()
    };

    const updated = await Negotiation.findOneAndUpdate(
      { _id: negotiation._id, status: { $in: ['OPEN', 'COUNTER_OFFERED', 'ACCEPTED'] } },
      { $push: { messages: chatMsg } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Negotiation is no longer open for messages'
      });
    }

    notify(req, updated, 'chat_message_received', {
      success: true,
      negotiationId: String(updated._id),
      message: chatMsg,
      messages: updated.messages
    });

    return res.status(200).json({
      success: true,
      chatMessage: chatMsg,
      messages: updated.messages
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
  sendNegotiationMessage,
  getMyNegotiations,
  getNegotiationById
};
