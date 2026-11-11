const mongoose = require('mongoose');
const MandiRate = require('../models/MandiRate');
const {
  fetchAgmarknetMandiRates,
  syncAgmarknetRatesToDb,
  upsertRecordsToDb,
  attachCropImagesToRates,
  fetchDistrictWeather,
  fetchPincodeInfo
} = require('../services/externalApiService');

const buildAnalyticsMatch = (query) => {
  const match = {};

  // Validate and normalize text filters.
  const textFilters = ['commodity', 'state', 'district', 'category'];

  for (const field of textFilters) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== 'string' || !query[field].trim()) {
        return { error: `Invalid ${field} filter` };
      }

      match[field] = query[field].trim().toUpperCase();
    }
  }

  // Validate date-only values (YYYY-MM-DD).
  const parseDate = (value, field) => {
    if (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { error: `Invalid ${field} date. Use YYYY-MM-DD.` };
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value) {
      return { error: `Invalid ${field} calendar date.` };
    }

    return { date };
  };

  let fromDate;
  let toDate;

  if (query.from !== undefined) {
    const result = parseDate(query.from, 'from');
    if (result.error) return result;
    fromDate = result.date;
  }

  if (query.to !== undefined) {
    const result = parseDate(query.to, 'to');
    if (result.error) return result;
    toDate = result.date;
  }

  if (fromDate && toDate && fromDate > toDate) {
    return { error: '`from` date cannot be after `to` date.' };
  }

  // Use an inclusive date range.
  if (fromDate || toDate) {
    match.priceDate = {};

    if (fromDate) {
      match.priceDate.$gte = fromDate;
    }

    if (toDate) {
      const nextDay = new Date(toDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      match.priceDate.$lt = nextDay;
    }
  }

  return { match };
};


/**
 * Best-effort background/inline sync with Data.gov.in Agmarknet API.
 * Never swallows errors silently without logging, and never returns fake data.
 */
async function ensureLiveRatesSynced({ state = 'ALL', force = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return { synced: false, reason: 'db_disconnected' };
  }
  try {
    return await syncAgmarknetRatesToDb(MandiRate, { state, force });
  } catch (err) {
    console.warn('[Agmarknet Live Sync Warning]:', err.message);
    return { synced: false, error: err.message };
  }
}

/**
 * @desc    Get APMC Mandi rates with filters (syncs live from data.gov.in Agmarknet API)
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
      sync,
      page = 1,
      limit = 120
    } = req.query;

    const cleanState =
      state && String(state).trim().toUpperCase() !== 'ALL'
        ? String(state).trim()
        : undefined;

    // Normal reads serve the saved snapshot immediately while a refresh runs.
    // Explicit sync requests may wait for the external source.
    let syncStatus = { synced: false, reason: 'background_refresh' };
    if (sync === 'true') syncStatus = await ensureLiveRatesSynced({ state: cleanState || 'ALL', force: true });
    else void ensureLiveRatesSynced({ state: cleanState || 'ALL' });

    const query = {};

    if (commodity) {
      query.commodity = { $regex: commodity.trim(), $options: 'i' };
    }
    if (cleanState) {
      query.state = cleanState.toUpperCase();
    }
    if (district) {
      query.district = district.trim().toUpperCase();
    }
    if (category) {
      query.category = category.trim().toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 120));
    const skip = (pageNum - 1) * limitNum;

    const total = await MandiRate.countDocuments(query);
    const dbRates = await MandiRate.find(query)
      .sort('-priceDate')
      .skip(skip)
      .limit(limitNum)
      .lean();
    const rates = await attachCropImagesToRates(dbRates);

    return res.status(200).json({
      success: true,
      source: syncStatus.synced ? syncStatus.source : 'MongoDB saved mandi rates',
      syncedLive: Boolean(syncStatus.synced),
      totalAvailable: syncStatus.totalAvailable || null,
      updatedDate: syncStatus.updatedDate || null,
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
 * @desc    Query live daily Agmarknet prices directly from data.gov.in API
 * @route   GET /api/mandi-rates/live
 * @access  Public
 */
const getLiveAgmarknetRates = async (req, res, next) => {
  try {
    const { state = 'ALL', district, commodity, limit = 100, offset = 0 } = req.query;
    const cleanState =
      state && String(state).trim().toUpperCase() !== 'ALL' ? String(state).trim() : undefined;
    const data = await fetchAgmarknetMandiRates({
      state: cleanState,
      district: district || undefined,
      commodity: commodity || undefined,
      maxRecords: Math.min(200, Math.max(10, parseInt(limit, 10) || 100)),
      startOffset: Math.max(0, parseInt(offset, 10) || 0)
    });

    // Persist any newly searched commodities / loaded pages into MongoDB cache
    if (mongoose.connection.readyState === 1 && data.records.length > 0) {
      upsertRecordsToDb(MandiRate, data.records, data.source).catch((err) => {
        console.warn('[Live Cache Save Warning]:', err.message);
      });
    }

    const enrichedRates = await attachCropImagesToRates(data.records);

    return res.status(200).json({
      success: true,
      source: data.source,
      updatedDate: data.updatedDate,
      fetchedAt: data.fetchedAt,
      totalAvailable: data.totalAvailable,
      offset: data.offset,
      nextOffset: data.nextOffset,
      hasMore: data.hasMore,
      count: enrichedRates.length,
      rates: enrichedRates
    });
  } catch (error) {
    try {
      const { state, district, commodity, limit = 100 } = req.query;
      const query = {};
      if (state && String(state).trim().toUpperCase() !== 'ALL') {
        query.state = state.trim().toUpperCase();
      }
      if (district) query.district = district.trim().toUpperCase();
      if (commodity) query.commodity = { $regex: commodity.trim(), $options: 'i' };

      const dbRates = await MandiRate.find(query)
        .sort('-priceDate')
        .limit(Math.min(500, Math.max(10, parseInt(limit, 10) || 100)))
        .lean();
      const enrichedFallback = await attachCropImagesToRates(dbRates);

      return res.status(200).json({
        success: true,
        source: `MongoDB Synced Agmarknet Snapshot (${error.message})`,
        count: enrichedFallback.length,
        hasMore: false,
        rates: enrichedFallback
      });
    } catch (dbErr) {
      return next(dbErr);
    }
  }
};

/**
 * @desc    Get live weather and harvest/transit advisory via Open-Meteo API
 * @route   GET /api/mandi-rates/weather
 * @access  Public
 */
const getDistrictWeather = async (req, res) => {
  try {
    const { district = 'Dharwad', latitude, longitude } = req.query;
    const weather = await fetchDistrictWeather({ district, latitude, longitude });
    return res.status(200).json({
      success: true,
      weather
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: `Weather API unavailable: ${error.message}`
    });
  }
};

/**
 * @desc    Lookup Indian District/Taluk/State from Pincode via India Post API
 * @route   GET /api/mandi-rates/pincode/:pincode
 * @access  Public
 */
const lookupPincode = async (req, res) => {
  try {
    const location = await fetchPincodeInfo(req.params.pincode);
    return res.status(200).json({
      success: true,
      location
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get fair price benchmark and anti-exploitation corridor for a specific crop
 * @route   GET /api/mandi-rates/benchmark
 * @access  Public
 */
const getBenchmarkForCrop = async (req, res, next) => {
  try {
    const { commodity, cropName, district, state } = req.query;
    const targetCrop = commodity || cropName;

    if (!targetCrop) {
      return res.status(400).json({
        success: false,
        message: 'Please specify a commodity name to get benchmark rate'
      });
    }

    void ensureLiveRatesSynced({ state: state || 'Karnataka' });

    const query = {
      commodity: { $regex: targetCrop.trim(), $options: 'i' }
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
        commodity: { $regex: targetCrop.trim(), $options: 'i' }
      }).sort('-priceDate');
    }

    if (!benchmark) {
      return res.status(404).json({
        success: false,
        message: `No APMC benchmark found for ${targetCrop}. Please check commodity name.`
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
    const { match, error: filterError } = buildAnalyticsMatch(req.query);

    if (filterError) {
      return res.status(400).json({
        success: false,
        message: filterError
      });
    }

    void ensureLiveRatesSynced({ state: req.query.state || 'Karnataka' });
    // Pipeline 1: Commodity price trends & spreads
    const commodityTrends = await MandiRate.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            commodity: '$commodity',
            category: '$category'
          },
          avgModalPrice: { $avg: '$modalPrice' },
          minObserved: { $min: '$minPrice' },
          maxObserved: { $max: '$maxPrice' },
          totalArrivals: { $sum: '$arrivalQuantity' },
          marketCenters: { $addToSet: '$marketCenter' }
        }
      },
      {
        $project: {
          commodity: '$_id.commodity',
          category: '$_id.category',
          avgModalPrice: { $round: ['$avgModalPrice', 0] },
          minObserved: 1,
          maxObserved: 1,
          priceSpread: { $subtract: ['$maxObserved', '$minObserved'] },
          totalArrivals: 1,
          marketsCount: { $size: '$marketCenters' }
        }
      },
      { $sort: { marketsCount: -1, totalArrivals: -1 } }
    ]);

    // Pipeline 2: District-wise mandi activity & arrivals
    const districtArrivals = await MandiRate.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$district',
          totalArrivals: { $sum: '$arrivalQuantity' },
          commoditiesTracked: { $addToSet: '$commodity' },
          marketCenters: { $addToSet: '$marketCenter' }
        }
      },
      {
        $project: {
          district: '$_id',
          totalArrivals: 1,
          commoditiesCount: { $size: '$commoditiesTracked' },
          mandiCount: { $size: '$marketCenters' }
        }
      },
      { $sort: { mandiCount: -1, commoditiesCount: -1, totalArrivals: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      source: 'MongoDB saved mandi rates',
      corridor: 'Live APMC Corridor Analytics',
      commodityTrends,
      districtArrivals
    });
  } catch (error) {
    next(error);
  }
};

const getMandiPriceTrends = async (req, res, next) => {
  try {
    const { match, error: filterError } = buildAnalyticsMatch(req.query);

    if (filterError) {
      return res.status(400).json({
        success: false,
        message: filterError
      });
    }

    const trends = await MandiRate.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            date: '$priceDate',
            commodity: '$commodity'
          },
          avgModalPrice: { $avg: '$modalPrice' },
          minModalPrice: { $min: '$modalPrice' },
          maxModalPrice: { $max: '$modalPrice' },
          totalArrivals: { $sum: '$arrivalQuantity' },
          marketCenters: { $addToSet: '$marketCenter' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          commodity: '$_id.commodity',
          avgModalPrice: { $round: ['$avgModalPrice', 0] },
          minModalPrice: 1,
          maxModalPrice: 1,
          totalArrivals: 1,
          marketsCount: { $size: '$marketCenters' }
        }
      },
      {
        $sort: {
          date: 1,
          commodity: 1
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      trends
    });
  } catch (error) {
    next(error);
  }
};


const getMandiMarketComparison = async (req, res, next) => {
  try {
    const { match, error: filterError } = buildAnalyticsMatch(req.query);

    if (filterError) {
      return res.status(400).json({
        success: false,
        message: filterError
      });
    }

    if (!match.commodity) {
      return res.status(400).json({
        success: false,
        message: 'Commodity filter is required for market comparison.'
      });
    }

    const markets = await MandiRate.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            state: '$state',
            district: '$district',
            marketCenter: '$marketCenter',
            unit: '$unit'
          },
          avgModalPrice: { $avg: '$modalPrice' },
          minModalPrice: { $min: '$modalPrice' },
          maxModalPrice: { $max: '$modalPrice' },
          totalArrivals: { $sum: '$arrivalQuantity' },
          observations: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          state: '$_id.state',
          district: '$_id.district',
          marketCenter: '$_id.marketCenter',
          unit: '$_id.unit',
          avgModalPrice: { $round: ['$avgModalPrice', 0] },
          minModalPrice: 1,
          maxModalPrice: 1,
          totalArrivals: 1,
          observations: 1
        }
      },
      { $sort: { avgModalPrice: 1 } }
    ]);

    return res.status(200).json({
      success: true,
      commodity: match.commodity,
      markets
    });
  } catch (error) {
    next(error);
  }
};



module.exports = {
  getMandiRates,
  getLiveAgmarknetRates,
  getDistrictWeather,
  lookupPincode,
  getBenchmarkForCrop,
  getMandiAnalytics,
  getMandiPriceTrends,
  getMandiMarketComparison
};
