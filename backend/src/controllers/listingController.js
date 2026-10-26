const ProduceListing = require('../models/ProduceListing');

/**
 * @desc    Create a new produce listing
 * @route   POST /api/listings
 * @access  Private (FARMER only)
 */
const createListing = async (req, res, next) => {
  try {
    const {
      cropName,
      category,
      quantity,
      unit,
      pricePerUnit,
      qualityGrade,
      harvestDate,
      description,
      images,
      location
    } = req.body;

    // Use listing location if provided, otherwise default to farmer's registered location
    const listingLocation = location || req.user.location || {
      type: 'Point',
      coordinates: [0, 0]
    };

    const listing = await ProduceListing.create({
      farmer: req.user._id,
      cropName,
      category,
      quantity,
      unit: unit || 'KG',
      pricePerUnit,
      qualityGrade: qualityGrade || 'GRADE_A',
      harvestDate: harvestDate || Date.now(),
      description,
      images: images || [],
      location: listingLocation
    });

    return res.status(201).json({
      success: true,
      message: 'Produce listed successfully',
      listing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all produce listings with optional filters and geospatial radius search
 * @route   GET /api/listings
 * @access  Public
 */
const getAllListings = async (req, res, next) => {
  try {
    const {
      category,
      search,
      qualityGrade,
      minPrice,
      maxPrice,
      status,
      longitude,
      latitude,
      maxDistance = 50000, // default 50km in meters
      page = 1,
      limit = 10,
      sortBy = '-createdAt'
    } = req.query;

    const query = {};

    // Filter by status (default: AVAILABLE)
    query.status = status || 'AVAILABLE';

    // Category filter
    if (category) {
      query.category = category.toUpperCase();
    }

    // Quality grade filter
    if (qualityGrade) {
      query.qualityGrade = qualityGrade.toUpperCase();
    }

    // Search by crop name (case-insensitive regex)
    if (search) {
      query.cropName = { $regex: search, $options: 'i' };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.pricePerUnit = {};
      if (minPrice) query.pricePerUnit.$gte = Number(minPrice);
      if (maxPrice) query.pricePerUnit.$lte = Number(maxPrice);
    }

    // Geospatial filter (proximity search if coordinates are given)
    if (longitude && latitude && !(Number(longitude) === 0 && Number(latitude) === 0)) {
      query['location.coordinates'] = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      };
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await ProduceListing.countDocuments(query);

    let queryExec = ProduceListing.find(query)
      .populate('farmer', 'name phone isVerified location')
      .skip(skip)
      .limit(limitNum);

    // If not using geo-search, apply regular sorting
    if (!longitude || !latitude) {
      queryExec = queryExec.sort(sortBy);
    }

    const listings = await queryExec;

    return res.status(200).json({
      success: true,
      count: listings.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      listings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single produce listing by ID
 * @route   GET /api/listings/:id
 * @access  Public
 */
const getListingById = async (req, res, next) => {
  try {
    const listing = await ProduceListing.findById(req.params.id).populate(
      'farmer',
      'name phone isVerified location languagePreference'
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Produce listing not found'
      });
    }

    return res.status(200).json({
      success: true,
      listing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get listings created by the logged-in farmer
 * @route   GET /api/listings/my-listings
 * @access  Private (FARMER only)
 */
const getMyListings = async (req, res, next) => {
  try {
    const listings = await ProduceListing.find({ farmer: req.user._id }).sort(
      '-createdAt'
    );

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a produce listing (Only owner farmer or ADMIN)
 * @route   PUT /api/listings/:id
 * @access  Private (FARMER or ADMIN)
 */
const updateListing = async (req, res, next) => {
  try {
    let listing = await ProduceListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Produce listing not found'
      });
    }

    // Authorization check: Make sure user is the owner farmer or an ADMIN
    if (
      listing.farmer.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this listing'
      });
    }

    // Allowable update fields
    const updates = {};
    const allowedFields = [
      'cropName',
      'category',
      'quantity',
      'unit',
      'pricePerUnit',
      'qualityGrade',
      'harvestDate',
      'description',
      'images',
      'location',
      'status'
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    listing = await ProduceListing.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).populate('farmer', 'name phone isVerified location');

    return res.status(200).json({
      success: true,
      message: 'Produce listing updated successfully',
      listing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete / Cancel a produce listing
 * @route   DELETE /api/listings/:id
 * @access  Private (FARMER or ADMIN)
 */
const deleteListing = async (req, res, next) => {
  try {
    const listing = await ProduceListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Produce listing not found'
      });
    }

    // Authorization check
    if (
      listing.farmer.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this listing'
      });
    }

    await ProduceListing.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Produce listing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createListing,
  getAllListings,
  getListingById,
  getMyListings,
  updateListing,
  deleteListing
};
