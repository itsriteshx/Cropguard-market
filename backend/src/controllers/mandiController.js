const MandiRate = require('../models/MandiRate');

/**
 * @desc    Get APMC Mandi rates with filters (commodity, state, district, category)
 * @route   GET /api/mandi-rates
 * @access  Public
 */
const getMandiRates = async (req, res, next) => {
  try {
    const {
      commodity,
      state,
      district,
      category,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (commodity) {
      query.commodity = { $regex: commodity.trim(), $options: 'i' };
    }
    if (state) {
      query.state = state.trim().toUpperCase();
    }
    if (district) {
      query.district = district.trim().toUpperCase();
    }
    if (category) {
      query.category = category.trim().toUpperCase();
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await MandiRate.countDocuments(query);
    const rates = await MandiRate.find(query)
      .sort('-priceDate')
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: rates.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      rates
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get fair price benchmark and anti-exploitation corridor for a specific crop
 * @route   GET /api/mandi-rates/benchmark
 * @access  Public
 */
const getBenchmarkForCrop = async (req, res, next) => {
  try {
    const { commodity, district, state } = req.query;

    if (!commodity) {
      return res.status(400).json({
        success: false,
        message: 'Please specify a commodity name to get benchmark rate'
      });
    }

    const query = {
      commodity: { $regex: commodity.trim(), $options: 'i' }
    };

    if (district) {
      query.district = district.trim().toUpperCase();
    } else if (state) {
      query.state = state.trim().toUpperCase();
    }

    // Try finding exact district match, fallback to nearest state match or any match
    let benchmark = await MandiRate.findOne(query).sort('-priceDate');

    if (!benchmark && district) {
      // Fallback: search without district constraint
      benchmark = await MandiRate.findOne({
        commodity: { $regex: commodity.trim(), $options: 'i' }
      }).sort('-priceDate');
    }

    if (!benchmark) {
      return res.status(404).json({
        success: false,
        message: `No APMC benchmark found for ${commodity}. Please check commodity name.`
      });
    }

    // 1 Quintal = 100 Kilograms
    const modalPerKg = Math.round((benchmark.modalPrice / 100) * 10) / 10;
    const minPerKg = Math.round((benchmark.minPrice / 100) * 10) / 10;
    const maxPerKg = Math.round((benchmark.maxPrice / 100) * 10) / 10;

    return res.status(200).json({
      success: true,
      commodity: benchmark.commodity,
      marketCenter: benchmark.marketCenter,
      district: benchmark.district,
      state: benchmark.state,
      apmcRates: {
        modalPricePerQuintal: benchmark.modalPrice,
        minPricePerQuintal: benchmark.minPrice,
        maxPricePerQuintal: benchmark.maxPrice,
        unit: benchmark.unit,
        priceDate: benchmark.priceDate
      },
      farmerPriceGuidance: {
        modalRatePerKg: modalPerKg,
        minimumAcceptablePerKg: minPerKg,
        maximumMarketPerKg: maxPerKg,
        recommendedAskingPrice: modalPerKg,
        antiExploitationNotice: `Market average in ${benchmark.district} is ₹${modalPerKg}/kg. Do not accept buyer offers below ₹${minPerKg}/kg.`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get aggregated mandi market analytics & volume distribution using MongoDB Aggregation
 * @route   GET /api/mandi-rates/analytics
 * @access  Public
 */
const getMandiAnalytics = async (req, res, next) => {
  try {
    // Pipeline 1: Commodity price trends & spreads
    const commodityTrends = await MandiRate.aggregate([
      {
        $group: {
          _id: '$commodity',
          avgModalPrice: { $avg: '$modalPrice' },
          minObserved: { $min: '$minPrice' },
          maxObserved: { $max: '$maxPrice' },
          totalArrivals: { $sum: '$arrivalQuantity' },
          marketsCount: { $sum: 1 },
          category: { $first: '$category' }
        }
      },
      {
        $project: {
          commodity: '$_id',
          category: 1,
          avgModalPrice: { $round: ['$avgModalPrice', 0] },
          minObserved: 1,
          maxObserved: 1,
          priceSpread: { $subtract: ['$maxObserved', '$minObserved'] },
          totalArrivals: 1,
          marketsCount: 1
        }
      },
      { $sort: { totalArrivals: -1 } }
    ]);

    // Pipeline 2: District-wise arrival volume
    const districtArrivals = await MandiRate.aggregate([
      {
        $group: {
          _id: '$district',
          totalArrivals: { $sum: '$arrivalQuantity' },
          commoditiesTracked: { $addToSet: '$commodity' },
          mandiCount: { $sum: 1 }
        }
      },
      {
        $project: {
          district: '$_id',
          totalArrivals: 1,
          commoditiesCount: { $size: '$commoditiesTracked' },
          mandiCount: 1
        }
      },
      { $sort: { totalArrivals: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      corridor: 'UASD Dharwad - North Karnataka & Maharashtra Corridor',
      commodityTrends,
      districtArrivals
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMandiRates,
  getBenchmarkForCrop,
  getMandiAnalytics
};
