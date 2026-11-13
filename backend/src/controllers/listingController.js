const mongoose = require('mongoose');
const ProduceListing = require('../models/ProduceListing');
const Order = require('../models/Order');
const Negotiation = require('../models/Negotiation');
const MandiRate = require('../models/MandiRate');
const {
  calculateDistanceKm,
  fetchCropImageUrl
} = require('../services/externalApiService');

const COMMODITY_KEYWORDS = [
  'ONION',
  'WHEAT',
  'TOMATO',
  'SOYBEAN',
  'SOYABEAN',
  'BENGAL GRAM',
  'BLACK GRAM',
  'GREEN GRAM',
  'CHILLI',
  'CAPSICUM',
  'TURMERIC',
  'LEMON',
  'MAIZE',
  'RICE',
  'PADDY',
  'POTATO',
  'GROUNDNUT',
  'COTTON',
  'CORIANDER',
  'GARLIC'
];

function findMatchingMandiRate(cropName = '', mandiRates = []) {
  const upper = String(cropName).toUpperCase();
  const keyword = COMMODITY_KEYWORDS.find((k) => upper.includes(k));
  if (!keyword) return null;

  // Match exact keyword or Bengal Gram -> Chana / Gram, Soybean <-> Soyabean
  const aliasPattern =
    keyword === 'SOYBEAN' || keyword === 'SOYABEAN'
      ? /(SOYBEAN|SOYABEAN)/i
      : keyword === 'CHILLI'
      ? /(CHILLI|CHILI)/i
      : new RegExp(keyword, 'i');

  return mandiRates.find((r) => aliasPattern.test(r.commodity)) || null;
}

async function enrichListings(listings = [], viewerCoords = null) {
  if (!Array.isArray(listings) || listings.length === 0) return listings;
  if (mongoose.connection.readyState !== 1) return listings;

  let mandiRates = [];
  try {
    mandiRates = await MandiRate.find({})
      .select('commodity district marketCenter modalPrice minPrice maxPrice unit priceDate')
      .sort('-priceDate')
      .limit(100)
      .lean();
  } catch {
    mandiRates = [];
  }

  return Promise.all(
    listings.map(async (rawItem) => {
      const item = typeof rawItem.toObject === 'function' ? rawItem.toObject({ virtuals: true }) : { ...rawItem };
      const matchedRate = findMatchingMandiRate(item.cropName, mandiRates);
      const listingCoords = item.location?.coordinates;
      const distanceKm = calculateDistanceKm(viewerCoords, listingCoords);

      // Preserve the farmer's actual photos, including local /uploads/ URLs.
      // A generic crop image is illustrative and must never be added to images.
      const farmerImage = Array.isArray(item.images)
        ? item.images.find((img) => typeof img === 'string' && (/^https?:\/\//i.test(img) || img.startsWith('/uploads/')))
        : null;
      const resolvedImageUrl = farmerImage || await fetchCropImageUrl(item.cropName);

      return {
        ...item,
        benchmarkRate: matchedRate ? matchedRate.modalPrice : null,
        benchmarkUnit: matchedRate ? matchedRate.unit : null,
        benchmarkMarket: matchedRate ? matchedRate.marketCenter : null,
        benchmarkDate: matchedRate ? matchedRate.priceDate : null,
        distanceKm,
        resolvedImageUrl: resolvedImageUrl || null,
        imageSource: farmerImage ? 'farmer' : resolvedImageUrl ? 'illustrative' : 'none'
      };
    })
  );
}

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

    // Prefer the submitted location, then the farmer's registered location.
    // Never fabricate GPS coordinates or copy the legacy [0, 0] placeholder.
    const sourceLocation = location || req.user.location || {};
    const sourceLocationData =
      typeof sourceLocation.toObject === 'function'
        ? sourceLocation.toObject()
        : sourceLocation;
    const hasPlaceholderCoordinates =
      Array.isArray(sourceLocationData.coordinates) &&
      sourceLocationData.coordinates.length === 2 &&
      sourceLocationData.coordinates[0] === 0 &&
      sourceLocationData.coordinates[1] === 0;

    const listingLocation = {
      ...sourceLocationData,
      type: sourceLocationData.type || 'Point',
      ...(hasPlaceholderCoordinates ? { coordinates: undefined } : {})
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
      viewerLon,
      viewerLat,
      maxDistance = 50000, // default 50km in meters
      page = 1,
      limit = 20,
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

    // Treat search as literal text and match both produce and district.
    if (typeof search === 'string' && search.trim()) {
      const text = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { cropName: { $regex: text, $options: 'i' } },
        { 'location.district': { $regex: text, $options: 'i' } }
      ];
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
    const pageNum = Number(page);
    const limitNum = Number(limit);
    if (!Number.isSafeInteger(pageNum) || pageNum < 1 || !Number.isSafeInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ success: false, message: 'Page must be positive and limit must be between 1 and 100' });
    }
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

    const rawListings = await queryExec;

    const viewerCoords =
      longitude && latitude
        ? [parseFloat(longitude), parseFloat(latitude)]
        : viewerLon && viewerLat
        ? [parseFloat(viewerLon), parseFloat(viewerLat)]
        : req.user?.location?.coordinates || null;

    const listings = await enrichListings(rawListings, viewerCoords);

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

    const [enriched] = await enrichListings([listing], req.user?.location?.coordinates || null);

    return res.status(200).json({
      success: true,
      listing: enriched
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

    // Referential integrity check: active or settled orders
    const activeOrderExists = await Order.exists({
      listing: req.params.id,
      orderStatus: { $in: ['PLACED', 'ESCROW_HELD', 'DISPATCHED', 'DELIVERED', 'SETTLED'] }
    });

    if (activeOrderExists) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete listing with active or settled orders'
      });
    }

    // Referential integrity check: active or unfulfilled accepted negotiations
    const activeNegotiationExists = await Negotiation.exists({
      listing: req.params.id,
      $or: [
        {
          status: { $in: ['OPEN', 'COUNTER_OFFERED'] },
          expiresAt: { $gt: new Date() },
          order: null
        },
        {
          status: 'ACCEPTED',
          order: null
        }
      ]
    });

    if (activeNegotiationExists) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete listing with active negotiations'
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
  enrichListings,
  createListing,
  getAllListings,
  getListingById,
  getMyListings,
  updateListing,
  deleteListing
};
